import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

const read = (file) => fs.readFileSync(file, "utf8");
const parse = (file) =>
  ts.createSourceFile(
    file,
    read(file),
    ts.ScriptTarget.Latest,
    true,
    /\.[jt]sx$/u.test(file)
      ? ts.ScriptKind.TSX
      : /\.ts$/u.test(file)
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS
  );
const sourceRoots = ["app", "src", "asinu-brain-extension"];
function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) {
      return [];
    }
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(file) : [file];
  });
}
const allFiles = sourceRoots.flatMap(sourceFiles).sort();
const codeFiles = allFiles.filter((file) => /\.[cm]?[jt]sx?$/u.test(file));
const sourceTrees = new Map(codeFiles.map((file) => [file, parse(file)]));
const isDoctorRouteFile = (file) =>
  /^app\/(?:doctor(?:[-/]|\.)|privacy-center(?:[/.]))/u.test(file);
const isDoctorInternalFile = (file) =>
  isDoctorRouteFile(file) || file.startsWith("src/features/doctor-ivr/");
function doctorTarget(value) {
  return (
    /(?:^|\/)(?:doctor(?:[-/]|$)|privacy-center(?:[/?#]|$))/u.test(value) ||
    /^https?:\/\/(?:dr|doctor)\.asinu\.(?:vn|top)(?:[/:?#]|$)/iu.test(value)
  );
}
function hasVisibilityGuard(node, tree) {
  const positive = (expression) => {
    if (ts.isParenthesizedExpression(expression)) {
      return positive(expression.expression);
    }
    if (ts.isIdentifier(expression)) {
      return expression.text === "isDoctorFeaturesEnabled";
    }
    return (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      (positive(expression.left) || positive(expression.right))
    );
  };
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      positive(parent.left) &&
      node.pos >= parent.right.pos &&
      node.end <= parent.right.end
    ) {
      return true;
    }
    if (
      ts.isIfStatement(parent) &&
      positive(parent.expression) &&
      node.pos >= parent.thenStatement.pos &&
      node.end <= parent.thenStatement.end
    ) {
      return true;
    }
    if (ts.isBlock(parent)) {
      for (const statement of parent.statements) {
        if (statement.end > node.pos) {
          break;
        }
        if (
          !ts.isIfStatement(statement) ||
          statement.expression.getText(tree) !== "!isDoctorFeaturesEnabled"
        ) {
          continue;
        }
        const body = statement.thenStatement;
        if (
          ts.isReturnStatement(body) ||
          (ts.isBlock(body) && body.statements.some(ts.isReturnStatement))
        ) {
          return true;
        }
      }
    }
  }
  return false;
}
// Resolve file-local aliases as well as inline string/object destinations. This
// detects hrefs and callbacks declared outside JSX without importing app code.
function targetResolver(tree) {
  const bindings = new Map();
  function bind(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const values = bindings.get(node.name.text) || [];
      bindings.set(node.name.text, [...values, node.initializer]);
    }
    ts.forEachChild(node, bind);
  }
  bind(tree);
  function resolve(node, seen = new Set()) {
    if (!node || seen.has(node)) {
      return [];
    }
    const next = new Set([...seen, node]);
    if (ts.isStringLiteralLike(node)) {
      return [node.text];
    }
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isJsxExpression(node)
    ) {
      return resolve(node.expression, next);
    }
    if (ts.isIdentifier(node)) {
      return (bindings.get(node.text) || []).flatMap((value) =>
        resolve(value, next)
      );
    }
    if (ts.isConditionalExpression(node)) {
      return [
        ...resolve(node.whenTrue, next),
        ...resolve(node.whenFalse, next),
      ];
    }
    if (ts.isObjectLiteralExpression(node)) {
      return node.properties.flatMap((property) =>
        ts.isPropertyAssignment(property) &&
        ["pathname", "href", "url", "to"].includes(
          property.name.getText(tree).replace(/['"]/gu, "")
        )
          ? resolve(property.initializer, next)
          : []
      );
    }
    if (ts.isTemplateExpression(node)) {
      return [
        node.head.text +
          node.templateSpans
            .map(
              (span) =>
                `${resolve(span.expression, next)[0] || "{dynamic}"}${
                  span.literal.text
                }`
            )
            .join(""),
      ];
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      return resolve(node.body, next);
    }
    if (ts.isBlock(node)) {
      return node.statements
        .filter(ts.isReturnStatement)
        .flatMap((statement) => resolve(statement.expression, next));
    }
    return [];
  }
  return resolve;
}
let checks = 0;
const test = async (name, run) => {
  await run();
  checks++;
  console.log(`PASS ${name}`);
};
function evaluate(source, imports = {}, scope = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  // Execute the checked-in components and installed Expo router, with native
  // services isolated. No auth, recording, push or consultation requests run.
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", ...Object.keys(scope), output)(
    module,
    module.exports,
    (name) => {
      if (name === "react/jsx-runtime") {
        return jsxRuntime;
      }
      assert.ok(Object.hasOwn(imports, name), `Missing adapter: ${name}`);
      return imports[name];
    },
    ...Object.values(scope)
  );
  return module.exports;
}
function find(source, predicate) {
  let result;
  const walk = (node) => {
    if (!result && predicate(node)) {
      result = node;
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
  assert.ok(result, "Expected source node");
  return result;
}

await test("all scanned code/configuration files parse, so syntax cannot silently hide an entry point", () => {
  for (const [file, tree] of sourceTrees) {
    assert.equal(tree.parseDiagnostics.length, 0, `Cannot fully scan ${file}`);
  }
  for (const file of allFiles.filter((name) => name.endsWith(".json"))) {
    assert.doesNotThrow(
      () => JSON.parse(read(file)),
      `Invalid configuration: ${file}`
    );
  }
});

await test("Dr.Asinu opens in local development while staging and production stay hidden", () => {
  const environments = [
    { env: "local", developmentVisible: true },
    { env: "dev", developmentVisible: true },
    { env: undefined, developmentVisible: true },
    { env: "staging", developmentVisible: false },
    { env: "prod", developmentVisible: false },
  ];
  for (const { env, developmentVisible } of environments) {
    for (const dev of [true, false, undefined]) {
      const flags = evaluate(
        read("src/lib/appEnv.ts"),
        {},
        {
          process: { env: { EXPO_PUBLIC_APP_ENV: env } },
          __DEV__: dev,
        }
      );
      assert.equal(
        flags.isDoctorFeaturesEnabled,
        dev === true && developmentVisible,
        `Dr.Asinu visibility for environment=${env}, runtimeDevelopment=${dev}`
      );
    }
  }
});

const Screen = () => null;
const Group = () => null;
const protectedModule = evaluate(
  read("node_modules/expo-router/build/views/Protected.js"),
  {
    react: React,
    "../primitives": { Group },
  }
);
const { useFilterScreenChildren: filterScreenChildren } = evaluate(
  read("node_modules/expo-router/build/layouts/withLayoutContext.js"),
  {
    react: { ...React, useMemo: (fn) => fn() },
    "../Route": {},
    "../native-tabs/NativeTabTrigger": { isNativeTabTrigger: () => false },
    "../useScreens": {},
    "./IsWithinLayoutContext": {},
    "../views/Protected": protectedModule,
    "../views/Screen": {
      isScreen: (child) => React.isValidElement(child) && child.type === Screen,
    },
  }
);
const { mapProtectedScreen } = evaluate(
  read(
    "node_modules/expo-router/build/layouts/stack-utils/mapProtectedScreen.js"
  ),
  {
    react: React,
    "./StackHeaderComponent": { StackHeaderComponent: () => null },
    "./StackScreen": {
      StackScreen: Screen,
      appendScreenStackPropsToOptions: (options) => options,
    },
    "../../utils/children": {
      isChildOfType: (child, type) =>
        React.isValidElement(child) && child.type === type,
    },
    "../../views/Protected": protectedModule,
    "../../views/Screen": { Screen },
  }
);
const root = sourceTrees.get("app/_layout.tsx");
const stack = find(
  root,
  (node) =>
    ts.isJsxElement(node) &&
    node.openingElement.tagName.getText(root) === "Stack"
);
const doctorRoutes = codeFiles
  .filter(
    (file) => isDoctorRouteFile(file) && !/\/_layout\.[jt]sx?$/u.test(file)
  )
  .map((file) =>
    file
      .replace(/^app\//u, "")
      .replace(/\.[jt]sx?$/u, "")
      .replace(/\/index$/u, "")
  );
assert.ok(
  doctorRoutes.length >= 6,
  "Dedicated Dr.Asinu routes were not discovered"
);
function filteredRoutes(enabled) {
  const { layout } = evaluate(
    `export const layout = (${stack.getText(root)});`,
    {},
    {
      Stack: Object.assign(() => null, { Screen, Protected: Group }),
      isDoctorFeaturesEnabled: enabled,
      screenOptions: {},
      legalScreenOptions: {},
    }
  );
  // SDK 57's Stack first maps its public children into navigator screens.
  const mapped = mapProtectedScreen({
    guard: true,
    children: layout.props.children,
  });
  return filterScreenChildren(mapped.children);
}
await test("the actual Expo navigator excludes all Doctor screens, preventing deep links and restored consultation routes", () => {
  const result = filteredRoutes(false);
  assert.deepEqual(
    [...result.protectedScreens].sort(),
    [...doctorRoutes].sort()
  );
  assert.ok(
    result.screens.every((screen) => !doctorRoutes.includes(screen.name))
  );
  for (const route of [
    "checkin",
    "checkin-call/[episodeId]",
    "(tabs)",
    "care-circle/member/[id]",
    "subscription/index",
  ]) {
    assert.equal(result.protectedScreens.has(route), false, route);
  }
});
await test("one flag restores the original screens while login and legal routes stay available", () => {
  const hidden = filteredRoutes(false),
    enabled = filteredRoutes(true);
  assert.equal(enabled.protectedScreens.size, 0);
  for (const route of doctorRoutes) {
    assert.ok(enabled.screens.some((screen) => screen.name === route));
  }
  for (const route of [
    "login/index",
    "register/index",
    "legal/content",
    "legal/sources",
  ]) {
    assert.ok(hidden.screens.some((screen) => screen.name === route));
    assert.ok(enabled.screens.some((screen) => screen.name === route));
  }
});

const audit = {
  files: allFiles.length,
  codeFiles: codeFiles.length,
  protectedRoutes: doctorRoutes.length,
  navigationCandidates: 0,
  doctorActions: [],
};
await test("the source audit detects unguarded inline, aliased, href and external Dr.Asinu destinations", () => {
  const examples = [
    "router.push('/doctor-consultation')",
    "const destination = '/doctor-consultation-history'; router.push(destination)",
    "const destination = { pathname: '/doctor-interview/[sessionId]' }; router.navigate(destination)",
    "Linking.openURL('https://dr.asinu.vn/vi')",
    "const destination = '/privacy-center'; <Link href={destination} />",
    "apiClient('/api/doctor/tasks/fixture/messages')",
    "(router.push('/doctor-consultation') && isDoctorFeaturesEnabled) && <View />",
  ];
  for (const source of examples) {
    const tree = ts.createSourceFile(
      "audit-fixture.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const resolve = targetResolver(tree);
    const action = find(
      tree,
      (node) =>
        ts.isCallExpression(node) ||
        (ts.isJsxAttribute(node) && node.name.getText(tree) === "href")
    );
    const values = resolve(
      ts.isCallExpression(action) ? action.arguments[0] : action.initializer
    );
    assert.ok(values.some(doctorTarget), source);
    assert.equal(hasVisibilityGuard(action, tree), false, source);
  }
});
await test("a guard must run before the action; real gated callbacks and early returns remain valid", () => {
  for (const source of [
    "isDoctorFeaturesEnabled && router.push('/doctor-consultation')",
    "function open() { if (!isDoctorFeaturesEnabled) return; router.push('/doctor-consultation'); }",
    "isDoctorFeaturesEnabled && <Button onPress={() => router.push('/doctor-consultation')} />",
  ]) {
    const tree = ts.createSourceFile(
      "guard-fixture.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const action = find(tree, ts.isCallExpression);
    assert.equal(hasVisibilityGuard(action, tree), true, source);
  }
});
await test("every navigation call, href and Dr.Asinu API action across the entire app source respects visibility", () => {
  for (const [file, tree] of sourceTrees) {
    if (isDoctorInternalFile(file)) {
      continue;
    }
    const resolve = targetResolver(tree);
    const visit = (node) => {
      let values = [];
      if (
        ts.isCallExpression(node) &&
        /\.(?:push|navigate|replace|openURL|openBrowserAsync|openAuthSessionAsync)$|^(?:openExternal|linkTo)$/u.test(
          node.expression.getText(tree)
        )
      ) {
        audit.navigationCandidates++;
        values = resolve(node.arguments[0]);
      }
      if (
        ts.isJsxAttribute(node) &&
        ["href", "to", "url"].includes(node.name.getText(tree))
      ) {
        values = resolve(node.initializer);
      }
      const doctorApi =
        ts.isCallExpression(node) &&
        resolve(node.arguments[0]).some((value) =>
          /^\/api\/doctor(?:\/|[?#]|$)/u.test(value)
        );
      if (doctorApi || values.some(doctorTarget)) {
        const line =
          tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
        assert.ok(
          hasVisibilityGuard(node, tree),
          `Dr.Asinu action is not hidden: ${file}:${line}`
        );
        audit.doctorActions.push({
          file,
          line,
          kind: doctorApi ? "api" : "navigation",
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  assert.ok(
    audit.doctorActions.length >= 8,
    "Expected entry buttons and the legacy quick reply action"
  );
});
await test("Dr.Asinu UI components are never mounted from an unguarded screen elsewhere in src", () => {
  const doctorComponents = new Set();
  for (const [file, tree] of sourceTrees) {
    if (isDoctorInternalFile(file)) {
      continue;
    }
    const imports = new Map();
    for (const statement of tree.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const specifier = statement.moduleSpecifier.text;
      const resolved = specifier.startsWith(".")
        ? path.posix.normalize(
            path.posix.join(path.posix.dirname(file), specifier)
          )
        : specifier;
      if (!/doctor-ivr\/|DoctorConnectButton|^app\/doctor/iu.test(resolved)) {
        continue;
      }
      const clause = statement.importClause;
      if (clause?.name) {
        imports.set(clause.name.text, resolved);
      }
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const imported of clause.namedBindings.elements) {
          imports.set(imported.name.text, resolved);
        }
      }
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        imports.set(clause.namedBindings.name.text, resolved);
      }
    }
    const visit = (node) => {
      const reference =
        ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
          ? node.tagName
          : ts.isCallExpression(node) &&
            /(?:^|\.)createElement$/u.test(node.expression.getText(tree))
          ? node.arguments[0]
          : null;
      const componentName = reference?.getText(tree).split(".")[0];
      if (imports.has(componentName)) {
        assert.ok(
          hasVisibilityGuard(node, tree),
          `Unguarded Dr.Asinu component in ${file}: ${componentName}`
        );
        doctorComponents.add(componentName);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  assert.ok(doctorComponents.has("DoctorConnectButton"));
});

const flags = { isDoctorFeaturesEnabled: false };
const categories = [],
  removed = [];
const { routeFromNotificationData, registerNotificationCategories } = evaluate(
  read("src/lib/notifications.ts"),
  {
    "./appEnv": flags,
    "./native-permissions": {},
    "expo-constants": {},
    "expo-notifications": {
      setNotificationCategoryAsync: async (id, actions) =>
        categories.push({ id, actions }),
      deleteNotificationCategoryAsync: async (id) => removed.push(id),
    },
    "react-native": { Platform: { OS: "ios" } },
    "./android-checkin-call": {},
    "../i18n": { t: (key) => key },
    "../stores/notification.store": {},
    "./notification-sounds": {},
  }
);
await test("old specialist notifications cannot reopen hidden screens; check-in/family destinations still work", () => {
  for (const type of [
    "doctor_message",
    "doctor_ivr_session",
    "doctor_ivr_reply",
  ]) {
    assert.equal(
      routeFromNotificationData({
        type,
        task_id: "task-1",
        sessionId: "00000000-0000-4000-8000-000000000001",
      }),
      "/(tabs)/home"
    );
  }
  assert.equal(
    routeFromNotificationData({
      type: "doctor_ivr_call",
      callType: "doctor_ivr",
      checkinCall: true,
      episodeId: "session-1",
      attemptId: "attempt-1",
    }),
    "/(tabs)/home"
  );
  assert.equal(
    routeFromNotificationData({ type: "health_alert", needsDoctor: true }),
    "/checkin"
  );
  assert.equal(
    routeFromNotificationData({
      type: "health_alert",
      needsDoctor: true,
      alertType: "glucose_high",
    }),
    "/logs/glucose"
  );
  assert.equal(
    routeFromNotificationData({ type: "morning_checkin" }),
    "/checkin"
  );
  assert.equal(
    routeFromNotificationData({ type: "checkin_inactivity_notice" }),
    "/(tabs)/care-circle"
  );
  assert.equal(
    routeFromNotificationData({ type: "caregiver_alert" }),
    "/(tabs)/home"
  );
  assert.equal(
    routeFromNotificationData({
      type: "checkin_call",
      checkinCall: true,
      episodeId: "episode-1",
    }).pathname,
    "/checkin-call/[episodeId]"
  );
});
await test("native doctor quick replies are removed; health alert actions remain registered", async () => {
  await registerNotificationCategories();
  assert.ok(removed.includes("doctor_message"));
  assert.ok(!categories.some((category) => category.id === "doctor_message"));
  assert.ok(categories.some((category) => category.id === "health_alert"));
});
await test("a previously registered quick reply cannot send a consultation message while hidden", () => {
  const tree = parse("src/providers/SessionProvider.tsx");
  const handler = find(
    tree,
    (node) =>
      ts.isIfStatement(node) &&
      node.expression.getText(tree) ===
        'actionIdentifier === "REPLY_DOCTOR_MESSAGE"'
  );
  let sent = 0;
  // eslint-disable-next-line no-new-func
  new Function(
    "isDoctorFeaturesEnabled",
    "apiClient",
    "data",
    "response",
    handler.thenStatement.getText(tree)
  )(
    false,
    () => {
      sent++;
    },
    { task_id: "old-task" },
    { userText: "Old quick reply" }
  );
  assert.equal(sent, 0);
});
await test("hidden contact buttons never start animations or expose an action", () => {
  const component = evaluate(read("src/components/DoctorConnectButton.tsx"), {
    "@expo/vector-icons": {},
    react: {},
    "react-native": { StyleSheet: { create: (value) => value } },
    "./ScaledText": {},
    "../styles": {},
    "../lib/appEnv": flags,
  });
  assert.equal(
    component.DoctorConnectButton({
      text: "Contact",
      onPress: () => assert.fail("Unexpected contact"),
    }),
    null
  );
});
await test("an IVR invitation cannot appear from cached state or start polling while hidden", () => {
  let requests = 0;
  const component = evaluate(
    read("src/features/doctor-ivr/DoctorIvrEntry.tsx"),
    {
      react: {
        useCallback: (fn) => fn,
        useState: () => [{ id: "cached-session" }, () => {}],
      },
      "expo-router": { useFocusEffect: (fn) => fn() },
      "react-native": { StyleSheet: { create: (value) => value } },
      "@expo/vector-icons": {},
      "react-i18next": { useTranslation: () => ({ t: (key) => key }) },
      "../../components/ScaledText": {},
      "../../hooks/useGuardedRouter": { useGuardedRouter: () => ({}) },
      "../../hooks/useThemeColors": { useThemeColors: () => ({ colors: {} }) },
      "./ivr.api": {
        ivrApi: {
          enabled: () => {
            requests++;
          },
        },
      },
      "../../styles/theme": { radius: {}, spacing: {} },
      "../../lib/appEnv": flags,
    }
  );
  assert.equal(
    component.DoctorIvrEntry({ tenantId: "fixture", taskId: "fixture" }),
    null
  );
  assert.equal(requests, 0);
});
await test("restoring the flag preserves doctor thread routing and native quick replies", async () => {
  flags.isDoctorFeaturesEnabled = true;
  assert.equal(
    routeFromNotificationData({ type: "doctor_message", task_id: "task-1" })
      .pathname,
    "/doctor-consultation/[taskId]"
  );
  await registerNotificationCategories();
  assert.ok(
    categories.some(
      (category) =>
        category.id === "doctor_message" &&
        category.actions[0].identifier === "REPLY_DOCTOR_MESSAGE"
    )
  );
  flags.isDoctorFeaturesEnabled = false;
});

console.log(`Dr.Asinu UI visibility: ${checks} checks passed.`);
console.log(
  `Whole-source audit: ${audit.files} files, ${audit.codeFiles} code files, ${audit.navigationCandidates} navigation/link candidates, ${audit.doctorActions.length} guarded Dr.Asinu actions, ${audit.protectedRoutes} protected routes.`
);
