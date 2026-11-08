import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';

const flush = async () => {
  for (let index = 0; index < 16; index++) await Promise.resolve();
};
const evaluate = (source, imports = {}) => {
  const module = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;
  // Evaluate the actual screen handlers with deterministic native adapters.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(
    module,
    module.exports,
    (id) => {
      assert.ok(id in imports, `Missing voice settings adapter: ${id}`);
      return imports[id];
    }
  );
  return module.exports;
};
const preferences = evaluate(
  fs.readFileSync('src/features/checkin-call/voice-preferences.ts', 'utf8')
);
const source = fs.readFileSync('app/checkin-call/voice-settings.tsx', 'utf8');
let checks = 0;
const test = async (label, run) => {
  await run();
  checks++;
  console.log(`PASS ${label}`);
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};

function harness({
  language = 'vi',
  value = preferences.VOICE_DEFAULTS,
  load,
  save,
  permission = 'granted',
  locate,
  token = 'test-session',
  hydrated = true,
  id = '7',
  width = 393,
  fontScale = 1,
  multiplier = 1,
} = {}) {
  const slots = [];
  let cursor = 0,
    pending = [],
    live = true;
  const session = { token, hydrated, profile: { id } };
  const calls = {
    loads: 0,
    saves: [],
    back: 0,
    permissions: 0,
    locations: 0,
    source: [],
    toasts: [],
  };
  const memo = (fn, deps) => {
    const index = cursor++;
    if (
      !slots[index] ||
      deps.some((v, i) => !Object.is(v, slots[index].deps[i]))
    )
      slots[index] = { deps, value: fn() };
    return slots[index].value;
  };
  const hooks = {
    createElement: React.createElement,
    Fragment: React.Fragment,
    useState: (initial) => {
      const index = cursor++;
      if (!slots[index])
        slots[index] = {
          value: typeof initial === 'function' ? initial() : initial,
        };
      return [
        slots[index].value,
        (next) => {
          assert.ok(live, 'Never update a dismissed or unmounted screen');
          slots[index].value =
            typeof next === 'function' ? next(slots[index].value) : next;
        },
      ];
    },
    useRef: (initial) => {
      const index = cursor++;
      return (slots[index] ||= { value: { current: initial } }).value;
    },
    useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect: (fn, deps) => {
      const index = cursor++;
      if (
        !slots[index] ||
        deps.some((v, i) => !Object.is(v, slots[index].deps[i]))
      ) {
        const previous = slots[index];
        slots[index] = { deps };
        pending.push(() => {
          previous?.cleanup?.();
          slots[index].cleanup = fn();
        });
      }
    },
  };
  const translations = Object.fromEntries(
    ['checkinCall', 'common'].map((namespace) => {
      const catalog = JSON.parse(
        fs.readFileSync(
          `src/i18n/locales/${language}/${namespace}.json`,
          'utf8'
        )
      );
      return [
        namespace,
        (key) => {
          const result = key
            .split('.')
            .reduce((part, name) => part?.[name], catalog);
          assert.equal(
            typeof result,
            'string',
            `${language}:${namespace}:${key}`
          );
          return result;
        },
      ];
    })
  );
  const useAuthStore = (selector) => selector(session);
  useAuthStore.getState = () => session;
  const imports = {
    react: { __esModule: true, default: hooks, ...hooks },
    'react-native': {
      ActivityIndicator: 'Spinner',
      Pressable: 'Button',
      ScrollView: 'ScrollView',
      Switch: 'Switch',
      View: 'View',
      StyleSheet: { create: (v) => v },
      Linking: { openURL: async (url) => calls.source.push(url) },
      useWindowDimensions: () => ({ width, fontScale }),
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/hooks/useGuardedRouter': { useGuardedRouter: () => ({ back: () => calls.back++ }) },
    'expo-router': {
      Redirect: 'Redirect',
      useRouter: () => ({ back: () => calls.back++ }),
      useFocusEffect: (fn) => hooks.useEffect(fn, [fn]),
    },
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => ({ top: 59, bottom: 34 }),
    },
    'react-i18next': {
      useTranslation: (namespace) => ({ t: translations[namespace] }),
    },
    'expo-location': {
      Accuracy: { Low: 'low' },
      requestForegroundPermissionsAsync: async () => {
        calls.permissions++;
        return { status: permission };
      },
      getCurrentPositionAsync: async (options) => {
        calls.locations++;
        assert.deepEqual(options, { accuracy: 'low' });
        return locate
          ? locate()
          : { coords: { latitude: 10.762622, longitude: 106.660172 } };
      },
    },
    '../../src/components/ScaledText': { ScaledText: 'Text' },
    '../../src/components/AppAlertModal': { AppAlertModal: 'AppModal' },
    '../../src/components/QuickActionTile': { QuickActionTile: 'ActionTile' },
    '../../src/stores/font-size.store': { useFontSizeStore: select => select({ multiplier }) },
    '../../src/stores/toast.store': { showToast: (...args) => calls.toasts.push(args) },
    '../../src/features/auth/auth.store': { useAuthStore },
    '../../src/features/checkin-call/voice-preferences': preferences,
    '../../src/features/checkin-call/checkin-call.api': {
      checkinCallApi: {
        voicePreferences: async () => {
          calls.loads++;
          return load ? load() : { ok: true, preferences: { ...value } };
        },
        saveVoicePreferences: async (draft) => {
          calls.saves.push(structuredClone(draft));
          return save ? save(draft) : { ok: true, preferences: draft };
        },
      },
    },
    '../../src/lib/apiClient': { getApiErrorMessage: (error) => error.message },
    '../../src/lib/native-permissions': { runNativePermission: operation => operation() },
    '../../src/styles': { colors: {} },
    '../../src/hooks/useThemeColors': { useThemeColors: () => ({}) },
  };
  const module = evaluate(source, imports);
  const render = (route = false) => {
    cursor = 0;
    const tree = route
      ? module.default()
      : module.VoiceSettings({ userId: '7' });
    const nodes = [];
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      nodes.push(node);
      visit(node.props?.children);
    };
    visit(tree);
    return nodes;
  };
  const effects = () => {
    const next = pending;
    pending = [];
    next.forEach((fn) => fn());
  };
  const h = {
    render,
    calls,
    session,
    t: translations.checkinCall,
    openSection: section => {
      const action = render().find(node => node.type === 'ActionTile' && node.props.testID === `voice-action-${section}`);
      if (action && !action.props.expanded) action.props.onPress();
    },
    button: key => {
      if (key.startsWith('personalization.address.')) h.openSection('address');
      if (key.startsWith('personalization.regions.') || ['personalization.useLocation', 'personalization.weatherSource'].includes(key)) h.openSection('weather');
      return render().find(node => node.type === 'Button' && node.props.accessibilityLabel === translations.checkinCall(key));
    },
    toggle: field => {
      const find = () => render().find(node => node.type === 'Switch' && node.props.accessibilityLabel === translations.checkinCall(`personalization.${field}`));
      if (!find()) h.openSection('permissions');
      return find();
    },
    modal: () => render().find((node) => node.type === 'AppModal'),
    text: () =>
      render()
        .filter((node) => node.type === 'Text')
        .map((node) => node.props.children)
        .join(' '),
    settle: async () => {
      render();
      effects();
      await flush();
      return render();
    },
    retry: () => render().find(node => node.type === 'Button' && node.props.accessibilityLabel === translations.common('retry')),
    acceptConsent: async (agree = true) => {
      const modal = h.modal();
      assert.equal(modal.props.visible, true);
      modal.props.onDismiss();
      if (agree) await modal.props.buttons[1].onPress();
    },
    consent: async (field, agree = true) => {
      h.toggle(field).props.onValueChange(true);
      await h.acceptConsent(agree);
    },
    chooseRegion: async (region, agree = true) => {
      const work = h.button(`personalization.regions.${region}`).props.onPress();
      if (h.modal().props.visible) await h.acceptConsent(agree);
      else await work;
    },
    useLocation: async () => {
      const work = h.button('personalization.useLocation').props.onPress();
      if (h.modal().props.visible) await h.acceptConsent();
      else await work;
    },
    unmount: () => {
      slots.forEach((slot) => slot.cleanup?.());
      live = false;
    },
  };
  return h;
}

