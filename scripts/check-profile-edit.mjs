import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = file => fs.readFileSync(file, 'utf8');
function evaluate(source, imports = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const jsx = (type, props, key) => ({ type, props: { ...props, key } });
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', '__DEV__', output)(module, module.exports, id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (/\.(png|jpg|webp)$/.test(id)) return 'fixture-artwork';
    assert.ok(id in imports, `Missing profile adapter: ${id}`);
    return imports[id];
  }, false);
  return module.exports;
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return tree && typeof tree === 'object' ? text(tree.props?.children) : '';
}
const theme = evaluate(read('src/styles/theme.ts'));
class ApiError extends Error {
  constructor(statusCode) { super('Fixture API failure'); this.statusCode = statusCode; }
}

function harness({ language = 'vi', bloodType = 'A+', save, uploadAvatar, multiplier = 1, isDark = false, profile: profileOverrides = {} } = {}) {
  const slots = [];
  let cursor = 0;
  let pendingEffects = [];
  let needsRender = false;
  const calls = { saves: [], uploads: [], toasts: [], profileWrites: [], focus: 0 };
  const profile = { id: 'profile-fixture', name: 'Demo', phone: '', age: 40, gender: 'Nam',
    heightCm: 170, weightKg: 70, bloodType, chronicDiseases: [], ...profileOverrides };
  const auth = { profile, logout: async () => {} };
  const translate = ns => {
    const catalog = JSON.parse(read(`src/i18n/locales/${language}/${ns}.json`));
    return key => key.split('.').reduce((value, part) => value?.[part], catalog) ?? key;
  };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value;
        if (!Object.is(slots[index], next)) needsRender = true;
        slots[index] = next;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo: fn => fn(), useCallback: fn => fn,
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !deps || deps.some((dep, i) => !Object.is(dep, previous.deps?.[i]))) {
        slots[index] = { deps };
        pendingEffects.push(effect);
      }
    },
    Suspense: 'Suspense', lazy: () => 'LazyModal',
  };
  const useAuthStore = selector => selector(auth);
  useAuthStore.getState = () => auth;
  useAuthStore.setState = update => { Object.assign(auth, update); calls.profileWrites.push(update); };
  const animation = { delay() { return this; }, duration() { return this; } };
  const imports = {
    react: { __esModule: true, default: hooks, ...hooks },
    'react-native': {
      ...Object.fromEntries(['ActivityIndicator', 'Image', 'KeyboardAvoidingView', 'Modal', 'Pressable', 'ScrollView', 'Switch', 'TouchableOpacity', 'View'].map(name => [name, name])),
      Dimensions: { get: () => ({ width: 390, height: 844 }) }, Platform: { OS: 'ios' },
      StyleSheet: { create: value => value, absoluteFillObject: {} },
      Linking: { openURL: async () => {} }, Share: { share: async () => {} },
    },
    '@expo/vector-icons': { FontAwesome5: 'Icon', Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' },
    'expo-image-picker': {
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
      launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'fixture-avatar' }] }),
      MediaTypeOptions: { Images: 'images' }, UIImagePickerPresentationStyle: { PAGE_SHEET: 'page-sheet' },
    }, 'expo-router': { useFocusEffect: () => {} },
    '@react-native-async-storage/async-storage': { __esModule: true, default: {} },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, FadeIn: animation },
    'react-i18next': { useTranslation: ns => ({ t: translate(ns), i18n: { language } }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    '@/hooks/useGuardedRouter': { useGuardedRouter: () => ({ push() {}, replace() {}, back() {} }) },
    '../../../src/components/AppAlertModal': { AppAlertModal: 'AppAlertModal', useAppAlert: () => ({ alertState: { visible: false }, showAlert() {}, dismissAlert() {} }) },
    '../../../src/components/AiDataConsentModal': { AiDataConsentModal: 'AiDataConsentModal', hasAiDataConsent: async () => false, revokeAiDataConsent: async () => {} },
    '../../../src/components/ScaledTextInput': { ScaledTextInput: 'TextInput' },
    '../../../src/components/CheckinGuideCarousel': { CheckinGuideCarousel: 'CheckinGuideCarousel' },
    '../../../src/components/RippleRefresh': { RippleRefreshScrollView: 'ScrollView' },
    '../../../src/components/ScaledText': { ScaledText: 'Text' },
    '../../../src/components/Screen': { Screen: 'Screen' },
    '../../../src/components/GlobalToastHost': { ModalToastHost: 'ModalToastHost' },
    '../../../src/components/state/MainScreenSkeletons': { ProfileTabSkeleton: 'Skeleton' },
    '../../../src/features/auth/auth.api': { authApi: {
      updateProfile: async payload => {
        calls.saves.push(payload);
        return save ? save(payload) : { ...auth.profile, ...payload };
      },
      uploadAvatar: async uri => {
        calls.uploads.push(uri);
        return uploadAvatar ? uploadAvatar(uri) : { ...auth.profile, avatarUrl: uri };
      },
    } },
    '../../../src/stores/toast.store': { showToast: (...args) => calls.toasts.push(args), setPendingToast() {} },
    '../../../src/features/auth/auth.store': { useAuthStore },
    '../../../src/features/logs/logs.store': { useLogsStore: selector => selector({ fetchRecent: async () => {} }) },
    '../../../src/features/missions/missions.store': { useMissionsStore: selector => selector({ fetchMissions: async () => {} }) },
    '../../../src/features/subscription/planName': { localizedPlanName: () => 'Fixture plan' },
    '../../../src/stores/font-size.store': { useFontSizeStore: () => ({ scale: 'normal', multiplier, setScale() {} }) },
    '../../../src/stores/language.store': { useLanguageStore: () => ({ language, setLanguage() {} }) },
    '../../../src/hooks/useScaledTypography': { useScaledTypography: () => theme.typography },
    '../../../src/hooks/useInitialLoadingGate': { useInitialLoadingGate: () => false },
    '../../../src/lib/apiClient': { ApiError, apiClient: async () => ({}), getApiErrorMessage: (_error, t, key) => t(key) },
    '../../../src/styles': theme,
    '../../../src/hooks/useThemeColors': { useThemeColors: () => ({ isDark }) },
    '../../../src/stores/health-feed-preference': { getHealthFeedPreference: async () => true, setHealthFeedPreference: async enabled => enabled },
  };
  const { default: ProfileScreen } = evaluate(read('app/(tabs)/profile/index.tsx'), imports);
  const render = () => {
    let tree;
    let renders = 0;
    do {
      needsRender = false;
      cursor = 0;
      tree = ProfileScreen();
      const effects = pendingEffects;
      pendingEffects = [];
      for (const effect of effects) effect();
      assert.ok(++renders <= 10, 'Profile effects must settle');
    } while (needsRender);
    for (const input of nodes(tree).filter(node => node.type === 'TextInput')) {
      if (input.props.ref) input.props.ref.current = { focus: () => { calls.focus++; } };
    }
    return tree;
  };
  const modal = () => nodes(render()).find(node => node.type === 'Modal' && node.props.visible && text(node).includes(translate('profile')('editProfileTitle')));
  const saveButton = () => nodes(modal()).find(node => node.type === 'Pressable' && node.props.onPress?.name === 'handleSaveProfile');
  const input = (field = 'bloodType') => {
    const inputs = nodes(modal()).filter(node => node.type === 'TextInput');
    const placeholders = { name: 'enterName', phone: 'enterPhone', bloodType: 'bloodTypePlaceholder' };
    if (field in placeholders) return inputs.find(node => node.props.placeholder === translate('profile')(placeholders[field]));
    return inputs.filter(node => node.props.keyboardType === 'number-pad')[['age', 'height', 'weight'].indexOf(field)];
  };
  const selectGender = value => nodes(modal()).find(node => node.type === 'Pressable' && text(node).trim() === translate('common')(value)).props.onPress();
  const toggleDisease = key => {
    nodes(modal()).find(node => node.type === 'Pressable' && text(node).includes(translate('profile')('chronicDiseases'))).props.onPress();
    const picker = nodes(render()).find(node => node.type === 'Modal' && node.props.visible && text(node).includes(translate('profile')('selectDiseases')));
    nodes(picker).find(node => node.type === 'Pressable' && text(node).trim() === translate('profile')(key)).props.onPress();
    picker.props.onRequestClose();
  };
  const avatarButton = () => nodes(modal()).find(node => node.type === 'Pressable' && text(node).trim() === translate('profile')('uploadPhoto'));
  const updateProfile = update => { auth.profile = { ...auth.profile, ...update }; };
  const open = () => {
    const edit = nodes(render()).find(node => ['Pressable', 'TouchableOpacity'].includes(node.type) && node.props.onPress?.name === 'handleEditProfile');
    assert.ok(edit, 'Profile edit button must exist'); edit.props.onPress(); assert.ok(modal());
  };
  return { render, modal, input, saveButton, open, selectGender, toggleDisease, avatarButton, updateProfile, calls, t: translate('profile'), tc: translate('common') };
}

