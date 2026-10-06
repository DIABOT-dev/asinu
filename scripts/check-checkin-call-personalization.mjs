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
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
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
    button: (key) =>
      render().find(
        (node) =>
          node.type === 'Button' &&
          node.props.accessibilityLabel === translations.checkinCall(key)
      ),
    toggle: (field) =>
      render().find(
        (node) =>
          node.type === 'Switch' &&
          node.props.accessibilityLabel ===
            translations.checkinCall(`personalization.${field}`)
      ),
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
    consent: (field, agree = true) => {
      h.toggle(field).props.onValueChange(true);
      const modal = h.modal();
      assert.equal(modal.props.visible, true);
      modal.props.onDismiss();
      if (agree) modal.props.buttons[1].onPress();
    },
    unmount: () => {
      slots.forEach((slot) => slot.cleanup?.());
      live = false;
    },
  };
  return h;
}

for (const language of ['vi', 'en']) {
  await test(`${language}: all labels resolve and personal data use starts off`, async () => {
    const h = harness({ language });
    await h.settle();
    for (const field of ['use_name', 'use_health', 'weather_enabled'])
      assert.equal(h.toggle(field).props.value, false);
    assert.equal(h.calls.permissions, 0);
    assert.equal(h.calls.locations, 0);
    assert.equal(h.button('personalization.save').props.disabled, true);
    assert.ok(h.text().includes(h.t('personalization.privacy')));
    h.unmount();
  });
}
await test('hydration and login guards precede any preference request', () => {
  const cold = harness({ hydrated: false });
  assert.equal(cold.render(true)[0].type, 'Spinner');
  const guest = harness({ token: null });
  assert.equal(guest.render(true)[0].type, 'Redirect');
  assert.equal(guest.render(true)[0].props.href, '/login');
  assert.equal(guest.calls.loads, 0);
});
await test('consent cancellation does not enable or save optional data use', async () => {
  const h = harness();
  await h.settle();
  h.consent('use_name', false);
  assert.equal(h.toggle('use_name').props.value, false);
  assert.equal(h.calls.saves.length, 0);
  h.unmount();
});
await test('explicit consent enables a draft; only Save persists it for the current user', async () => {
  const h = harness();
  await h.settle();
  h.consent('use_name');
  assert.equal(h.toggle('use_name').props.value, true);
  assert.equal(h.calls.saves.length, 0);
  h.button('personalization.address.co').props.onPress();
  await h.button('personalization.save').props.onPress();
  assert.equal(h.calls.saves[0].use_name, true);
  assert.equal(h.calls.saves[0].address, 'co');
  assert.equal(h.calls.back, 1);
  h.unmount();
});
await test('weather consent requires an area and never asks GPS permission automatically', async () => {
  const h = harness();
  await h.settle();
  h.consent('weather_enabled');
  assert.equal(h.button('personalization.save').props.disabled, true);
  assert.equal(h.calls.permissions, 0);
  assert.ok(h.text().includes(h.t('personalization.chooseRegion')));
  h.button('personalization.regions.hanoi').props.onPress();
  await h.button('personalization.save').props.onPress();
  assert.equal(h.calls.saves[0].region, 'hanoi');
  assert.equal(h.calls.saves[0].location, null);
  h.unmount();
});
await test('denied location offers manual area selection without blocking Save', async () => {
  const h = harness({ permission: 'denied' });
  await h.settle();
  h.consent('weather_enabled');
  await h.button('personalization.useLocation').props.onPress();
  assert.equal(h.calls.locations, 0);
  assert.ok(h.text().includes(h.t('personalization.locationDenied')));
  h.button('personalization.regions.hcm').props.onPress();
  assert.equal(h.button('personalization.save').props.disabled, false);
  h.unmount();
});
await test('one foreground reading is rounded before saving; precise GPS never enters the API draft', async () => {
  const h = harness();
  await h.settle();
  h.consent('weather_enabled');
  await h.button('personalization.useLocation').props.onPress();
  await h.button('personalization.save').props.onPress();
  assert.equal(h.calls.permissions, 1);
  assert.equal(h.calls.locations, 1);
  assert.deepEqual(h.calls.saves[0].location, {
    latitude: 10.8,
    longitude: 106.7,
  });
  h.unmount();
});
await test('revoking weather clears the saved device location without a new permission', async () => {
  const h = harness({
    value: {
      ...preferences.VOICE_DEFAULTS,
      weather_enabled: true,
      region: 'device',
      location: { latitude: 10.8, longitude: 106.7 },
    },
  });
  await h.settle();
  h.toggle('weather_enabled').props.onValueChange(false);
  await h.button('personalization.save').props.onPress();
  assert.deepEqual(h.calls.saves[0], preferences.VOICE_DEFAULTS);
  assert.equal(h.calls.permissions, 0);
  h.unmount();
});
await test('duplicate saves are coalesced before React can render the busy state', async () => {
  const pending = deferred();
  const h = harness({ save: () => pending.promise });
  await h.settle();
  h.consent('use_health');
  const press = h.button('personalization.save').props.onPress;
  const first = press();
  const second = press();
  assert.equal(h.calls.saves.length, 1);
  assert.equal(h.button('personalization.save').props.disabled, true);
  pending.resolve({ ok: true, preferences: h.calls.saves[0] });
  await Promise.all([first, second]);
  h.unmount();
});
await test('failed Save retains the draft and lets the user retry without leaving the screen', async () => {
  const h = harness({
    save: async () => {
      throw new Error('Offline');
    },
  });
  await h.settle();
  h.consent('use_health');
  await h.button('personalization.save').props.onPress();
  assert.equal(h.calls.back, 0);
  assert.equal(h.toggle('use_health').props.value, true);
  assert.equal(h.button('personalization.save').props.disabled, false);
  assert.ok(h.text().includes('Offline'));
  h.unmount();
});
await test('expired-package consent revocation is still an available settings action', async () => {
  const h = harness({
    value: { ...preferences.VOICE_DEFAULTS, use_name: true, use_health: true },
  });
  await h.settle();
  h.toggle('use_name').props.onValueChange(false);
  h.toggle('use_health').props.onValueChange(false);
  await h.button('personalization.save').props.onPress();
  assert.deepEqual(h.calls.saves[0], preferences.VOICE_DEFAULTS);
  h.unmount();
});
await test('failed loading shows Retry and does not present fake default settings as saved', async () => {
  let failures = 1;
  const h = harness({
    load: async () => {
      if (failures--) throw new Error('Offline');
      return { preferences: preferences.VOICE_DEFAULTS };
    },
  });
  await h.settle();
  assert.equal(h.button('personalization.save'), undefined);
  const retry = h
    .render()
    .find(
      (node) =>
        node.type === 'Button' &&
        node.props.accessibilityLabel ===
          JSON.parse(fs.readFileSync('src/i18n/locales/vi/common.json', 'utf8'))
            .retry
    );
  assert.ok(retry);
  retry.props.onPress();
  await h.settle();
  assert.ok(h.toggle('use_name'));
  h.unmount();
});
await test('late location and Save completions cannot update an unmounted or different-user screen', async () => {
  const gps = deferred();
  const h = harness({ locate: () => gps.promise });
  await h.settle();
  h.consent('weather_enabled');
  const reading = h.button('personalization.useLocation').props.onPress();
  await flush();
  h.unmount();
  gps.resolve({ coords: { latitude: 10.76, longitude: 106.66 } });
  await reading;
  const pending = deferred();
  const other = harness({ save: () => pending.promise });
  await other.settle();
  other.consent('use_name');
  const saving = other.button('personalization.save').props.onPress();
  other.session.profile.id = '8';
  pending.resolve({ preferences: preferences.VOICE_DEFAULTS });
  await saving;
  assert.equal(other.calls.back, 0);
  other.unmount();
});
await test('access-token renewal for the same account does not silently disable the settings screen', async () => {
  const h = harness();
  await h.settle();
  h.session.token = 'renewed-session';
  h.consent('use_name');
  await h.button('personalization.save').props.onPress();
  assert.equal(h.calls.saves.length, 1);
  h.unmount();
});
await test('long text can wrap; consent uses scrollable app UI and vertically stacked buttons', async () => {
  const h = harness();
  await h.settle();
  h.consent('weather_enabled');
  h.toggle('use_name').props.onValueChange(true);
  assert.equal(h.modal().props.scrollable, true);
  assert.equal(h.modal().props.stackButtons, true);
  for (const node of h.render().filter((node) => node.type === 'Text'))
    assert.equal(node.props.numberOfLines, undefined);
  for (const node of h
    .render()
    .filter(
      (node) =>
        node.type === 'Button' && node.props.accessibilityRole === 'radio'
    )) {
    assert.ok(node.props.style[0].minHeight >= 48);
    assert.equal(node.props.style[0].height, undefined);
  }
  assert.ok(h.render().some((node) => node.type === 'ScrollView'));
  h.unmount();
});
await test('weather source attribution links to the provider license', async () => {
  const h = harness({
    value: {
      ...preferences.VOICE_DEFAULTS,
      weather_enabled: true,
      region: 'hanoi',
    },
  });
  await h.settle();
  h.button('personalization.weatherSource').props.onPress();
  await flush();
  assert.deepEqual(h.calls.source, ['https://api.met.no/doc/License']);
  h.unmount();
});
await test('weather validation rejects empty regions, out-of-range GPS and non-finite coordinates', () => {
  assert.equal(
    preferences.weatherRegionReady(preferences.VOICE_DEFAULTS),
    true
  );
  assert.equal(
    preferences.weatherRegionReady({
      ...preferences.VOICE_DEFAULTS,
      weather_enabled: true,
    }),
    false
  );
  assert.equal(
    preferences.weatherRegionReady({
      ...preferences.VOICE_DEFAULTS,
      weather_enabled: true,
      region: 'device',
      location: { latitude: NaN, longitude: 106 },
    }),
    false
  );
  assert.deepEqual(preferences.coarsePoint(10.762622, 106.660172), {
    latitude: 10.8,
    longitude: 106.7,
  });
});

console.log(`Check-in personalization: ${checks} runtime checks passed.`);
