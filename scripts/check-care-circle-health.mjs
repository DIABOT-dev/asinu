import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';

const read = file => fs.readFileSync(file, 'utf8');
function evaluate(source, dependencies, clock = Date) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
  } }).outputText;
  // Execute the real component and event handlers with deterministic native adapters.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', 'Date', output)(module, module.exports, id => {
    if (id.endsWith('.png')) return id;
    assert.ok(id in dependencies, `Missing adapter ${id}`);
    return dependencies[id];
  }, clock);
  return module.exports;
}
let checks = 0;
async function test(label, run) { await run(); checks++; console.log(`PASS ${label}`); }
const invitationSource = ts.createSourceFile('invite.tsx', read('app/care-circle/invite.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let permissionInitializer;
let progressInitializer;
function findInvitationDefaults(node) {
  if (ts.isVariableDeclaration(node)) {
    if (ts.isArrayBindingPattern(node.name) && node.name.elements[0]?.name?.getText(invitationSource) === 'permissions') {
      permissionInitializer = node.initializer.arguments[0].getText(invitationSource);
    }
    if (node.name.getText(invitationSource) === 'hasFormProgress') {
      progressInitializer = node.initializer.getText(invitationSource);
    }
  }
  ts.forEachChild(node, findInvitationDefaults);
}
findInvitationDefaults(invitationSource);
assert.ok(permissionInitializer && progressInitializer, 'Invitation defaults and unsaved-change check must exist');
const invitationDefaults = evaluate(`
  export const permissions = ${permissionInitializer};
  export function hasProgress(permissions) {
    const phoneQuery = '', customRelationship = '', customRole = '';
    const searchedUser = null, selectedUser = null, qrPreview = null, selectedRelationship = null, selectedRole = null;
    return ${progressInitializer};
  }
`, {});
await test('new invitations enable viewing by default without false unsaved-change prompts', () => {
  assert.equal(invitationDefaults.permissions.can_view_logs, true);
  assert.equal(invitationDefaults.hasProgress(invitationDefaults.permissions), false);
  assert.equal(invitationDefaults.hasProgress({ ...invitationDefaults.permissions, can_view_logs: false }), true);
});
const { getConnectionHealthAccess } = evaluate(read('src/features/care-circle/health-access.ts'), {});
const connection = { requester_id: 7, addressee_id: 8, status: 'accepted', permissions: { can_view_logs: true }, addressee_can_view_logs: false };
await test('the requester sharing mine does not grant access to the addressee profile', () => {
  assert.deepEqual(getConnectionHealthAccess(connection, 7), { sharingMine: true, canViewTheirs: false });
});
await test('the addressee reads the requester only under the requester consent', () => {
  assert.deepEqual(getConnectionHealthAccess(connection, '8'), { sharingMine: false, canViewTheirs: true });
});
await test('separate reverse consent grants access in the other direction', () => {
  assert.equal(getConnectionHealthAccess({ ...connection, addressee_can_view_logs: true }, 7).canViewTheirs, true);
});
await test('unknown user, missing permissions, pending or deleted connection fail closed', () => {
  for (const value of [connection, { ...connection, status: 'pending' }, { ...connection, status: 'removed' }]) {
    assert.deepEqual(getConnectionHealthAccess(value, 9), { sharingMine: false, canViewTheirs: false });
  }
  assert.equal(getConnectionHealthAccess({ ...connection, permissions: {} }, 8).canViewTheirs, false);
  assert.equal(getConnectionHealthAccess({ ...connection, status: 'pending' }, 8).canViewTheirs, false);
});

class ApiError extends Error { constructor(code) { super('denied'); this.statusCode = code; } }
class FixedDate extends Date { constructor(...values) { super(...(values.length ? values : ['2026-10-05T12:00:00Z'])); } }
const report = { totalDays: 31, checkinDays: 1, statusDistribution: { fine: 1 }, sessions: [
  { id: 3, date: '2026-10-02', status: 'fine', severity: 'low', summary: 'Reported well', createdAt: '2026-10-02T08:00:00Z', messages: [] },
] };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function harness({ language = 'vi', loadReport, subjectName = 'Parent', multiplier = 1 } = {}) {
  let cursor = 0;
  const slots = [];
  let pending = [];
  const memo = (fn, deps) => {
    const index = cursor++;
    if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
      slots[index] = { deps, value: fn() };
    }
    return slots[index].value;
  };
  const hooks = {
    createElement: React.createElement, Fragment: React.Fragment,
    useMemo: memo,
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => {
        slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
      }];
    },
    useEffect: (fn, deps) => {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
        const old = slots[index];
        slots[index] = { deps };
        pending.push(() => { old?.cleanup?.(); slots[index].cleanup = fn(); });
      }
    },
  };
  const catalogs = Object.fromEntries(['tree', 'home', 'careCircle'].map(ns => [ns, JSON.parse(read(`src/i18n/locales/${language}/${ns}.json`))]));
  const translate = ns => (key, values = {}) => {
    const text = catalogs[ns][key]; assert.equal(typeof text, 'string', `${language}:${ns}:${key}`);
    return text.replace(/\{\{(\w+)\}\}/g, (_, part) => String(values[part] ?? ''));
  };
  const palette = { textPrimary: '#123456', textSecondary: '#456789', primary: '#008877', primaryDark: '#006655' };
  const typography = { size: { xxs: 12, xs: 14, sm: 16, md: 18, lg: 22 }, scaledSize: { sm: 16 * multiplier } };
  const selfCalls = [];
  const { HealthJournalCalendar } = evaluate(read('src/components/HealthJournalCalendar.tsx'), {
    react: { __esModule: true, default: hooks, ...hooks },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value, absoluteFill: {} } },
    'react-i18next': { useTranslation: ns => ({ t: translate(ns), i18n: { language } }) },
    '@expo/vector-icons': { Ionicons: 'Icon' }, 'expo-image': { Image: 'Image' },
    'react-native-svg': { __esModule: true, default: 'Svg', Line: 'Line', Path: 'Path', Rect: 'Rect' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34 }) },
    '../hooks/useScaledTypography': { useScaledTypography: () => typography },
    '../hooks/useThemeColors': { useThemeColors: () => ({ colors: palette, isDark: false }) },
    '../lib/apiClient': { ApiError }, './ScaledText': { ScaledText: 'Text' },
    '../styles': { spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }, radius: {}, shadows: {} },
    '../features/checkin/checkin.api': { checkinApi: { getReport: (...args) => { selfCalls.push(args); return Promise.resolve(report); } } },
  }, FixedDate);
  const render = () => {
    cursor = 0;
    const tree = HealthJournalCalendar({ loadReport, subjectName });
    const nodes = [];
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      nodes.push(node); visit(node.props?.children);
    };
    visit(tree);
    return nodes;
  };
  return { render, selfCalls, t: translate('tree'), tc: translate('careCircle'),
    effects: () => { const next = pending; pending = []; next.forEach(effect => effect()); },
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
  };
}
const text = nodes => nodes.filter(node => node.type === 'Text').map(node => node.props.children).join(' ');
for (const language of ['vi', 'en']) {
  await test(`${language}: the member calendar calls only the member API and opens day details`, async () => {
    const calls = [];
    const h = harness({ language, loadReport: month => { calls.push(month); return Promise.resolve(report); } });
    h.render(); h.effects(); await flush();
    let nodes = h.render();
    assert.deepEqual(calls, ['2026-10']); assert.deepEqual(h.selfCalls, []);
    assert.ok(text(nodes).includes(h.tc('memberSummaryFine', { name: 'Parent', fine: 1 })));
    const day = nodes.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === h.t('journalDayAccessibility', { day: 2, status: h.t('journalStatusFine') }));
    day.props.onPress(); nodes = h.render();
    assert.equal(nodes.find(node => node.type === 'Modal').props.visible, true);
    assert.ok(text(nodes).includes(h.tc('memberJournalReminder', { name: 'Parent' })));
    nodes.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === h.t('journalCloseDetails')).props.onPress();
    assert.equal(h.render().find(node => node.type === 'Modal').props.visible, false);
    h.unmount();
  });
  await test(`${language}: month buttons fetch an exact month and block future months`, async () => {
    const calls = [];
    const h = harness({ language, loadReport: month => { calls.push(month); return Promise.resolve(report); } });
    let nodes = h.render(); h.effects(); await flush();
    assert.equal(nodes.find(node => node.props?.accessibilityLabel === h.t('journalNextMonth')).props.disabled, true);
    nodes.find(node => node.props?.accessibilityLabel === h.t('journalPreviousMonth')).props.onPress();
    h.render(); h.effects(); await flush();
    assert.deepEqual(calls, ['2026-10', '2026-09']); h.unmount();
  });
}
await test('revoked consent clears old data and shows a permission explanation', async () => {
  let denied = false;
  const h = harness({ loadReport: () => denied ? Promise.reject(new ApiError(403)) : Promise.resolve(report) });
  h.render(); h.effects(); await flush();
  let nodes = h.render(); denied = true;
  nodes.find(node => node.props?.accessibilityLabel === h.t('journalPreviousMonth')).props.onPress();
  h.render(); h.effects(); await flush(); nodes = h.render();
  assert.ok(text(nodes).includes(h.tc('healthAccessRequired')));
  assert.ok(!text(nodes).includes(h.tc('memberSummaryFine', { name: 'Parent', fine: 1 })));
  assert.equal(nodes.find(node => node.type === 'Modal').props.visible, false); h.unmount();
});
await test('late results from a previous month cannot replace the current month', async () => {
  let oldResult;
  const h = harness({ loadReport: month => month === '2026-10' ? new Promise(resolve => { oldResult = resolve; }) : Promise.resolve({ ...report, checkinDays: 0, sessions: [] }) });
  let nodes = h.render(); h.effects();
  nodes.find(node => node.props?.accessibilityLabel === h.t('journalPreviousMonth')).props.onPress();
  h.render(); h.effects(); await flush(); oldResult(report); await flush(); nodes = h.render();
  assert.ok(text(nodes).includes(h.t('journalNoEntries')));
  assert.ok(!text(nodes).includes(h.tc('memberSummaryFine', { name: 'Parent', fine: 1 }))); h.unmount();
});
await test('large-font calendar keeps wrapping labels, plain icons and a scrollable detail sheet', async () => {
  const h = harness({ multiplier: 1.6, loadReport: () => Promise.resolve(report) });
  h.render(); h.effects(); await flush(); let nodes = h.render();
  const previous = nodes.find(node => node.props?.accessibilityLabel === h.t('journalPreviousMonth'));
  assert.equal(previous.props.style({ pressed: false })[0].backgroundColor, 'transparent');
  const legends = nodes.filter(node => node.type === 'Text' && node.props.style?.width === '100%');
  assert.ok(legends.length >= 5); assert.ok(legends.every(node => !node.props.numberOfLines && !node.props.adjustsFontSizeToFit));
  const day = nodes.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === h.t('journalDayAccessibility', { day: 2, status: h.t('journalStatusFine') }));
  day.props.onPress(); nodes = h.render();
  assert.ok(nodes.some(node => node.type === 'ScrollView')); h.unmount();
});
await test('the original personal calendar retains its own report API', async () => {
  const h = harness({ subjectName: '' }); h.render(); h.effects(); await flush();
  assert.deepEqual(h.selfCalls, [['month', '2026-10']]); h.unmount();
});
const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style ?? {};
for (const language of ['vi', 'en']) {
  await test(`${language}: QR actions keep aligned icon frames, readable text and both navigation callbacks`, () => {
    const catalog = JSON.parse(read(`src/i18n/locales/${language}/careCircle.json`));
    for (const [width, multiplier, expectedDirection] of [
      [320, 1, 'column'], [375, 1, 'row'], [390, 1, 'row'], [430, 1, 'row'],
      [390, 1.25, 'column'], [320, 1.25, 'column'], [768, 2, 'row'],
    ]) {
      for (const isDark of [false, true]) {
        const palette = { surface: isDark ? '#1a1d27' : '#ffffff', border: '#abcabc', primaryDark: '#087F73', textPrimary: '#123456', textSecondary: '#456789' };
        const { CareCircleQrActions } = evaluate(`import React from 'react';\n${read('src/features/care-circle/components/CareCircleQrActions.tsx')}`, {
          react: React,
          '@expo/vector-icons': { Ionicons: 'Icon' },
          'react-i18next': { useTranslation: () => ({ t: key => { assert.equal(typeof catalog[key], 'string'); return catalog[key]; } }) },
          'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width }) },
          '../../../components/ScaledText': { ScaledText: 'Text' },
          '../../../hooks/useScaledTypography': { useScaledTypography: () => ({ size: { sm: 15 }, scaledSize: { sm: Math.round(15 * multiplier) } }) },
          '../../../hooks/useThemeColors': { useThemeColors: () => ({ colors: palette }) },
          '../../../styles': { spacing: { sm: 8, md: 12, lg: 16 } },
        });
        const clicked = [];
        const row = CareCircleQrActions({ onShowQr: () => clicked.push('show'), onScanQr: () => clicked.push('scan') });
        const rowStyle = flatten(row.props.style);
        assert.equal(rowStyle.flexDirection, expectedDirection, `${width}px / ${multiplier}x`);
        assert.equal(rowStyle.alignItems, 'stretch');
        const buttons = row.props.children;
        assert.equal(buttons.length, 2);
        const normalStyles = buttons.map(button => flatten(button.props.style({ pressed: false })));
        assert.deepEqual(normalStyles[0], normalStyles[1]);
        const copyStyles = [];
        buttons.forEach((button, index) => {
          assert.equal(button.props.accessibilityRole, 'button');
          assert.equal(button.props.accessibilityLabel, catalog[index ? 'scanQr' : 'myQrTitle']);
          assert.equal(button.props.accessibilityHint, catalog[index ? 'scanQrShortHint' : 'myQrShortHint']);
          const buttonStyle = normalStyles[index];
          assert.ok(buttonStyle.minHeight >= 44);
          assert.equal(buttonStyle.height, undefined, 'Text must be allowed to grow');
          assert.equal(buttonStyle.backgroundColor, palette.surface);
          assert.equal(buttonStyle.flex, expectedDirection === 'row' ? 1 : 0);
          const [icon, copy] = button.props.children;
          assert.equal(icon.props.style.width, 32);
          assert.equal(icon.props.style.flexShrink, 0);
          assert.equal(icon.props.style.alignItems, 'center');
          assert.equal(icon.props.style.justifyContent, 'center');
          assert.equal(icon.props.importantForAccessibility, 'no-hide-descendants');
          assert.equal(icon.props.children.props.size, 28);
          assert.equal(icon.props.children.props.name, index ? 'scan-outline' : 'qr-code-outline');
          assert.equal(copy.props.style.minWidth, 0);
          assert.equal(copy.props.style.alignSelf, 'stretch');
          assert.equal(copy.props.style.justifyContent, 'center');
          const copyNodes = React.Children.toArray(copy.props.children);
          copyStyles.push(copyNodes.map(textNode => flatten(textNode.props.style)));
          copyNodes.forEach(textNode => {
            assert.equal(textNode.props.numberOfLines, undefined, 'Do not truncate QR labels');
            assert.equal(textNode.props.adjustsFontSizeToFit, undefined, 'Do not shrink labels');
          });
          assert.ok(copyStyles[index][0].fontSize >= 14);
          assert.equal(flatten(button.props.style({ pressed: true })).opacity, 0.8);
          button.props.onPress();
        });
        assert.deepEqual(copyStyles[0], copyStyles[1], 'Both cards use the same text metrics');
        assert.deepEqual(clicked, ['show', 'scan']);
      }
    }
  });
}
await test('global green plus launcher renders nothing and has no hidden interaction or API effects', () => {
  const { AsinuEmergencyFAB } = evaluate(read('asinu-brain-extension/ui/AsinuEmergencyFAB.tsx'), {});
  assert.equal(AsinuEmergencyFAB({ onInteraction: () => assert.fail('Hidden launcher must not interact') }), null);
});
for (const file of ['app/(tabs)/missions/index.tsx', 'app/(tabs)/tree/index.tsx', 'app/reminder-config/index.tsx']) {
  await test(`${file}: screen-specific green plus launcher and decorative remnants are removed`, () => {
    const source = read(file);
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const plusIcons = [];
    const plusNames = new Set(['add', 'add-circle', 'add-circle-outline', 'plus', 'plus-circle', 'plus-circle-outline']);
    const visit = node => {
      if (ts.isJsxAttribute(node) && node.name.getText(parsed) === 'name' && node.initializer && ts.isStringLiteral(node.initializer) && plusNames.has(node.initializer.text)) {
        plusIcons.push(node.initializer.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    assert.deepEqual(plusIcons, [], 'Screens must not recreate the retired floating green plus');
    assert.ok(!/\bfab(?:Wrap|Btn|Button|Sparkle\d)\b/.test(source), 'Remove unused FAB layout and sparkle styles too');
  });
}
console.log(`Care Circle health and QR actions: ${checks} runtime checks passed.`);