let checks = 0;
async function test(label, run) { await run(); checks++; console.log(`PASS ${label}`); }
for (const language of ['vi', 'en']) {
  await test(`${language}: opening an unchanged profile leaves Save muted, accessible, and unable to submit`, async () => {
    const h = harness({ language }); h.open();
    const button = h.saveButton();
    assert.equal(button.props.disabled, true);
    assert.equal(button.props.accessibilityRole, 'button');
    assert.deepEqual(button.props.accessibilityState, { disabled: true, busy: false });
    const style = Object.assign({}, ...button.props.style.filter(Boolean));
    assert.notEqual(style.backgroundColor, theme.colors.primaryDark);
    assert.equal(style.shadowOpacity, 0); assert.equal(style.elevation, 0);
    await button.props.onPress();
    assert.equal(h.calls.saves.length, 0); assert.equal(h.calls.toasts.length, 0);
  });
  await test(`${language}: invalid blood type shows feedback inside the modal and can be corrected without reopening`, async () => {
    const h = harness({ language }); h.open();
    assert.ok(nodes(h.modal()).some(node => node.type === 'ModalToastHost'), 'Validation toast must render above the native edit modal');
    h.input().props.onChangeText('Z+');
    await h.saveButton().props.onPress();
    assert.equal(h.calls.saves.length, 0);
    assert.equal(h.calls.toasts.at(-1)[0], h.t('bloodTypeInvalid'));
    assert.equal(h.calls.focus, 1);
    assert.ok(h.modal()); assert.equal(h.saveButton().props.disabled, false);
    h.input().props.onChangeText('O+');
    await h.saveButton().props.onPress();
    assert.equal(h.calls.saves.length, 1); assert.equal(h.calls.saves[0].bloodType, 'O+');
    assert.equal(h.modal(), undefined); assert.equal(h.calls.toasts.at(-1)[0], h.t('profileUpdated'));
  });
  await test(`${language}: invalid blood type still permits Cancel and opening the form again`, async () => {
    const h = harness({ language }); h.open(); h.input().props.onChangeText('AB');
    await h.saveButton().props.onPress();
    const cancel = nodes(h.modal()).find(node => node.type === 'Pressable' && text(node).trim() === h.tc('cancel'));
    cancel.props.onPress(); assert.equal(h.modal(), undefined);
    h.open(); assert.equal(h.input().props.value, 'A+'); assert.equal(h.saveButton().props.disabled, true);
  });
  await test(`${language}: clearing a previous blood type saves null instead of retaining the old value`, async () => {
    const h = harness({ language, bloodType: 'B-' }); h.open(); h.input().props.onChangeText('  ');
    await h.saveButton().props.onPress(); assert.equal(h.calls.saves[0].bloodType, null);
  });
  await test(`${language}: format instructions remain readable and the input has an accessible label`, async () => {
    const h = harness({ language, multiplier: 1.6 }); h.open();
    const hint = nodes(h.modal()).find(node => node.type === 'Text' && node.props.children === h.t('bloodTypeExample'));
    assert.ok(hint); assert.equal(hint.props.numberOfLines, undefined);
    assert.equal(h.input().props.accessibilityLabel, h.t('bloodType'));
    assert.equal(h.input().props.autoCorrect, false);
  });
}
for (const bloodType of ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']) {
  await test(`${bloodType}: a supported blood type saves`, async () => {
    const h = harness({ bloodType: bloodType === 'A+' ? 'B+' : 'A+' }); h.open(); h.input().props.onChangeText(bloodType);
    await h.saveButton().props.onPress(); assert.equal(h.calls.saves[0].bloodType, bloodType);
  });
}
for (const [input, expected] of [[' o+ ', 'O+'], ['ab -', 'AB-'], ['o\u2212', 'O-'], ['ＡＢ＋', 'AB+']]) {
  await test(`${JSON.stringify(input)}: harmless formatting is normalized before saving`, async () => {
    const h = harness(); h.open(); h.input().props.onChangeText(input);
    await h.saveButton().props.onPress(); assert.equal(h.calls.saves[0].bloodType, expected);
  });
}
await test('duplicate Save taps send one request and the button unlocks after an API failure', async () => {
  let rejectSave;
  const h = harness({ save: () => new Promise((_resolve, reject) => { rejectSave = reject; }) }); h.open(); h.input().props.onChangeText('B+');
  const staleHandler = h.saveButton().props.onPress;
  const first = staleHandler(); const duplicate = staleHandler();
  assert.equal(h.calls.saves.length, 1);
  assert.equal(nodes(h.modal()).find(node => node.type === 'Pressable' && node.props.onPress?.name === 'handleSaveProfile').props.disabled, true);
  assert.deepEqual(h.saveButton().props.accessibilityState, { disabled: true, busy: true });
  rejectSave(new Error('Fixture network failure')); await Promise.all([first, duplicate]);
  assert.equal(h.saveButton().props.disabled, false); assert.ok(h.modal());
  assert.equal(h.calls.toasts.at(-1)[0], h.t('profileUpdateError'));
  const retry = h.saveButton().props.onPress(); assert.equal(h.calls.saves.length, 2);
  rejectSave(new Error('Fixture retry failure')); await retry; assert.equal(h.saveButton().props.disabled, false);
});
await test('phone conflicts unlock Save and never overwrite the profile', async () => {
  const h = harness({ save: async () => { throw new ApiError(409); } }); h.open(); h.input('phone').props.onChangeText('0901234567');
  await h.saveButton().props.onPress();
  assert.equal(h.calls.profileWrites.length, 0); assert.equal(h.saveButton().props.disabled, false);
  assert.ok(text(h.modal()).includes(h.t('phoneAlreadyUsed')));
});
for (const bloodType of ['A', 'AB', 'Z+', '0+', 'A++', '+', '🙂']) {
  await test(`${JSON.stringify(bloodType)}: unsupported input never reaches the API or locks Save`, async () => {
    const h = harness(); h.open(); h.input().props.onChangeText(bloodType);
    await h.saveButton().props.onPress();
    assert.equal(h.calls.saves.length, 0); assert.equal(h.saveButton().props.disabled, false);
    assert.equal(h.input().props.value, bloodType); assert.equal(h.calls.focus, 1);
  });
}
await test('a legacy invalid blood type can be cleared and saved without reopening the form', async () => {
  const h = harness({ bloodType: 'unknown' }); h.open();
  assert.equal(h.saveButton().props.disabled, true);
  await h.saveButton().props.onPress(); assert.equal(h.calls.saves.length, 0);
  h.input().props.onChangeText(''); await h.saveButton().props.onPress();
  assert.equal(h.calls.saves[0].bloodType, null); assert.equal(h.modal(), undefined);
});

