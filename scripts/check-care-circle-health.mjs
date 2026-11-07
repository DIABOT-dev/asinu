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
  const props = { loadReport, subjectName };
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
    const tree = HealthJournalCalendar(props);
    const nodes = [];
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      nodes.push(node); visit(node.props?.children);
    };
    visit(tree);
    return nodes;
  };
  return { render, props, selfCalls, t: translate('tree'), tc: translate('careCircle'),
    effects: () => { const next = pending; pending = []; next.forEach(effect => effect()); },
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
  };
}
const text = nodes => nodes.filter(node => node.type === 'Text').map(node => node.props.children).join(' ');
const checkinDay = (nodes, h) => nodes.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === h.t('journalDayAccessibility', { day: 2, status: h.t('journalStatusFine') }));
for (const language of ['vi', 'en']) {
  await test(`${language}: initial loading reserves the calendar grid without calling days missing or showing empty summaries`, async () => {
    let finish;
    const h = harness({ language, loadReport: () => new Promise(resolve => { finish = resolve; }) });
    const first = h.render();
    assert.equal(first.filter(node => node.props?.testID === 'journal-day-loading').length, 31);
    assert.equal(first.some(node => node.type === 'Pressable' && node.props.accessibilityLabel?.includes(h.t('journalStatusMissing'))), false);
    assert.equal(text(first).includes(h.t('journalNoCheckin')), false);
    assert.equal(text(first).includes(h.t('journalNoEntries')), false);
    h.effects(); finish(report); await flush();
    assert.ok(checkinDay(h.render(), h)); h.unmount();
  });
}
await test('background calendar refresh preserves the loaded days and the open day sheet until fresh data arrives', async () => {
  let finish, refreshing = false;
  const h = harness({ loadReport: () => refreshing ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(report) });
  h.render(); h.effects(); await flush();
  checkinDay(h.render(), h).props.onPress();
  refreshing = true; h.props.refreshKey = 1;
  assert.ok(checkinDay(h.render(), h)); h.effects();
  let nodes = h.render();
  assert.ok(checkinDay(nodes, h));
  assert.equal(nodes.find(node => node.type === 'Modal').props.visible, true);
  assert.equal(nodes.filter(node => node.props?.testID === 'journal-day-loading').length, 0);
  finish({ ...report, sessions: [{ ...report.sessions[0], summary: 'Fresh fixture detail' }] });
  await flush(); nodes = h.render();
  assert.ok(text(nodes).includes('Fresh fixture detail'));
  assert.equal(nodes.find(node => node.type === 'Modal').props.visible, true); h.unmount();
});
await test('a failed background update keeps existing entries with an honest retry notice', async () => {
  let failure;
  const h = harness({ loadReport: () => failure ? Promise.reject(failure) : Promise.resolve(report) });
  h.render(); h.effects(); await flush();
  failure = new Error('fixture offline'); h.props.refreshKey = 1;
  h.render(); h.effects(); await flush();
  let nodes = h.render(); assert.ok(checkinDay(nodes, h));
  assert.ok(text(nodes).includes(h.t('journalRefreshError')));
  assert.equal(text(nodes).includes(h.t('journalNoCheckin')), false);
  failure = null;
  nodes.find(node => node.type === 'Pressable' && text(flattenElements(node)).includes(h.t('journalRetry'))).props.onPress();
  h.render(); h.effects(); await flush(); nodes = h.render();
  assert.ok(checkinDay(nodes, h)); assert.equal(text(nodes).includes(h.t('journalRefreshError')), false); h.unmount();
});
for (const status of [401, 403, 404]) {
  await test(`${status}: access loss clears cached calendar data and the open day sheet`, async () => {
    let denied = false;
    const h = harness({ loadReport: () => denied ? Promise.reject(new ApiError(status)) : Promise.resolve(report) });
    h.render(); h.effects(); await flush(); checkinDay(h.render(), h).props.onPress();
    denied = true; h.props.refreshKey = 1;
    h.render(); h.effects(); await flush(); const nodes = h.render();
    assert.equal(checkinDay(nodes, h), undefined);
    assert.ok(text(nodes).includes(h.tc('healthAccessRequired')));
    assert.equal(text(nodes).includes(h.t('journalNoCheckin')), false);
    assert.equal(nodes.find(node => node.type === 'Modal').props.visible, false); h.unmount();
  });
}
await test('changing the calendar patient hides previous data before effects and rejects a late previous-patient response', async () => {
  let finish, refreshing = false;
  const h = harness({ loadReport: () => refreshing ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(report) });
  h.render(); h.effects(); await flush();
  refreshing = true; h.props.refreshKey = 1; h.render(); h.effects();
  h.props.loadReport = () => Promise.resolve({ ...report, checkinDays: 0, sessions: [], statusDistribution: {} });
  let nodes = h.render();
  assert.equal(checkinDay(nodes, h), undefined);
  assert.equal(nodes.filter(node => node.props?.testID === 'journal-day-loading').length, 31);
  h.effects(); await flush(); finish(report); await flush(); nodes = h.render();
  assert.equal(checkinDay(nodes, h), undefined);
  assert.ok(text(nodes).includes(h.t('journalNoEntries'))); h.unmount();
});
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
function flattenElements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(flattenElements);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...flattenElements(tree.props?.children)];
}
const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style ?? {};
for (const language of ['vi', 'en']) {
  await test(`${language}: connection shortcuts share the Home tile, open the correct action and expose the member count`, () => {
    const catalog = JSON.parse(read(`src/i18n/locales/${language}/careCircle.json`));
    const t = (key, values = {}) => {
      assert.equal(typeof catalog[key], 'string', `${language}/${key}`);
      return catalog[key].replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
    };
    for (const width of [320, 390, 768]) for (const isDark of [false, true]) for (const fontScale of [1, 1.5]) {
      const clicked = [], palette = { textPrimary: '#213B35', primaryText: '#0F766E', primaryLight: '#E6FAF8', surface: '#FEFFFE', border: '#E7F0EC' };
      const { QuickActionTile } = evaluate(read('src/components/QuickActionTile.tsx'), {
        react: React, 'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: value => value } },
        './ScaledText': { ScaledText: 'Text' }, '../hooks/useThemeColors': { useThemeColors: () => ({ colors: palette, isDark }) },
      });
      const { CareCircleQuickActions } = evaluate(read('src/features/care-circle/components/CareCircleQuickActions.tsx'), {
        react: React, 'react-native': { View: 'View', Image: 'Image', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width, fontScale }) },
        '@expo/vector-icons': { Ionicons: 'Icon' }, 'react-i18next': { useTranslation: () => ({ t }) },
        '../../../components/QuickActionTile': { QuickActionTile },
        '../../../hooks/useThemeColors': { useThemeColors: () => ({ colors: palette, isDark }) },
        '../../../stores/font-size.store': { useFontSizeStore: select => select({ multiplier: 1.25 }) },
        '../../guidance/GuidanceProvider': { GuideTarget: 'GuideTarget' },
      });
      const expand = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(expand)
        : typeof node.type === 'function' ? expand(node.type(node.props))
          : [node, ...expand(typeof node.props?.children === 'function' ? node.props.children({ pressed: false }) : node.props?.children)];
      const props = { count: 3, expanded: false, onInvite: () => clicked.push('invite'), onScan: () => clicked.push('scan'), onToggleMembers: () => { props.expanded = !props.expanded; clicked.push('members'); } };
      let tree = CareCircleQuickActions(props), nodes = expand(tree);
      const buttons = nodes.filter(node => node.type === 'Pressable');
      assert.equal(buttons.length, 3); buttons.forEach(button => button.props.onPress());
      assert.deepEqual(clicked, ['invite', 'scan', 'members']);
      tree = CareCircleQuickActions(props); nodes = expand(tree);
      const members = nodes.find(node => node.props?.testID === 'care-circle-members-action');
      assert.equal(members.props.accessibilityLabel, t('activeConnections', { count: 3 }));
      assert.equal(members.props.accessibilityState.expanded, true);
      assert.ok(nodes.some(node => node.type === 'Text' && node.props.children === 3));
      const tiles = React.Children.toArray(tree.props.children);
      const columns = fontScale === 1 ? 3 : 2;
      assert.ok(tiles.every(tile => flatten(tile.props.style).width >= 64));
      assert.ok(Math.abs(flatten(tiles[1].props.style).width * columns + 12 * (columns - 1) - Math.min(width - 32, 420)) < 0.01);
      assert.ok(nodes.some(node => node.type === 'GuideTarget' && node.props.step === 'circle.add'));
      assert.ok(nodes.filter(node => node.type === 'Text').every(node => !node.props.numberOfLines));
      assert.equal(nodes.some(node => node.type === 'QRCode'), false, 'The personal QR stays in its existing section');
    }
  });
}
for (const language of ['vi', 'en']) {
  await test(`${language}: connection QR is visible immediately, with a save action and retry on failure`, () => {
    const catalogs = Object.fromEntries(['careCircle', 'common'].map(ns => [ns, JSON.parse(read(`src/i18n/locales/${language}/${ns}.json`))]));
    for (const width of [320, 375, 390, 768]) {
      for (const isDark of [false, true]) {
        const palette = { primaryDark: '#087F73', primaryText: '#087F73', textPrimary: '#123456', textSecondary: '#456789' };
        let current = { qr: { value: 'asinu-lite://care-circle/scan?token=owner' }, loading: false, error: '', loadCode: () => clicked.push('retry') };
        const { CareCircleQrActions } = evaluate(read('src/features/care-circle/components/CareCircleQrActions.tsx'), {
          react: React,
          '@expo/vector-icons': { Ionicons: 'Icon' },
          'react-i18next': { useTranslation: ns => ({ t: key => { assert.equal(typeof catalogs[ns][key], 'string'); return catalogs[ns][key]; } }) },
          'react-native': { View: 'View', Pressable: 'Pressable', ActivityIndicator: 'Spinner', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width }) },
          'react-native-qrcode-svg': { __esModule: true, default: 'QRCode' },
          '../../../components/ScaledText': { ScaledText: 'Text' },
          '../../../hooks/useThemeColors': { useThemeColors: () => ({ colors: palette, isDark }) },
          '../../../styles': { spacing: { sm: 8, md: 12, lg: 16 } },
          '../../auth/auth.store': { useAuthStore: selector => selector({ profile: { name: 'Owner' } }) },
          '../useCareCircleQr': { useCareCircleQr: () => current },
          '../useSaveCareCircleQr': { useSaveCareCircleQr: () => ({ image: { current: null }, saving: false, save: () => clicked.push('save'), alertState: {}, dismissAlert: () => {} }) },
          '../../../components/AppAlertModal': { AppAlertModal: 'AppAlertModal' },
        });
        const clicked = [];
        const render = () => flattenElements(CareCircleQrActions());
        let rendered = render();
        const qr = rendered.find(node => node.type === 'QRCode');
        assert.equal(qr.props.value, current.qr.value);
        assert.ok(qr.props.size >= 248 && qr.props.size + qr.props.quietZone * 2 <= width - 32);
        assert.equal(qr.props.backgroundColor, '#ffffff');
        assert.equal(qr.props.color, '#0f172a');
        assert.equal(rendered.filter(node => node.type === 'Pressable').length, 1, 'The only QR action is saving; scanning belongs in the screen header');
        assert.ok(rendered.some(node => node.type === 'Text' && node.props.children === catalogs.careCircle.myQrTitle));
        rendered.find(node => node.props?.accessibilityLabel === catalogs.careCircle.qrSaveToPhotos).props.onPress();
        assert.deepEqual(clicked.splice(0), ['save']);
        assert.equal(rendered.some(node => node.type === 'Text' && ['QR', catalogs.careCircle.myQrDescription, catalogs.careCircle.headerSubtitle].includes(node.props.children)), false);
        for (const label of rendered.filter(node => node.type === 'Text')) assert.equal(label.props.numberOfLines, undefined);
        current = { ...current, qr: null, error: 'offline' }; rendered = render();
        assert.equal(rendered.some(node => node.type === 'QRCode'), false);
        const retry = rendered.find(node => node.type === 'Pressable' && flattenElements(node).some(child => child.type === 'Text' && child.props.children === catalogs.common.retry));
        retry.props.onPress(); assert.deepEqual(clicked, ['retry']);
        current = { ...current, loading: true }; rendered = render();
        assert.ok(rendered.some(node => node.type === 'Spinner'));
        assert.equal(rendered.some(node => node.type === 'QRCode'), false);
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