for (const language of ['vi', 'en']) {
  await test(`${language}: action groups start collapsed without writes, permission prompts or a Save button`, async () => {
    const h = harness({ language }); await h.settle();
    const actions = h.render().filter(node => node.type === 'ActionTile');
    assert.deepEqual(actions.map(node => node.props.label), ['permissions', 'address', 'weather'].map(section => h.t(`personalization.sections.${section}`)));
    assert.ok(actions.every(node => node.props.expanded === false));
    assert.equal(h.render().filter(node => node.type === 'Switch' || node.props.accessibilityRole === 'radio').length, 0);
    for (const field of ['use_name', 'use_health', 'weather_enabled']) assert.equal(h.toggle(field).props.value, false);
    assert.equal(h.render().filter(node => node.type === 'Switch').length, 3);
    assert.equal(h.calls.permissions, 0); assert.equal(h.calls.locations, 0);
    assert.deepEqual(h.calls.saves, []); assert.deepEqual(h.calls.toasts, []);
    assert.ok(!h.text().includes(language === 'vi' ? 'Lưu cách cá nhân hóa' : 'Save personalization'));
    h.unmount();
  });
  await test(`${language}: approving personal data use autosaves and announces confirmed success without leaving`, async () => {
    const h = harness({ language }); await h.settle();
    h.toggle('use_name').props.onValueChange(true);
    assert.deepEqual(h.calls.saves, []); assert.deepEqual(h.calls.toasts, []);
    await h.acceptConsent();
    assert.equal(h.calls.saves.length, 1); assert.equal(h.calls.saves[0].use_name, true);
    assert.equal(h.toggle('use_name').props.value, true); assert.equal(h.calls.back, 0);
    assert.deepEqual(h.calls.toasts, [[h.t('personalization.saved'), 'success']]);
    h.unmount();
  });
}
await test('hydration and login guards precede any preference request', () => {
  const cold = harness({ hydrated: false }); assert.equal(cold.render(true)[0].type, 'Spinner');
  const guest = harness({ token: null }); assert.equal(guest.render(true)[0].type, 'Redirect');
  assert.equal(guest.render(true)[0].props.href, '/login'); assert.equal(guest.calls.loads, 0);
});
await test('cancelled consent changes neither saved flags nor success notifications', async () => {
  const h = harness(); await h.settle(); await h.consent('use_name', false);
  assert.equal(h.toggle('use_name').props.value, false); assert.deepEqual(h.calls.saves, []);
  assert.deepEqual(h.calls.toasts, []); h.unmount();
});
await test('choosing an address autosaves immediately and reselecting it makes no duplicate request', async () => {
  const h = harness(); await h.settle();
  await h.button('personalization.address.co').props.onPress();
  assert.equal(h.calls.saves[0].address, 'co');
  assert.equal(h.button('personalization.address.co').props.accessibilityState.checked, true);
  assert.deepEqual(h.calls.toasts, [[h.t('personalization.saved'), 'success']]);
  await h.button('personalization.address.co').props.onPress();
  assert.equal(h.calls.saves.length, 1); assert.equal(h.calls.toasts.length, 1); h.unmount();
});
await test('enabling weather without an area opens area choices without saving an invalid preference or requesting GPS', async () => {
  const h = harness(); await h.settle();
  h.toggle('weather_enabled').props.onValueChange(true);
  assert.equal(h.render().find(node => node.props.testID === 'voice-action-weather').props.expanded, true);
  assert.equal(h.render().filter(node => node.type === 'Switch').length, 0);
  assert.ok(h.text().includes(h.t('personalization.chooseRegion')));
  assert.deepEqual(h.calls.saves, []); assert.deepEqual(h.calls.toasts, []); assert.equal(h.calls.permissions, 0);
  await h.chooseRegion('hanoi');
  assert.equal(h.calls.saves.length, 1); assert.equal(h.calls.saves[0].weather_enabled, true);
  assert.equal(h.calls.saves[0].region, 'hanoi'); assert.equal(h.calls.saves[0].location, null);
  assert.equal(h.calls.permissions, 0); assert.equal(h.calls.locations, 0); h.unmount();
});
await test('declining weather consent does not save the chosen area', async () => {
  const h = harness(); await h.settle(); await h.chooseRegion('hanoi', false);
  assert.deepEqual(h.calls.saves, []); assert.equal(h.toggle('weather_enabled').props.value, false);
  assert.deepEqual(h.calls.toasts, []); h.unmount();
});
await test('changing an already enabled weather area autosaves without asking for consent or GPS again', async () => {
  const h = harness({ value: { ...preferences.VOICE_DEFAULTS, weather_enabled: true, region: 'hanoi' } });
  await h.settle(); await h.chooseRegion('hcm');
  assert.equal(h.calls.saves[0].region, 'hcm'); assert.equal(h.modal().props.visible, false);
  assert.equal(h.calls.permissions, 0); assert.equal(h.calls.toasts.at(-1)[1], 'success'); h.unmount();
});
await test('location is requested only after explicit consent, rounded once and then autosaved', async () => {
  const h = harness(); await h.settle();
  h.button('personalization.useLocation').props.onPress();
  assert.equal(h.calls.permissions, 0); assert.equal(h.calls.locations, 0); assert.deepEqual(h.calls.saves, []);
  await h.acceptConsent();
  assert.equal(h.calls.permissions, 1); assert.equal(h.calls.locations, 1);
  assert.equal(h.calls.saves[0].weather_enabled, true); assert.equal(h.calls.saves[0].region, 'device');
  assert.deepEqual(h.calls.saves[0].location, { latitude: 10.8, longitude: 106.7 });
  assert.deepEqual(h.calls.toasts, [[h.t('personalization.saved'), 'success']]); h.unmount();
});
await test('denied location keeps weather off and a manual area can still autosave', async () => {
  const h = harness({ permission: 'denied' }); await h.settle(); await h.useLocation();
  assert.equal(h.calls.locations, 0); assert.deepEqual(h.calls.saves, []);
  assert.ok(h.text().includes(h.t('personalization.locationDenied'))); assert.deepEqual(h.calls.toasts, []);
  await h.chooseRegion('hcm');
  assert.equal(h.calls.saves[0].region, 'hcm'); assert.equal(h.calls.saves[0].weather_enabled, true); h.unmount();
});
await test('revoking weather immediately saves the cleared area without a new permission', async () => {
  const h = harness({ value: { ...preferences.VOICE_DEFAULTS, weather_enabled: true, region: 'device', location: { latitude: 10.8, longitude: 106.7 } } });
  await h.settle(); await h.toggle('weather_enabled').props.onValueChange(false);
  assert.deepEqual(h.calls.saves[0], preferences.VOICE_DEFAULTS); assert.equal(h.calls.permissions, 0);
  assert.equal(h.toggle('weather_enabled').props.value, false); assert.equal(h.calls.toasts.at(-1)[1], 'success'); h.unmount();
});
await test('duplicate actions coalesce and success appears only after the server confirms', async () => {
  const pending = deferred(); const h = harness({ save: () => pending.promise }); await h.settle();
  h.toggle('use_health').props.onValueChange(true);
  const modal = h.modal(); modal.props.onDismiss();
  const first = modal.props.buttons[1].onPress(), second = modal.props.buttons[1].onPress();
  assert.equal(h.calls.saves.length, 1); assert.equal(h.toggle('use_health').props.disabled, true);
  assert.equal(h.toggle('use_health').props.value, false); assert.deepEqual(h.calls.toasts, []);
  pending.resolve({ ok: true, preferences: h.calls.saves[0] }); await Promise.all([first, second]);
  assert.equal(h.toggle('use_health').props.value, true); assert.equal(h.calls.toasts.length, 1); h.unmount();
});
await test('failed autosave retains confirmed values, reports failure and retries the selected choice', async () => {
  let attempts = 0;
  const h = harness({ save: async next => { if (!attempts++) throw new Error('Offline'); return { preferences: next }; } });
  await h.settle(); await h.consent('use_health');
  assert.equal(h.toggle('use_health').props.value, false); assert.equal(h.calls.back, 0);
  assert.deepEqual(h.calls.toasts, [['Offline', 'error']]); assert.ok(h.retry());
  await h.retry().props.onPress();
  assert.equal(h.calls.saves.length, 2); assert.equal(h.toggle('use_health').props.value, true);
  assert.deepEqual(h.calls.toasts.at(-1), [h.t('personalization.saved'), 'success']); assert.equal(h.retry(), undefined); h.unmount();
});
await test('a new successful choice replaces a failed retry instead of replaying an older setting', async () => {
  let attempts = 0;
  const h = harness({ save: async next => { if (!attempts++) throw new Error('Offline'); return { preferences: next }; } });
  await h.settle(); await h.button('personalization.address.co').props.onPress(); assert.ok(h.retry());
  await h.button('personalization.address.chi').props.onPress();
  assert.equal(h.calls.saves[1].address, 'chi'); assert.equal(h.retry(), undefined);
  assert.equal(h.button('personalization.address.chi').props.accessibilityState.checked, true); h.unmount();
});
await test('consent revocation remains available and each autosave preserves the other confirmed flags', async () => {
  const h = harness({ value: { ...preferences.VOICE_DEFAULTS, use_name: true, use_health: true } }); await h.settle();
  await h.toggle('use_name').props.onValueChange(false); await h.toggle('use_health').props.onValueChange(false);
  assert.equal(h.calls.saves.length, 2); assert.equal(h.calls.saves[0].use_health, true);
  assert.deepEqual(h.calls.saves[1], preferences.VOICE_DEFAULTS); h.unmount();
});
await test('failed loading exposes retry without fake preferences, writes or success notifications', async () => {
  let failures = 1;
  const h = harness({ load: async () => { if (failures--) throw new Error('Offline'); return { preferences: preferences.VOICE_DEFAULTS }; } });
  await h.settle(); assert.equal(h.render().filter(node => node.type === 'ActionTile').length, 0);
  assert.ok(h.retry()); assert.deepEqual(h.calls.saves, []); assert.deepEqual(h.calls.toasts, []);
  h.retry().props.onPress(); await h.settle(); assert.ok(h.toggle('use_name')); h.unmount();
});
await test('a late location lookup cannot save or notify after the screen unmounts', async () => {
  const gps = deferred(); const h = harness({ locate: () => gps.promise }); await h.settle();
  const reading = h.useLocation(); await flush(); h.unmount();
  gps.resolve({ coords: { latitude: 10.76, longitude: 106.66 } }); await reading;
  assert.deepEqual(h.calls.saves, []); assert.deepEqual(h.calls.toasts, []);
});
for (const mode of ['unmount', 'account']) {
  await test(`${mode}: late autosave cannot update or announce success in another screen or account`, async () => {
    const pending = deferred(); const h = harness({ save: () => pending.promise }); await h.settle();
    const saving = h.button('personalization.address.co').props.onPress();
    if (mode === 'unmount') h.unmount(); else h.session.profile.id = '8';
    pending.resolve({ preferences: h.calls.saves[0] }); await saving;
    assert.equal(h.calls.back, 0); assert.deepEqual(h.calls.toasts, []);
    if (mode !== 'unmount') h.unmount();
  });
}
await test('access-token renewal for the same account does not disable autosave', async () => {
  const h = harness(); await h.settle(); h.session.token = 'renewed-session'; await h.consent('use_name');
  assert.equal(h.calls.saves.length, 1); assert.equal(h.calls.toasts.at(-1)[1], 'success'); h.unmount();
});
await test('long text wraps and consent remains scrollable with vertically stacked buttons', async () => {
  const h = harness(); await h.settle(); h.toggle('use_name').props.onValueChange(true);
  assert.equal(h.modal().props.scrollable, true); assert.equal(h.modal().props.stackButtons, true);
  for (const node of h.render().filter(node => node.type === 'Text')) assert.equal(node.props.numberOfLines, undefined);
  h.openSection('address');
  for (const node of h.render().filter(node => node.type === 'Button' && node.props.accessibilityRole === 'radio')) {
    assert.ok(node.props.style[0].minHeight >= 48); assert.equal(node.props.style[0].height, undefined);
  }
  assert.ok(h.render().some(node => node.type === 'ScrollView')); h.unmount();
});
await test('weather source attribution opens the provider license without changing preferences', async () => {
  const h = harness(); await h.settle(); h.button('personalization.weatherSource').props.onPress(); await flush();
  assert.deepEqual(h.calls.source, ['https://api.met.no/doc/License']); assert.deepEqual(h.calls.saves, []); h.unmount();
});
await test('switching action groups retains autosaved values without another load or implicit writes', async () => {
  const h = harness(); await h.settle(); await h.consent('use_name');
  await h.button('personalization.address.co').props.onPress(); await h.chooseRegion('hanoi');
  h.openSection('permissions'); assert.equal(h.toggle('use_name').props.value, true);
  h.openSection('address'); assert.equal(h.button('personalization.address.co').props.accessibilityState.checked, true);
  h.render().find(node => node.props.testID === 'voice-action-address').props.onPress();
  assert.ok(h.render().filter(node => node.type === 'ActionTile').every(node => node.props.expanded === false));
  assert.equal(h.calls.loads, 1); assert.equal(h.calls.saves.length, 3);
  assert.equal(h.calls.saves[2].address, 'co'); assert.equal(h.calls.saves[2].use_name, true);
  assert.equal(h.calls.saves[2].weather_enabled, true); h.unmount();
});
for (const [width, fontScale, multiplier, columns] of [[393, 1, 1, 3], [320, 1, 1, 2], [393, 1.4, 1.25, 2]]) {
  await test(`personalization actions fit ${width}px at font ${fontScale}/${multiplier}`, async () => {
    const h = harness({ width, fontScale, multiplier }); await h.settle();
    const actions = h.render().filter(node => node.type === 'ActionTile');
    assert.ok(actions.every(node => node.props.style.width >= 64));
    assert.ok(Math.abs(actions[0].props.style.width * columns + 12 * (columns - 1) - (width - 40)) < 0.01); h.unmount();
  });
}
await test('weather validation rejects empty areas, out-of-range GPS and non-finite coordinates', () => {
  assert.equal(preferences.weatherRegionReady(preferences.VOICE_DEFAULTS), true);
  assert.equal(preferences.weatherRegionReady({ ...preferences.VOICE_DEFAULTS, weather_enabled: true }), false);
  assert.equal(preferences.weatherRegionReady({ ...preferences.VOICE_DEFAULTS, weather_enabled: true, region: 'device', location: { latitude: NaN, longitude: 106 } }), false);
  assert.equal(preferences.weatherRegionReady({ ...preferences.VOICE_DEFAULTS, weather_enabled: true, region: 'device', location: { latitude: 91, longitude: 106 } }), false);
});
console.log(`Check-in personalization: ${checks} runtime checks passed.`);