for (const language of ['vi', 'en']) {
  for (const [field, changed, original] of [
    ['name', 'Demo Updated', 'Demo'], ['phone', '0901234567', ''],
    ['age', '41', '40'], ['height', '171', '170'], ['weight', '71', '70'],
    ['bloodType', 'B+', 'A+'],
  ]) {
    await test(`${language} ${field}: Save enables for an edit and disables when it is reverted`, async () => {
      const h = harness({ language }); h.open();
      h.input(field).props.onChangeText(changed);
      assert.equal(h.saveButton().props.disabled, false);
      assert.equal(h.saveButton().props.accessibilityState.disabled, false);
      h.input(field).props.onChangeText(original);
      assert.equal(h.saveButton().props.disabled, true);
      await h.saveButton().props.onPress(); assert.equal(h.calls.saves.length, 0);
    });
  }
  await test(`${language}: a successful save resets dirty state and reopening compares against the saved profile`, async () => {
    const h = harness({ language }); h.open(); h.input('name').props.onChangeText('Demo Updated');
    const previousSaveHandler = h.saveButton().props.onPress;
    await previousSaveHandler(); assert.equal(h.calls.saves.length, 1); assert.equal(h.modal(), undefined);
    await previousSaveHandler(); assert.equal(h.calls.saves.length, 1);
    h.open(); assert.equal(h.input('name').props.value, 'Demo Updated'); assert.equal(h.saveButton().props.disabled, true);
    h.input('name').props.onChangeText('Demo'); assert.equal(h.saveButton().props.disabled, false);
    h.input('name').props.onChangeText('Demo Updated'); assert.equal(h.saveButton().props.disabled, true);
  });
}
await test('gender and disease selections enable Save and disable it again when reverted', async () => {
  const h = harness(); h.open();
  h.selectGender('female'); assert.equal(h.saveButton().props.disabled, false);
  h.selectGender('male'); assert.equal(h.saveButton().props.disabled, true);
  h.toggleDisease('diseaseDiabetes'); assert.equal(h.saveButton().props.disabled, false);
  h.toggleDisease('diseaseDiabetes'); assert.equal(h.saveButton().props.disabled, true);
});
await test('disease membership remains unchanged after removing and adding the same disease in a different order', async () => {
  const h = harness({ profile: { chronicDiseases: ['Tiểu đường', 'Tăng huyết áp'] } }); h.open();
  h.toggleDisease('diseaseDiabetes'); assert.equal(h.saveButton().props.disabled, false);
  h.toggleDisease('diseaseDiabetes'); assert.equal(h.saveButton().props.disabled, true);
});
await test('equivalent whitespace, blood-type formatting, and numeric values do not activate Save', async () => {
  const h = harness({ profile: { phone: '0901234567' } }); h.open();
  for (const [field, value] of [['name', ' Demo '], ['phone', ' 0901234567 '], ['age', '040'], ['height', '170.0'], ['weight', '070.00'], ['bloodType', ' ａ ＋ ']]) {
    h.input(field).props.onChangeText(value);
    assert.equal(h.saveButton().props.disabled, true, `${field} formatting is not a profile change`);
  }
  await h.saveButton().props.onPress(); assert.equal(h.calls.saves.length, 0);
});
await test('rounded and missing stored values open without dirty state in dark mode', async () => {
  const h = harness({ isDark: true, bloodType: null, profile: { name: ' Demo ', phone: null, age: null, gender: '', heightCm: 170.4, weightKg: 70.6 } }); h.open();
  assert.equal(h.input('height').props.value, '170'); assert.equal(h.input('weight').props.value, '71');
  assert.equal(h.saveButton().props.disabled, true);
  assert.equal(Object.assign({}, ...h.saveButton().props.style.filter(Boolean)).backgroundColor, '#334155');
});
await test('background profile refresh preserves pending edits and the opening baseline', async () => {
  const h = harness(); h.open(); h.input('name').props.onChangeText('Pending Edit');
  h.updateProfile({ name: 'Refreshed Name', bloodType: null, avatarUrl: 'updated-avatar' });
  assert.equal(h.input('name').props.value, 'Pending Edit'); assert.equal(h.input().props.value, 'A+');
  assert.equal(h.saveButton().props.disabled, false);
  h.input('name').props.onChangeText('Demo'); assert.equal(h.saveButton().props.disabled, true);
  const cancel = nodes(h.modal()).find(node => node.type === 'Pressable' && text(node).trim() === h.tc('cancel'));
  cancel.props.onPress(); h.open();
  assert.equal(h.input('name').props.value, 'Refreshed Name'); assert.equal(h.input().props.value, '');
  assert.equal(h.saveButton().props.disabled, true);
});
await test('avatar upload temporarily disables Save and does not discard unsaved form edits', async () => {
  let resolveUpload;
  const h = harness({ uploadAvatar: () => new Promise(resolve => { resolveUpload = resolve; }) }); h.open();
  h.input('name').props.onChangeText('Pending Edit');
  const upload = h.avatarButton().props.onPress();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(h.calls.uploads.length, 1); assert.equal(h.saveButton().props.disabled, true);
  await h.saveButton().props.onPress(); assert.equal(h.calls.saves.length, 0);
  resolveUpload({ id: 'profile-fixture', name: 'Demo', phone: '', age: 40, gender: 'Nam', heightCm: 170, weightKg: 70, bloodType: 'A+', chronicDiseases: [], avatarUrl: 'updated-avatar' });
  await upload;
  assert.equal(h.input('name').props.value, 'Pending Edit'); assert.equal(h.saveButton().props.disabled, false);
  h.input('name').props.onChangeText('Demo'); assert.equal(h.saveButton().props.disabled, true);
});
for (const [field, value, message] of [['name', ' ', 'nameRequired'], ['age', '151', 'ageValid'], ['height', '0', 'heightPositive'], ['weight', '-1', 'weightPositive']]) {
  await test(`${field}: invalid dirty input retains validation feedback without sending an update`, async () => {
    const h = harness(); h.open(); h.input(field).props.onChangeText(value);
    assert.equal(h.saveButton().props.disabled, false);
    await h.saveButton().props.onPress(); assert.equal(h.calls.saves.length, 0);
    assert.equal(h.calls.toasts.at(-1)[0], h.t(message)); assert.ok(h.modal());
    assert.equal(h.saveButton().props.disabled, false);
  });
}

