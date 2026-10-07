import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';

const source = fs.readFileSync('app/checkin-call/settings.tsx', 'utf8');
const defaults = {
  enabled: false, checkin_time: '08:00:00', timezone: 'Asia/Ho_Chi_Minh',
  grace_hours: 6, user_timeout_seconds: 60, family_ring_seconds: 60,
  family_confirm_minutes: 10, max_rounds: 1,
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let checks = 0;
async function test(label, run) { await run(); checks++; console.log(`PASS ${label}`); }

// Run the real settings screen and its handlers with deterministic native adapters.
function harness({ language = 'vi', settings = defaults, contacts = [], status, save, width = 390, fontScale = 'normal' } = {}) {
  let cursor = 0;
  let focused = true;
  let pending = [];
  const slots = [];
  const appStateListeners = new Set();
  const server = { settings: { ...settings }, contacts, status: status || { callCenterEnabled: true } };
  const calls = { settings: 0, saves: [], back: 0, pushes: [], replacements: [], toasts: [] };
  const memo = (fn, deps) => {
    const index = cursor++;
    if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
      slots[index] = { deps, value: fn() };
    }
    return slots[index].value;
  };
  const hooks = {
    createElement: React.createElement, Fragment: React.Fragment,
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => {
        slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
      }];
    },
    useRef: initial => {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: { current: initial } };
      return slots[index].value;
    },
    useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect: (fn, deps) => {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
        const previous = slots[index];
        slots[index] = { deps };
        pending.push(() => { previous?.cleanup?.(); slots[index].cleanup = fn(); });
      }
    },
  };
  const translations = Object.fromEntries(['checkinCall', 'common'].map(namespace => {
    const catalog = JSON.parse(fs.readFileSync(`src/i18n/locales/${language}/${namespace}.json`, 'utf8'));
    return [namespace, (key, values = {}) => {
      const text = key.split('.').reduce((value, part) => value?.[part], catalog);
      assert.equal(typeof text, 'string', `${language}:${namespace}:${key}`);
      return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
    }];
  }));
  const imports = {
    react: { __esModule: true, default: hooks, ...hooks },
    'react-native': {
      ActivityIndicator: 'Spinner', Pressable: 'Button', ScrollView: 'ScrollView', Switch: 'Switch', View: 'View',
      StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width }),
      AppState: { addEventListener: (_event, listener) => {
        appStateListeners.add(listener);
        return { remove: () => appStateListeners.delete(listener) };
      } },
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/hooks/useGuardedRouter': {
      useGuardedRouter: () => ({ back: () => calls.back++, push: route => calls.pushes.push(route),
        replace: route => calls.replacements.push(route), canGoBack: () => true }),
    },
    'expo-router': {
      useRouter: () => ({ back: () => calls.back++, push: route => calls.pushes.push(route),
        replace: route => calls.replacements.push(route), canGoBack: () => true }),
      useFocusEffect: callback => {
        const index = cursor++;
        const previous = slots[index];
        if (!previous || previous.callback !== callback) {
          slots[index] = { kind: 'focus', callback };
          pending.push(() => {
            previous?.cleanup?.();
            if (focused) slots[index].cleanup = callback();
          });
        }
      },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    'react-i18next': { useTranslation: namespace => ({ t: translations[namespace] }) },
    '../../src/components/AppAlertModal': { AppAlertModal: 'AppModal' },
    '../../src/components/ScaledText': { ScaledText: 'Text' },
    '../../src/features/checkin-call/AndroidCallAccessCard': { AndroidCallAccessCard: 'AndroidAccessCard' },
    '../../src/stores/font-size.store': { useFontSizeStore: selector => selector({ scale: fontScale }) },
    '../../src/stores/toast.store': { showToast: (...args) => calls.toasts.push(args) },
    '../../src/lib/apiClient': { apiClient: async path => {
      assert.equal(path, '/api/subscriptions/status');
      if (server.status instanceof Error) throw server.status;
      return server.status;
    }, getApiErrorMessage: error => error.message },
    '../../src/features/checkin-call/checkin-call.api': { checkinCallApi: {
      settings: async () => {
        calls.settings++;
        return { ok: true, settings: { ...server.settings }, contacts: server.contacts };
      },
      saveSettings: async value => {
        calls.saves.push({ ...value });
        if (save) return save(value);
        server.settings = { ...value };
        return { ok: true, settings: { ...value } };
      },
    } },
  };
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
  } }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    assert.ok(id in imports, `Missing settings adapter ${id}`);
    return imports[id];
  });
  const render = () => {
    cursor = 0;
    const tree = module.exports.default();
    const nodes = [];
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      nodes.push(node); visit(node.props?.children);
    };
    visit(tree);
    return nodes;
  };
  const effects = () => { const next = pending; pending = []; next.forEach(effect => effect()); };
  const h = {
    render, server, calls, t: translations.checkinCall,
    text: () => render().filter(node => node.type === 'Text').map(node => node.props.children).join(' '),
    button: key => render().find(node => node.type === 'Button' && node.props.accessibilityLabel === translations.checkinCall(key)),
    toggle: () => render().find(node => node.type === 'Switch'),
    modal: () => render().find(node => node.type === 'AppModal' && node.props.visible),
    confirmWarning: () => {
      const modal = h.modal(); assert.ok(modal, 'The no-relative warning must be shown');
      modal.props.onDismiss(); return modal.props.buttons[0].onPress?.();
    },
    enable: () => {
      h.toggle().props.onValueChange(true);
      if (h.modal()) h.confirmWarning();
    },
    settle: async () => { render(); effects(); await flush(); return render(); },
    blur: () => { focused = false; slots.filter(slot => slot.kind === 'focus').forEach(slot => { slot.cleanup?.(); slot.cleanup = null; }); },
    focus: async () => {
      focused = true;
      slots.filter(slot => slot.kind === 'focus').forEach(slot => { slot.cleanup = slot.callback(); });
      await flush(); return render();
    },
    resume: async () => { appStateListeners.forEach(listener => listener('active')); return h.settle(); },
    unmount: () => { focused = false; slots.forEach(slot => slot.cleanup?.()); },
  };
  return h;
}

