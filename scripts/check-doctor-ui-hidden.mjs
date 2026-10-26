import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
const parse = file => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let checks = 0;
const test = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };
function evaluate(source, imports = {}, scope = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  // Execute the checked-in components and installed Expo router, with native
  // services isolated. No auth, recording, push or consultation requests run.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(scope), output)(
    module, module.exports, name => {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      assert.ok(Object.hasOwn(imports, name), `Missing adapter: ${name}`);
      return imports[name];
    }, ...Object.values(scope),
  );
  return module.exports;
}
function find(source, predicate) {
  let result;
  const walk = node => { if (!result && predicate(node)) result = node; ts.forEachChild(node, walk); };
  walk(source);
  assert.ok(result, 'Expected source node');
  return result;
}

await test('Dr.Asinu remains hidden in dev, staging and production, including native development', () => {
  for (const env of ['dev', 'staging', 'prod']) for (const dev of [true, false]) {
    const flags = evaluate(read('src/lib/appEnv.ts'), {}, {
      process: { env: { EXPO_PUBLIC_APP_ENV: env } }, __DEV__: dev,
    });
    assert.equal(flags.isDoctorFeaturesEnabled, false);
  }
});

const Screen = () => null;
const Group = () => null;
const protectedModule = evaluate(read('node_modules/expo-router/build/views/Protected.js'), {
  react: React, '../primitives': { Group },
});
const { useFilterScreenChildren: filterScreenChildren } = evaluate(read('node_modules/expo-router/build/layouts/withLayoutContext.js'), {
  react: { ...React, useMemo: fn => fn() }, '../Route': {}, '../native-tabs/NativeTabTrigger': { isNativeTabTrigger: () => false },
  '../useScreens': {}, './IsWithinLayoutContext': {}, '../views/Protected': protectedModule,
  '../views/Screen': { isScreen: child => React.isValidElement(child) && child.type === Screen },
});
const { mapProtectedScreen } = evaluate(read('node_modules/expo-router/build/layouts/stack-utils/mapProtectedScreen.js'), {
  react: React, './StackHeaderComponent': { StackHeaderComponent: () => null },
  './StackScreen': { StackScreen: Screen, appendScreenStackPropsToOptions: options => options },
  '../../utils/children': { isChildOfType: (child, type) => React.isValidElement(child) && child.type === type },
  '../../views/Protected': protectedModule, '../../views/Screen': { Screen },
});
const root = parse('app/_layout.tsx');
const stack = find(root, node => ts.isJsxElement(node) && node.openingElement.tagName.getText(root) === 'Stack');
const doctorRoutes = [
  'doctor-consultation', 'doctor-consultation/[taskId]', 'doctor-consultation-history',
  'doctor-interview/[sessionId]', 'doctor-interview/preview', 'privacy-center',
];
function filteredRoutes(enabled) {
  const { layout } = evaluate(`export const layout = (${stack.getText(root)});`, {}, {
    Stack: Object.assign(() => null, { Screen, Protected: Group }),
    isDoctorFeaturesEnabled: enabled, screenOptions: {}, legalScreenOptions: {},
  });
  // SDK 57's Stack first maps its public children into navigator screens.
  const mapped = mapProtectedScreen({ guard: true, children: layout.props.children });
  return filterScreenChildren(mapped.children);
}
await test('the actual Expo navigator excludes all six screens, preventing deep links and restored consultation routes', () => {
  const result = filteredRoutes(false);
  assert.deepEqual([...result.protectedScreens].sort(), [...doctorRoutes].sort());
  assert.ok(result.screens.every(screen => !doctorRoutes.includes(screen.name)));
  for (const route of ['checkin', 'checkin-call/[episodeId]', '(tabs)', 'care-circle/member/[id]', 'subscription/index']) {
    assert.equal(result.protectedScreens.has(route), false, route);
  }
});
await test('one flag restores the original screens while login and legal routes stay available', () => {
  const hidden = filteredRoutes(false), enabled = filteredRoutes(true);
  assert.equal(enabled.protectedScreens.size, 0);
  for (const route of doctorRoutes) assert.ok(enabled.screens.some(screen => screen.name === route));
  for (const route of ['login/index', 'register/index', 'legal/content', 'legal/sources']) {
    assert.ok(hidden.screens.some(screen => screen.name === route));
    assert.ok(enabled.screens.some(screen => screen.name === route));
  }
});