function toastHarness() {
  const cleanups = new Map();
  let scope;
  const create = init => {
    let state;
    const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
    const get = () => state;
    state = init(set, get);
    const store = selector => selector ? selector(state) : state;
    store.getState = get; store.setState = set;
    return store;
  };
  const toast = evaluate(read('src/stores/toast.store.ts'), { zustand: { create } });
  const host = evaluate(read('src/components/GlobalToastHost.tsx'), {
    react: {
      useCallback: fn => fn, useId: () => scope,
      useLayoutEffect: effect => { if (!cleanups.has(scope)) cleanups.set(scope, effect()); },
    },
    zustand: { create }, '../stores/toast.store': toast, './Toast': { Toast: 'Toast' },
  });
  const resolve = element => typeof element?.type === 'function' ? resolve(element.type(element.props)) : element;
  const root = () => resolve(host.GlobalToastHost());
  const modal = id => { scope = id; return resolve(host.ModalToastHost()); };
  const mount = id => { modal(id); return modal(id); };
  const unmount = id => { cleanups.get(id)?.(); cleanups.delete(id); };
  return { ...toast, root, modal, mount, unmount };
}
await test('a native modal owns the global toast while the root host stays silent', async () => {
  const h = toastHarness(); h.showToast('fixture-validation', 'error', 5000);
  assert.equal(h.root().props.message, 'fixture-validation');
  h.mount('profile-modal'); assert.equal(h.root(), null);
  assert.equal(h.modal('profile-modal').props.message, 'fixture-validation');
  h.unmount('profile-modal'); assert.equal(h.root().props.message, 'fixture-validation');
});
await test('nested toast hosts render only in the top modal and clean up in any order', async () => {
  const h = toastHarness(); h.showToast('fixture-validation', 'error');
  h.mount('outer'); h.mount('inner');
  assert.equal(h.root(), null); assert.equal(h.modal('outer'), null);
  assert.equal(h.modal('inner').type, 'Toast');
  h.unmount('outer'); assert.equal(h.root(), null); assert.equal(h.modal('inner').type, 'Toast');
  h.unmount('inner'); assert.equal(h.root().type, 'Toast');
});
await test('closing the top modal restores the underlying modal toast owner', async () => {
  const h = toastHarness(); h.mount('outer'); h.mount('inner'); h.unmount('inner');
  assert.equal(h.root(), null); assert.equal(h.modal('outer').type, 'Toast');
  h.unmount('outer'); assert.equal(h.root().type, 'Toast');
});
await test('Strict Mode effect cleanup and remount cannot strand the root toast', async () => {
  const h = toastHarness(); h.mount('profile'); h.unmount('profile'); h.unmount('profile');
  assert.equal(h.root().type, 'Toast');
  h.mount('profile'); assert.equal(h.root(), null); h.unmount('profile');
  assert.equal(h.root().type, 'Toast');
});
await test('toast handoff preserves the event identity and does not restart its full duration', async () => {
  const h = toastHarness(); h.showToast('fixture-validation', 'error', 5000);
  const original = h.root();
  h.useToastStore.setState({ lastShownAt: Date.now() - 1000 }); h.mount('profile');
  const moved = h.modal('profile');
  assert.equal(moved.props.key, original.props.key); assert.equal(h.useToastStore.getState().toastId, 1);
  assert.ok(moved.props.duration <= 4000 && moved.props.duration > 3500);
  h.unmount('profile'); assert.ok(h.root().props.duration <= 4000);
});
await test('an old modal toast timeout cannot hide a newer toast', async () => {
  const h = toastHarness(); h.mount('profile'); h.showToast('old-validation', 'error');
  const stale = h.modal('profile').props.onHide;
  h.showToast('new-validation', 'error'); stale();
  assert.equal(h.useToastStore.getState().visible, true);
  assert.equal(h.modal('profile').props.message, 'new-validation');
  h.unmount('profile');
});
console.log(`Profile editing: ${checks} runtime regressions passed.`);