for (const language of ['vi', 'en']) {
  await test(`${language}: Save rejects unchanged settings and returns to disabled after reverting a toggle`, async () => {
    const h = harness({ language, contacts: [{ id: 1, name: 'Family' }] }); await h.settle();
    const initial = h.button('saveSettings'); assert.equal(initial.props.disabled, true);
    await initial.props.onPress(); assert.equal(h.calls.saves.length, 0);
    h.toggle().props.onValueChange(true); assert.equal(h.button('saveSettings').props.disabled, false);
    h.toggle().props.onValueChange(false); assert.equal(h.button('saveSettings').props.disabled, true);
    await h.button('saveSettings').props.onPress(); assert.equal(h.calls.saves.length, 0); h.unmount();
  });
  await test(`${language}: empty contacts never make the draft switch inert, and setup has a working route`, async () => {
    const h = harness({ language }); await h.settle();
    assert.equal(h.toggle().props.disabled, false);
    assert.equal(h.button('saveSettings').props.disabled, true);
    h.toggle().props.onValueChange(true);
    assert.equal(h.toggle().props.value, false, 'Warning needs explicit confirmation, not a disabled switch');
    assert.equal(h.modal().props.message, h.t('noContactsWarning.body'));
    assert.equal(h.modal().props.queued, true);
    assert.equal(h.modal().props.stackButtons, true);
    assert.equal(h.modal().props.scrollable, true);
    h.confirmWarning();
    assert.equal(h.toggle().props.value, true);
    assert.equal(h.button('saveSettings').props.disabled, false);
    h.button('manageCareCircle').props.onPress();
    assert.deepEqual(h.calls.pushes, ['/care-circle']); h.unmount();
  });
  await test(`${language}: successful save sends the edited draft and leaves only after success`, async () => {
    const h = harness({ language, contacts: [{ id: 8, name: 'Relative' }] }); await h.settle();
    h.enable();
    await h.button('saveSettings').props.onPress();
    assert.equal(h.calls.saves[0].enabled, true);
    assert.equal(h.calls.saves[0].checkin_time, '08:00');
    assert.equal(h.calls.back, 1);
    assert.deepEqual(h.calls.toasts.at(-1), [h.t('savedSettings'), 'success']);
    assert.equal(h.button('saveSettings').props.disabled, true); h.unmount();
  });
  await test(`${language}: empty cached contacts do not prevent saving when backend eligibility has changed`, async () => {
    const h = harness({ language }); await h.settle();
    h.enable();
    const button = h.button('saveSettings'); assert.equal(button.props.disabled, false);
    await button.props.onPress(); assert.equal(h.calls.saves.length, 1); assert.equal(h.calls.back, 1); h.unmount();
  });
  await test(`${language}: failed save preserves the draft, shows the backend reason, and supports retry`, async () => {
    let attempts = 0;
    const reason = language === 'vi' ? 'Cần bật thông báo để nhận cuộc gọi.' : 'Enable notifications to receive calls.';
    const h = harness({ language, save: async value => {
      if (attempts++ === 0) throw new Error(reason);
      return { ok: true, settings: value };
    } }); await h.settle();
    h.enable(); await h.button('saveSettings').props.onPress();
    assert.equal(h.calls.back, 0); assert.equal(h.toggle().props.value, true);
    assert.deepEqual(h.calls.toasts.at(-1), [reason, 'error', 5000]);
    assert.ok(!h.text().includes(reason)); assert.equal(h.button('saveSettings').props.disabled, false);
    await h.button('saveSettings').props.onPress(); assert.equal(h.calls.back, 1); h.unmount();
  });
}
for (const language of ['vi', 'en']) {
  await test(`${language}: cancelling the empty-circle warning leaves the configuration unchanged`, async () => {
    const h = harness({ language }); await h.settle(); h.toggle().props.onValueChange(true);
    const modal = h.modal(); modal.props.onDismiss(); modal.props.buttons[2].onPress?.();
    assert.equal(h.toggle().props.value, false); assert.equal(h.button('saveSettings').props.disabled, true);
    assert.deepEqual(h.calls.saves, []); assert.deepEqual(h.calls.toasts, []); h.unmount();
  });
  await test(`${language}: an enabled schedule can be edited and saved while the circle stays empty`, async () => {
    const h = harness({ language, settings: { ...defaults, enabled: true } }); await h.settle();
    h.button('checkinTime').props.onPress();
    const increase = h.render().find(node => node.type === 'Button' && node.props.accessibilityLabel === h.t('increaseValue', { label: h.t('checkinTime') }));
    increase.props.onPress({ stopPropagation() {} });
    assert.equal(h.modal(), undefined); await h.button('saveSettings').props.onPress();
    assert.equal(h.calls.saves[0].enabled, true); assert.equal(h.calls.saves[0].checkin_time, '08:30');
    assert.deepEqual(h.calls.toasts.at(-1), [h.t('savedSettings'), 'success']); h.unmount();
  });
}
await test('returning from Care Circle refreshes contacts without dropping an unsaved schedule', async () => {
  const h = harness(); await h.settle();
  h.enable();
  h.button('checkinTime').props.onPress();
  const increase = h.render().find(node => node.type === 'Button' && node.props.accessibilityLabel === h.t('increaseValue', { label: h.t('checkinTime') }));
  increase.props.onPress({ stopPropagation() {} });
  h.blur(); h.server.contacts = [{ id: 8, name: 'New relative' }]; await h.focus();
  assert.equal(h.calls.settings, 2); assert.ok(h.text().includes('New relative'));
  assert.equal(h.toggle().props.value, true); await h.button('saveSettings').props.onPress();
  assert.equal(h.calls.saves[0].checkin_time, '08:30'); h.unmount();
});
await test('manual refresh and returning from background both recheck eligibility', async () => {
  const h = harness(); await h.settle();
  h.server.contacts = [{ id: 8, name: 'Refreshed relative' }];
  h.button('refreshContacts').props.onPress(); await h.settle();
  assert.ok(h.text().includes('Refreshed relative')); assert.equal(h.calls.settings, 2);
  await h.resume(); assert.equal(h.calls.settings, 3); h.unmount();
});
await test('duplicate taps cannot send two saves before React updates the busy state', async () => {
  let complete;
  const h = harness({ save: value => new Promise(resolve => { complete = () => resolve({ ok: true, settings: value }); }) });
  await h.settle(); h.enable();
  const press = h.button('saveSettings').props.onPress;
  const first = press(); const second = press();
  assert.equal(h.calls.saves.length, 1); assert.equal(h.button('saveSettings').props.disabled, true);
  assert.equal(h.toggle().props.disabled, true); complete(); await Promise.all([first, second]); h.unmount();
});
await test('expired subscription still blocks configuration with the app modal', async () => {
  const h = harness({ status: { isAnTam: false, callCenterEnabled: false } }); await h.settle();
  assert.equal(h.calls.settings, 0); assert.ok(h.render().some(node => node.type === 'AppModal'));
  h.unmount();
});
await test('a failed refresh cannot save under an unknown entitlement and can recover', async () => {
  const h = harness(); await h.settle(); h.enable();
  h.server.status = new Error('Offline'); h.button('refreshContacts').props.onPress(); await h.settle();
  assert.equal(h.button('saveSettings').props.disabled, true); assert.equal(h.calls.saves.length, 0);
  assert.deepEqual(h.calls.toasts.at(-1), ['Offline', 'error', 5000]);
  assert.ok(!h.text().includes('Offline'));
  h.server.status = { callCenterEnabled: true }; h.button('refreshContacts').props.onPress(); await h.settle();
  assert.equal(h.button('saveSettings').props.disabled, false); h.unmount();
});
await test('large text keeps setup actions readable with accessible touch targets', async () => {
  const h = harness({ width: 320, fontScale: 'xlarge' }); await h.settle();
  for (const key of ['manageCareCircle', 'refreshContacts']) {
    const button = h.button(key); assert.ok(button.props.style.minHeight >= 44);
    assert.equal(button.props.children[1].props.numberOfLines, undefined);
  }
  const row = h.button('checkinTime'); assert.equal(row.props.style[1].flexDirection, 'column'); h.unmount();
});
await test('a failed initial settings load uses a toast and a neutral retry state, never a red error paragraph', async () => {
  const h = harness({ status: new Error('Offline') }); await h.settle();
  assert.deepEqual(h.calls.toasts.at(-1), ['Offline', 'error', 5000]); assert.ok(!h.text().includes('Offline'));
  assert.ok(h.text().includes(h.t('settingsLoadFailed'))); assert.equal(h.calls.back, 0); h.unmount();
});
await test('leaving settings before a save finishes cannot show a success toast or navigate another screen', async () => {
  let complete; const h = harness({ save: value => new Promise(resolve => { complete = () => resolve({ ok: true, settings: value }); }) });
  await h.settle(); h.enable(); const save = h.button('saveSettings').props.onPress();
  h.unmount(); complete(); await save; assert.equal(h.calls.back, 0); assert.deepEqual(h.calls.toasts, []);
});
console.log(`Check-in call settings: ${checks} runtime checks passed.`);
