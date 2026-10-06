import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

let checks = 0;
const test = async (label, work) => {
  await work();
  checks++;
  console.log(`PASS ${label}`);
};
const read = (file) => fs.readFileSync(file, "utf8");
const parse = (file) =>
  ts.createSourceFile(
    file,
    read(file),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

function evaluate(source, imports = {}, scope = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  // Execute the app's actual store and route guard with isolated dependencies.
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", ...Object.keys(scope), output)(
    module,
    module.exports,
    (name) => {
      assert.ok(name in imports, `Missing stub: ${name}`);
      return imports[name];
    },
    ...Object.values(scope)
  );
  return module.exports;
}

function createStore(initialize) {
  let state;
  const store = (selector) => selector(state);
  store.getState = () => state;
  store.setState = (patch) => {
    state = { ...state, ...patch };
  };
  state = initialize(store.setState);
  return store;
}

const enabledFlags = {
  FEATURE_DAILY_CHECKIN: true,
  FEATURE_AI_FEED: true,
  checkin: { mode: "ai" },
  care_circle: {
    enabled: true,
    connection_limit: 8,
    caregiver_alert_enabled: true,
    caregiver_view_logs_enabled: true,
    caregiver_ack_enabled: true,
  },
};
const serverVariants = [
  { ...enabledFlags, FEATURE_AI_CHAT: true },
  {
    ...enabledFlags,
    FEATURE_AI_CHAT: false,
    chatbot: {
      enabled: true,
      available: true,
      daily_limit: null,
      unlimited: true,
    },
  },
  {
    ...enabledFlags,
    FEATURE_AI_CHAT: true,
    chatbot: {
      enabled: true,
      available: true,
      daily_limit: 5,
      unlimited: false,
    },
  },
];
const loadedStores = [];

await test("legacy and structured server flags cannot reopen chatbot UI", async () => {
  for (const flags of serverVariants) {
    const loaded = evaluate(read("src/features/app-config/flags.store.ts"), {
      zustand: { create: createStore },
      "./flags.api": { flagsApi: { fetchFlags: async () => flags } },
    });
    await loaded.useFlagsStore.getState().fetchFlags();
    const state = loaded.useFlagsStore.getState();
    assert.equal(state.status, "success");
    assert.equal(loaded.selectIsChatbotAvailable(state), false);
    assert.equal(state.FEATURE_DAILY_CHECKIN, true);
    assert.equal(state.FEATURE_AI_FEED, true);
    assert.deepEqual(state.checkin, enabledFlags.checkin);
    assert.deepEqual(state.care_circle, enabledFlags.care_circle);
    loadedStores.push(loaded);
  }
});

await test("direct chatbot links redirect home before chat content can mount", () => {
  const ast = parse("app/ai-chat.tsx");
  const guard = ast.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) &&
      node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword
      )
  );
  assert.ok(guard, "chatbot route must have a default screen");
  function Redirect() {}
  function AiChatContent() {
    assert.fail("hidden chat content must not mount");
  }
  for (const loaded of loadedStores) {
    const route = evaluate(
      guard.getText(ast),
      {
        "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
      },
      { ...loaded, Redirect, AiChatContent }
    );
    const rendered = route.default();
    assert.equal(rendered.type, Redirect);
    assert.equal(rendered.props.href, "/home");
  }
});

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(file);
    return /\.(ts|tsx)$/.test(file) ? [file] : [];
  });
}

await test("app screens do not mount chatbot launchers, modals, or navigation links", () => {
  for (const file of walk("app")) {
    const ast = parse(file);
    const inspect = (node) => {
      if (ts.isStringLiteral(node)) {
        assert.doesNotMatch(
          node.text,
          /(?:^|\/)(?:ChatModal|AsinuChatSticker)(?:\.[^/]*)?$/,
          `${file} imports a chatbot entry point`
        );
        assert.doesNotMatch(
          node.text,
          /^\/?ai-chat(?:[/?]|$)/,
          `${file} links to chatbot`
        );
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        assert.ok(
          !["ChatModal", "AsinuChatSticker"].includes(
            node.tagName.getText(ast)
          ),
          `${file} mounts chatbot UI`
        );
      }
      ts.forEachChild(node, inspect);
    };
    inspect(ast);
  }
  const home = read("app/(tabs)/home/index.tsx");
  for (const component of [
    "DailyCheckinCard",
    "InstantCheckinCard",
    "EarlySignalCard",
  ]) {
    assert.match(
      home,
      new RegExp(`<${component}\\b`),
      `${component} must stay on Home`
    );
  }
});

function flattenStrings(value, prefix = "") {
  return Object.entries(value).flatMap(([key, item]) => {
    const location = prefix ? `${prefix}.${key}` : key;
    return typeof item === "string"
      ? [[location, item]]
      : flattenStrings(item, location);
  });
}

const catalogs = Object.fromEntries(
  ["vi", "en"].map((language) => [
    language,
    JSON.parse(read(`src/i18n/locales/${language}/subscription.json`)),
  ])
);

await test("both subscription catalogs and FAQs contain no chatbot benefits", () => {
  for (const [language, catalog] of Object.entries(catalogs)) {
    for (const [key, copy] of flattenStrings(catalog)) {
      assert.doesNotMatch(
        key,
        /chatHistory|chatContext|voiceChat|voiceTranscribe/i,
        `${language}:${key} retains a chatbot feature`
      );
      assert.doesNotMatch(
        copy,
        /chatbot|\bchat\b|trò chuyện|hội thoại/i,
        `${language}:${key} advertises chatbot`
      );
    }
    assert.match(
      catalog.v2FreeFeature3,
      language === "en" ? /voice logging/i : /nhập log bằng giọng nói/i
    );
    assert.match(
      catalog.faq.a1,
      language === "en" ? /logs by voice/i : /nhập log bằng giọng nói/i
    );
    assert.match(catalog.v2FreeFeature5, /check-in/i);
    assert.match(
      catalog.v2AnTamFeature1,
      language === "en" ? /AI call center/i : /tổng đài viên AI/i
    );
    assert.match(
      catalog.faq.a6,
      language === "en" ? /AI call center/i : /tổng đài viên AI/i
    );
  }
});

await test("rendered package descriptions retain voice logging, check-in, and AI call center", () => {
  const ast = parse("app/subscription/index.tsx");
  const selected = new Map();
  const inspect = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      ["FREE_FEATURES", "AN_TAM_FEATURES"].includes(node.name.text)
    ) {
      assert.ok(
        node.initializer && ts.isArrayLiteralExpression(node.initializer)
      );
      selected.set(
        node.name.text,
        node.initializer.elements.map((element) => {
          assert.ok(ts.isStringLiteral(element));
          return element.text;
        })
      );
    }
    ts.forEachChild(node, inspect);
  };
  inspect(ast);
  assert.ok(selected.get("FREE_FEATURES")?.includes("v2FreeFeature3"));
  assert.ok(selected.get("FREE_FEATURES")?.includes("v2FreeFeature5"));
  assert.ok(selected.get("AN_TAM_FEATURES")?.includes("v2AnTamFeature1"));
  for (const [language, catalog] of Object.entries(catalogs)) {
    for (const key of [...selected.values()].flat()) {
      assert.equal(
        typeof catalog[key],
        "string",
        `${language}:${key} must resolve`
      );
      assert.doesNotMatch(
        catalog[key],
        /chatbot|\bchat\b|trò chuyện|hội thoại/i
      );
    }
  }
});

console.log(`Hidden chatbot UI: ${checks} regressions passed.`);