const externalEntries = [
  'app/checkin/index.tsx', 'app/(tabs)/profile/index.tsx', 'app/care-circle/member/[id].tsx',
  'app/early-signal/[userId].tsx', 'app/checkin-call/ui-gallery.tsx', 'src/components/HealthScoreCard.tsx',
];
await test('all seven external consultation/privacy/preview buttons have a visibility guard', () => {
  let buttons = 0;
  for (const file of externalEntries) {
    const tree = parse(file);
    const visit = node => {
      if (ts.isJsxAttribute(node) && node.name.getText(tree) === 'onPress' &&
          /\/(doctor-consultation|doctor-interview|privacy-center)/u.test(node.getText(tree))) {
        buttons++;
        let guarded = false;
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (!ts.isJsxExpression(parent) || !parent.expression) continue;
          let expression = parent.expression;
          while (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
            if (expression.left.getText(tree) === 'isDoctorFeaturesEnabled') guarded = true;
            expression = expression.left;
          }
        }
        assert.ok(guarded, `Visible Dr.Asinu button in ${file}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  assert.equal(buttons, 7);
});

const flags = { isDoctorFeaturesEnabled: false };
const categories = [], removed = [];
const { routeFromNotificationData, registerNotificationCategories } = evaluate(read('src/lib/notifications.ts'), {
  './appEnv': flags, './native-permissions': {}, 'expo-constants': {},
  'expo-notifications': {
    setNotificationCategoryAsync: async (id, actions) => categories.push({ id, actions }),
    deleteNotificationCategoryAsync: async id => removed.push(id),
  },
  'react-native': { Platform: { OS: 'ios' } }, './android-checkin-call': {},
  '../i18n': { t: key => key }, '../stores/notification.store': {}, './notification-sounds': {},
});
await test('old specialist notifications cannot reopen hidden screens; check-in/family destinations still work', () => {
  for (const type of ['doctor_message', 'doctor_ivr_session', 'doctor_ivr_reply']) {
    assert.equal(routeFromNotificationData({ type, task_id: 'task-1', sessionId: '00000000-0000-4000-8000-000000000001' }), '/(tabs)/home');
  }
  assert.equal(routeFromNotificationData({ type: 'health_alert', needsDoctor: true }), '/checkin');
  assert.equal(routeFromNotificationData({ type: 'health_alert', needsDoctor: true, alertType: 'glucose_high' }), '/logs/glucose');
  assert.equal(routeFromNotificationData({ type: 'morning_checkin' }), '/checkin');
  assert.equal(routeFromNotificationData({ type: 'checkin_inactivity_notice' }), '/(tabs)/care-circle');
  assert.equal(routeFromNotificationData({ type: 'caregiver_alert' }), '/(tabs)/home');
  assert.equal(routeFromNotificationData({ type: 'checkin_call', checkinCall: true, episodeId: 'episode-1' }).pathname, '/checkin-call/[episodeId]');
});
await test('native doctor quick replies are removed; health alert actions remain registered', async () => {
  await registerNotificationCategories();
  assert.ok(removed.includes('doctor_message'));
  assert.ok(!categories.some(category => category.id === 'doctor_message'));
  assert.ok(categories.some(category => category.id === 'health_alert'));
});
await test('a previously registered quick reply cannot send a consultation message while hidden', () => {
  const tree = parse('src/providers/SessionProvider.tsx');
  const handler = find(tree, node => ts.isIfStatement(node) && node.expression.getText(tree) === 'actionIdentifier === "REPLY_DOCTOR_MESSAGE"');
  let sent = 0;
  // eslint-disable-next-line no-new-func
  new Function('isDoctorFeaturesEnabled', 'apiClient', 'data', 'response', handler.thenStatement.getText(tree))(
    false, () => { sent++; }, { task_id: 'old-task' }, { userText: 'Old quick reply' },
  );
  assert.equal(sent, 0);
});
await test('hidden contact buttons never start animations or expose an action', () => {
  const component = evaluate(read('src/components/DoctorConnectButton.tsx'), {
    '@expo/vector-icons': {}, react: {}, 'react-native': { StyleSheet: { create: value => value } },
    './ScaledText': {}, '../styles': {}, '../lib/appEnv': flags,
  });
  assert.equal(component.DoctorConnectButton({ text: 'Contact', onPress: () => assert.fail('Unexpected contact') }), null);
});
await test('an IVR invitation cannot appear from cached state or start polling while hidden', () => {
  let requests = 0;
  const component = evaluate(read('src/features/doctor-ivr/DoctorIvrEntry.tsx'), {
    react: { useCallback: fn => fn, useState: () => [{ id: 'cached-session' }, () => {}] },
    'expo-router': { useFocusEffect: fn => fn() },
    'react-native': { StyleSheet: { create: value => value } }, '@expo/vector-icons': {},
    'react-i18next': { useTranslation: () => ({ t: key => key }) }, '../../components/ScaledText': {},
    '../../hooks/useGuardedRouter': { useGuardedRouter: () => ({}) },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: {} }) },
    './ivr.api': { ivrApi: { enabled: () => { requests++; } } },
    '../../styles/theme': { radius: {}, spacing: {} }, '../../lib/appEnv': flags,
  });
  assert.equal(component.DoctorIvrEntry({ tenantId: 'fixture', taskId: 'fixture' }), null);
  assert.equal(requests, 0);
});
await test('restoring the flag preserves doctor thread routing and native quick replies', async () => {
  flags.isDoctorFeaturesEnabled = true;
  assert.equal(routeFromNotificationData({ type: 'doctor_message', task_id: 'task-1' }).pathname, '/doctor-consultation/[taskId]');
  await registerNotificationCategories();
  assert.ok(categories.some(category => category.id === 'doctor_message' && category.actions[0].identifier === 'REPLY_DOCTOR_MESSAGE'));
  flags.isDoctorFeaturesEnabled = false;
});

console.log(`Dr.Asinu UI visibility: ${checks} checks passed.`);
