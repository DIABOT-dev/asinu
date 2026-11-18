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
function nodes(tree, includeHidden = false) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, includeHidden));
  if (!tree || typeof tree !== 'object') return [];
  const styles = [tree.props?.style].flat(Infinity);
  if (!includeHidden && (tree.props?.accessibilityElementsHidden || styles.some(style => style?.display === 'none'))) return [];
  return [tree, ...nodes(tree.props?.children, includeHidden)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return tree && typeof tree === 'object' ? text(tree.props?.children) : '';
}
const theme = evaluate(read('src/styles/theme.ts'));
const administrative = evaluate(read('src/features/profile/administrative-units.ts'), { './data/vietnam-administrative-units.json': JSON.parse(read('src/features/profile/data/vietnam-administrative-units.json')) });
class ApiError extends Error {
  constructor(statusCode) { super('Fixture API failure'); this.statusCode = statusCode; }
}

function harness({ personalInformation: initialPersonalInformation = false, canGoBack = true, standalone = false, language = 'vi', bloodType = 'A+', save, uploadAvatar, multiplier = 1, isDark = false, doctorEnabled = false, profile: profileOverrides = {}, coins: coinOverrides = {} } = {}) {
  const slots = [];
  let cursor = 0;
  let personalInformation = initialPersonalInformation;
  let pendingEffects = [];
  let needsRender = false;
  const calls = { saves: [], uploads: [], toasts: [], profileWrites: [], focus: 0, routes: [], fontSizes: [], languages: [], coinReads: 0 };
  const preferences = { fontScale: 'normal', language };
  const profile = { id: 'profile-fixture', name: 'Demo', phone: '', age: 40, gender: 'Nam',
    heightCm: 170, weightKg: 70, bloodType, chronicDiseases: [], ...profileOverrides };
  const auth = { profile, logout: async () => {} };
  const coinSummary = { enabled: true, balance: 12, earnedToday: 10, ...coinOverrides };
  const translate = ns => {
    const catalog = JSON.parse(read(`src/i18n/locales/${language}/${ns}.json`));
    return (key, values = {}) => {
      const value = key.split('.').reduce((entry, part) => entry?.[part], catalog) ?? key;
      return typeof value === 'string'
        ? value.replace(/\{\{(\w+)\}\}/g, (match, name) => values[name] ?? match)
        : value;
    };
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
    './ProfileFieldSheet': { ProfileFieldSheet: 'ProfileFieldSheet' },
    './measurement-ruler': evaluate(read('src/features/profile/measurement-ruler.ts')),
    './profile-fields': evaluate(read('src/features/profile/profile-fields.ts'), { './administrative-units': administrative }),
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
    '@/hooks/useGuardedRouter': { useGuardedRouter: () => ({ push: route => calls.routes.push(route), replace: route => calls.routes.push(route), canGoBack: () => canGoBack, back: () => calls.routes.push('back') }) },
    '../../../src/components/AppAlertModal': { AppAlertModal: 'AppAlertModal', useAppAlert: () => ({ alertState: { visible: false }, showAlert() {}, dismissAlert() {} }) },
    '../../../src/components/AiDataConsentModal': { AiDataConsentModal: 'AiDataConsentModal', hasAiDataConsent: async () => false, revokeAiDataConsent: async () => {} },
    '../../../src/components/ScaledTextInput': { ScaledTextInput: 'TextInput' },
    '../../../src/components/RippleRefresh': { RippleRefreshScrollView: 'ScrollView' },
    '../../../src/components/ScaledText': { ScaledText: 'Text' },
    '../../../src/components/Screen': { Screen: 'Screen' },
    '../../../src/components/ScreenHeaderButton': { ScreenBackButton: 'ScreenBackButton' },
    '../../../src/components/DeleteAccountModal': { __esModule: true, default: 'DeleteAccountModal' },
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
    '../../../src/features/checkin-call/AndroidCallAccessCard': { AndroidCallAccessCard: 'AndroidAccessCard' },
    '../../../src/features/logs/logs.store': { useLogsStore: selector => selector({ fetchRecent: async () => {} }) },
    '../../../src/features/missions/missions.store': { useMissionsStore: selector => selector({ fetchMissions: async () => {} }) },
    '../../../src/features/subscription/planName': { localizedPlanName: () => 'Fixture plan' },
    '../../../src/features/subscription/components/PlanDetailsModal': { PlanDetailsModal: 'PlanDetailsModal' },
    '../../../src/stores/font-size.store': { useFontSizeStore: () => ({ scale: preferences.fontScale, multiplier,
      setScale(value) { preferences.fontScale = value; calls.fontSizes.push(value); } }) },
    '../../../src/stores/language.store': { useLanguageStore: () => ({ language: preferences.language,
      setLanguage(value) { preferences.language = value; calls.languages.push(value); } }) },
    '../../../src/hooks/useScaledTypography': { useScaledTypography: () => ({
      ...theme.typography,
      scaledSize: Object.fromEntries(Object.entries(theme.typography.size).map(([key, value]) => [key, Math.round(value * multiplier)])),
    }) },
    '../../../src/hooks/useInitialLoadingGate': { useInitialLoadingGate: () => false },
    '../../../src/lib/apiClient': { ApiError, apiClient: async () => ({}), getApiErrorMessage: (_error, t, key) => t(key) },
    '../../../src/lib/appEnv': { isDevBuild: false, isDoctorFeaturesEnabled: doctorEnabled, isCheckinUiGalleryEnabled: false },
    '../../../src/features/app-update/app-update.store': { useAppUpdateStore: Object.assign(selector => selector({ checking: false }), { getState: () => ({ check: async () => ({ status: 'current' }) }) }) },
    '../../../src/features/profile/ProfileMascotGreeting': { ProfileMascotGreeting: 'MascotGreeting' },
    '../../../src/features/profile/ProfileHealthcareBackground': {
      ProfileHealthcareBackground: () => evaluate(read('src/features/profile/ProfileHealthcareBackground.tsx'), {
        react: {},
        'react-native': { View: 'View', StyleSheet: { create: styles => styles, absoluteFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } } },
        'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
        'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' },
        '../../hooks/useThemeColors': { useThemeColors: () => ({ isDark }) },
      }).ProfileHealthcareBackground(),
    },
    '../../../src/features/profile/FontSizePickerModal': { FontSizePickerModal: 'FontSizePickerModal' },
    '../../../src/features/profile/LanguagePickerModal': { LanguagePickerModal: 'LanguagePickerModal' },
    '../../../src/features/profile/ProfileDevicePermissions': { ProfileDevicePermissions: 'DevicePermissions' },
    '../../../src/features/profile/TaskReminderPermission': { TaskReminderPermission: 'TaskReminderPermission' },
    '../../../src/features/profile/SpecialistSharingPermission': { SpecialistSharingPermission: 'SpecialistSharingPermission' },
    '../../../src/features/v21/useProfileCoins': { useProfileCoins: () => { calls.coinReads++; return coinSummary; } },
    '../../../src/features/v21/HealthCoinIcon': { HealthCoinIcon: 'HealthCoinIcon' },
    '../../../src/features/care-circle/components/QrCameraPermissionRow': { QrCameraPermissionRow: 'CameraPermissionRow' },
    '../../../src/lib/native-permissions': { runNativePermission: operation => operation() },
    '../../../src/styles': theme,
    '../../../src/hooks/useThemeColors': { useThemeColors: () => ({ isDark }) },
    '../../../src/stores/health-feed-preference': { getHealthFeedPreference: async () => true, setHealthFeedPreference: async enabled => enabled },
  };
  const { default: ProfileScreen } = evaluate(read('src/features/profile/ProfileScreen.tsx'), imports);
  const preferenceImports = {
    'react-native': { ...imports['react-native'], Text: 'NativeText' },
    '@expo/vector-icons': imports['@expo/vector-icons'],
    'react-i18next': imports['react-i18next'],
    'react-native-safe-area-context': imports['react-native-safe-area-context'],
    '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ isDark, colors: isDark ? theme.darkColors : theme.lightColors }) },
  };
  const preference = evaluate(read('src/features/profile/ProfilePreferenceModal.tsx'), preferenceImports);
  const pickerImports = { ...preferenceImports, './ProfilePreferenceModal': preference };
  const { FontSizePickerModal } = evaluate(read('src/features/profile/FontSizePickerModal.tsx'), pickerImports);
  const { LanguagePickerModal } = evaluate(read('src/features/profile/LanguagePickerModal.tsx'), pickerImports);
  const render = () => {
    let tree;
    let renders = 0;
    do {
      needsRender = false;
      cursor = 0;
      tree = ProfileScreen({ personalInformation, standalone });
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
  const modal = () => nodes(render()).find(node => node.type === 'ProfileFieldSheet');
  const fontModal = () => preference.ProfilePreferenceModal(FontSizePickerModal(nodes(render()).find(node => node.type === 'FontSizePickerModal').props).props);
  const languageModal = () => preference.ProfilePreferenceModal(LanguagePickerModal(nodes(render()).find(node => node.type === 'LanguagePickerModal').props).props);
  const showPersonalInformation = () => { personalInformation = true; return render(); };
  const open = () => {
    const page = showPersonalInformation();
    const row = nodes(page).find(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === translate('profile')('fullName'));
    row.props.onPress(); assert.ok(modal());
  };
  const toggleSection = title => {
    const header = nodes(render()).find(node => node.props.accessibilityRole === 'button'
      && node.props.accessibilityLabel === title && 'expanded' in (node.props.accessibilityState || {}));
    assert.ok(header, 'Expandable section must exist'); header.props.onPress(); return render();
  };
  return { render, showPersonalInformation, modal, fontModal, languageModal, open, toggleSection, calls,
    updateProfile: patch => { auth.profile = { ...auth.profile, ...patch }; },
    t:translate('profile'),tc:translate('common'),ts:translate('settings') };

}

let checks = 0;
async function test(label, run) { await run(); checks++; console.log(`PASS ${label}`); }
await test('personal settings open as a standalone page with a back button above the avatar', () => {
  const h = harness({ standalone: true });
  const page = h.render(), all = nodes(page);
  assert.ok(all.findIndex(n => n.type === 'ScreenBackButton') < all.findIndex(n => n.props.testID === 'profile-identity'));
  all.find(n => n.type === 'ScreenBackButton').props.onPress();
  assert.deepEqual(h.calls.routes, ['back']);
  const direct = harness({ standalone: true, canGoBack: false });
  nodes(direct.render()).find(n => n.type === 'ScreenBackButton').props.onPress();
  assert.deepEqual(direct.calls.routes, ['/(tabs)/home']);
});

for (const language of ['vi', 'en']) {
  await test(`${language}: profile, account and app menus keep their existing actions`, () => {
    const h = harness({ language, doctorEnabled: true });
    const tree = h.render();
    const groups = nodes(tree).filter(node => /^profile-group-/.test(node.props?.testID || ''));
    assert.deepEqual(groups.map(group => group.props.testID),
      ['profile-group-personal', 'profile-group-benefits', 'profile-group-app']);
    const dropdowns = group => nodes(group).filter(node => node.props.accessibilityRole === 'button'
      && 'expanded' in (node.props.accessibilityState || {})).map(node => node.props.accessibilityLabel);
    assert.deepEqual(groups.map(dropdowns), [
      [],
      [h.t('sectionAccount')],
      [h.t('sectionSettings'), h.t('sectionSystem')],
    ]);
  });
  await test(`${language}: opening Profile never reads coins or shows a duplicate coin entry`, () => {
    for (const coins of [{ enabled: true, balance: 80, earnedToday: 0 }, { enabled: false, balance: null, earnedToday: null }]) {
      const h = harness({ language, coins });
      const tree = h.render();
      assert.ok(!nodes(tree, true).some(node => node.props?.testID === 'profile-health-coins'));
      assert.equal(h.calls.coinReads, 0, 'A removed shortcut must not keep fetching its balance');
      assert.equal(nodes(tree).filter(node => /^profile-group-/.test(node.props?.testID || '')).length, 3);
    }
  });
  await test(`${language}: all quick-action destinations stay out of expanded Profile menus`, () => {
    const h = harness({ language, doctorEnabled: true });
    for (const section of ['sectionAccount', 'sectionSettings', 'sectionSystem']) h.toggleSection(h.t(section));
    const quickActions = read('src/components/HomeFeatureGrid.tsx');
    const quickRoutes = [...quickActions.matchAll(/route:\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
    for (const required of ['/doctor-consultation-history', '/privacy-center', '/doctor-care', '/logs', '/doctor-consultation', '/checkin-call/settings', '/coins', '/(tabs)/missions', '/checkin-rewards', '/checkin-rewards/history']) assert.ok(quickRoutes.includes(required), required);
    const tree = h.render();
    const profileRoutes = nodes(tree, true).flatMap(node => [...String(node.props?.onPress || '').matchAll(/router\.push\(['"]([^'"]+)['"]/g)].map(match => match[1]));
    assert.deepEqual(profileRoutes.filter(route => quickRoutes.includes(route)), [], 'Features are opened through Quick actions');
    assert.ok(!nodes(tree, true).some(node => node.type === 'DevicePermissions'));
    assert.ok(!nodes(tree).some(node => node.props.accessibilityLabel === h.ts('appPermissions')));
    assert.ok(!nodes(tree).some(node => node.props.accessibilityLabel === h.t('sectionRewards')));
  });
  await test(`${language}: an unavailable specialist feature leaves no empty Health dropdown`, () => {
    const h = harness({ language, doctorEnabled: false });
    assert.ok(!nodes(h.render()).some(node => node.props.accessibilityLabel === h.t('sectionHealth')));
  });
  await test(`${language}: healthcare backdrop stays behind content without blocking profile controls`, () => {
    const tree = harness({ language }).render();
    const screen = nodes(tree).find(node => node.type === 'Screen');
    const backdrop = screen.props.children[0];
    const background = backdrop.type();
    assert.equal(background.props.pointerEvents, 'none');
    assert.equal(background.props.accessibilityElementsHidden, true);
    assert.equal(background.props.importantForAccessibility, 'no-hide-descendants');
    const scroll = nodes(tree).find(node => node.type === 'ScrollView');
    assert.ok(!nodes(scroll).some(node => node.type === backdrop.type));
    assert.ok(nodes(tree).some(node => node.props.testID === 'profile-identity'));
    assert.ok(!nodes(scroll).some(node => node.props.testID === 'profile-identity'), 'The identity and plan stay fixed above the scrolling menu');
    assert.equal(nodes(tree).filter(node => node.type === 'MascotGreeting').length, 0, 'The profile footer has no Asinu greeting');
  });
  await test(`${language}: account deletion is under Account and its confirmation opens on the first press`, () => {
    const h = harness({ language });
    const expanded = h.toggleSection(h.t('sectionAccount'));
    const button = nodes(expanded).find(node => node.props?.accessibilityLabel === h.ts('deleteAccountForever'));
    assert.ok(button);
    button.props.onPress();
    const modal = nodes(h.render()).find(node => node.type === 'DeleteAccountModal');
    assert.ok(modal, 'First press must show the confirmation without loading a lazy module');
    assert.equal(modal.props.visible, true);
    assert.equal(typeof modal.props.onConfirm, 'function');
    modal.props.onClose();
    assert.ok(!nodes(h.render()).some(node => node.type === 'DeleteAccountModal'));
    assert.deepEqual(h.calls.saves, []);
  });
  for (const isDark of [false, true]) {
    await test(`${language}/${isDark ? 'dark' : 'light'}: profile menus expand independently and consultation tools stay in Quick actions`, () => {
      const h=harness({language,isDark,doctorEnabled:true,profile:{hasPassword:true}});
      const initial=h.render();
      const headings=nodes(initial).filter(node=>node.props.accessibilityRole==='button'&&'expanded' in(node.props.accessibilityState||{})).map(node=>node.props.accessibilityLabel);
      assert.deepEqual(headings,[h.t('sectionAccount'),h.t('sectionSettings'),h.t('sectionSystem')]);
      const account=h.toggleSection(h.t('sectionAccount'));
      assert.ok(text(account).includes(h.t('subscription')));assert.ok(text(account).includes(h.t('changePassword')));
      assert.ok(!text(account).includes(h.t('wallet')), 'Wallet is temporarily hidden from Profile');
      h.toggleSection(h.t('sectionSettings'));const all=h.toggleSection(h.t('sectionSystem'));
      assert.ok(text(all).includes(h.ts('helpSupport')));
      assert.ok(!nodes(all).some(node=>node.props.accessibilityLabel===h.t('sectionHealth')));
      assert.ok(!text(all).includes(h.ts('doctorConsultationHistory')));assert.ok(!text(all).includes(h.ts('privacyCenterTitle')));
      const closed=h.toggleSection(h.t('sectionAccount'));assert.ok(!text(closed).includes(h.t('subscription')));assert.ok(text(closed).includes(h.ts('helpSupport')));
      h.open();assert.equal(h.modal().props.field,'name');
    });
    await test(`${language}/${isDark ? 'dark' : 'light'}: all data and reminder permissions have moved out of Profile`, () => {
      const h = harness({ language, isDark, doctorEnabled: true });
      for (const section of ['sectionAccount', 'sectionSettings', 'sectionSystem']) h.toggleSection(h.t(section));
      const all = nodes(h.render(), true);
      assert.ok(!all.some(node => node.props.testID === 'profile-data-controls'));
      assert.ok(!all.some(node => node.props.accessibilityLabel === h.t('sectionData')));
      for (const type of ['TaskReminderPermission', 'SpecialistSharingPermission', 'ReminderSettingsEntry', 'AiDataConsentModal'])
        assert.ok(!all.some(node => node.type === type));
      assert.ok(!all.some(node => node.type === 'Switch'));
    });
    await test(`${language}/${isDark ? 'dark' : 'light'}: font and language modals show previews, retain selections and dismiss without changes`, () => {
      const h = harness({ language, isDark });
      h.toggleSection(h.t('sectionSettings'));
      const control = key => nodes(h.render()).find(node => node.props.accessibilityRole === 'button'
        && node.props.accessibilityLabel === h.ts(key));
      const groups = () => nodes(nodes(h.render()).find(node => node.type === 'ScrollView'))
        .filter(node => node.props.accessibilityRole === 'radiogroup');
      const fontOptions = () => nodes(h.fontModal()).filter(node => node.props.accessibilityRole === 'radio');
      const languageOptions = () => nodes(h.languageModal()).filter(node => node.props.accessibilityRole === 'radio');
      assert.equal(control('fontSize').props.accessibilityState?.expanded, undefined, 'Font size opens a modal rather than a dropdown');
      assert.equal(control('language').props.accessibilityState?.expanded, undefined, 'Language opens a modal rather than a dropdown');
      control('fontSize').props.onPress();
      assert.equal(groups().length, 0, 'Font choices must not expand inside the profile page');
      assert.equal(h.fontModal().type, 'Modal');
      assert.equal(h.fontModal().props.visible, true);
      assert.equal(fontOptions().length, 4);
      const previews = nodes(h.fontModal()).filter(node => node.type === 'NativeText' && node.props.children === h.ts('fontPreview'));
      assert.deepEqual(previews.map(node => Object.assign({}, ...node.props.style).fontSize), [14, 16, 18, 20]);
      assert.ok(previews.every(node => node.props.allowFontScaling === false), 'A preview must use its target size rather than multiplying the current scale again');
      assert.equal(fontOptions().find(node => node.props.accessibilityState.checked).props.accessibilityLabel, h.ts('fontNormal'));
      assert.equal(nodes(h.render()).filter(node => node.type === 'Modal' && node.props.visible).length, 0);
      fontOptions().find(node => node.props.accessibilityLabel === h.ts('fontLarge')).props.onPress();
      assert.deepEqual(h.calls.fontSizes, ['large']);
      assert.equal(h.fontModal().props.visible, false);
      control('fontSize').props.onPress();
      assert.equal(fontOptions().find(node => node.props.accessibilityState.checked).props.accessibilityLabel, h.ts('fontLarge'));
      h.fontModal().props.onRequestClose();
      assert.equal(h.fontModal().props.visible, false);
      assert.deepEqual(h.calls.fontSizes, ['large'], 'Dismissing the modal must not change the preference');
      control('language').props.onPress();
      assert.equal(groups().length, 0);
      assert.equal(h.languageModal().props.visible, true);
      assert.equal(h.languageModal().type, 'Modal');
      assert.deepEqual(nodes(h.languageModal()).filter(node => node.type === 'NativeText').map(node => node.props.children), ['🇻🇳', '🇬🇧']);
      assert.equal(h.fontModal().props.visible, false, 'Opening language does not stack another preference modal');
      assert.equal(languageOptions().length, 2);
      const next = language === 'vi' ? 'en' : 'vi';
      const nextLabel = h.ts(next === 'vi' ? 'languageVi' : 'languageEn');
      languageOptions().find(node => node.props.accessibilityLabel === nextLabel).props.onPress();
      assert.deepEqual(h.calls.languages, [next]);
      assert.equal(h.languageModal().props.visible, false);
      control('language').props.onPress();
      assert.equal(languageOptions().find(node => node.props.accessibilityState.checked).props.accessibilityLabel, nextLabel);
      h.languageModal().props.onRequestClose();
      assert.equal(h.languageModal().props.visible, false);
      assert.deepEqual(h.calls.languages, [next]);
      assert.equal(groups().length, 0);
    });
  }
  await test(`${language}: personal information and the name open a separate page without expanding or saving`, () => {
    const h = harness({ language });
    const main = h.render();
    const entry = nodes(main).find(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === h.t('personalInfo'));
    assert.equal(entry.props.accessibilityState?.expanded, undefined);
    entry.props.onPress();
    const identity = nodes(main).find(node => node.props.testID === 'profile-identity');
    const nameButton = nodes(identity).find(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Demo');
    nameButton.props.onPress();
    assert.deepEqual(h.calls.routes, ['/personal-information', '/personal-information']);
    assert.equal(h.modal(), undefined);
    assert.equal(h.calls.saves.length, 0);
    const menu = nodes(main).find(node => node.type === 'ScrollView');
    assert.ok(!nodes(menu).some(node => node.type === 'Text' && node.props.children === h.t('bloodType')));
  });
  await test(`${language}: the information page shows saved rows, opens the existing editor and goes back`, () => {
    const h = harness({ language });
    const page = h.showPersonalInformation();
    assert.ok(!nodes(page).some(node => /^profile-group-/.test(node.props.testID || '')));
    assert.ok(!nodes(page).some(node => node.props.testID === 'profile-identity'));
    const rows = nodes(page).filter(node => node.props.accessibilityRole === 'button' && node.props.accessibilityHint === h.t('editProfile'));
    assert.equal(rows.length, 8);
    const row = key => rows.find(node => node.props.accessibilityLabel === h.t(key));
    assert.ok(text(row('fullName')).includes('Demo'));
    assert.ok(text(row('bloodType')).includes('A+'));
    const phone = nodes(page).find(node=>node.props.accessibilityLabel===h.t('phone'));
    assert.ok(text(phone).includes(h.tc('notUpdated')));assert.equal(phone.props.disabled,true);assert.equal(phone.props.onPress,undefined);assert.ok(!nodes(phone).some(node=>node.type==='Icon'));
    row('fullName').props.onPress(); assert.ok(h.modal());
    assert.equal(h.modal().props.field, 'name');
    h.modal().props.onClose();
    nodes(h.render()).find(node => node.props.accessibilityLabel === h.tc('back')).props.onPress();
    assert.deepEqual(h.calls.routes, ['back']);
    assert.equal(h.calls.saves.length, 0);
  });
  await test(`${language}: a directly opened information page can return to Profile`, () => {
    const h = harness({ language, personalInformation: true, canGoBack: false });
    nodes(h.render()).find(node => node.props.accessibilityLabel === h.tc('back')).props.onPress();
    assert.deepEqual(h.calls.routes, ['/account']);
  });
}
await test('the header camera uploads once, updates the avatar and leaves the editor closed', async () => {
  let resolveUpload;
  const h = harness({ uploadAvatar: () => new Promise(resolve => { resolveUpload = resolve; }) });
  const identity = () => nodes(h.render()).find(node => node.props.testID === 'profile-identity');
  const camera = () => nodes(identity()).find(node => node.props.accessibilityLabel === h.t('uploadPhoto'));
  const upload = camera().props.onPress();
  const duplicate = camera().props.onPress();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(h.calls.uploads.length, 1);
  assert.equal(camera().props.disabled, true);
  assert.equal(camera().props.accessibilityState.busy, true);
  assert.equal(h.modal(), undefined);
  resolveUpload({ id: 'profile-fixture', name: 'Demo', avatarUrl: 'header-avatar' });
  await Promise.all([upload, duplicate]);
  assert.ok(nodes(identity()).some(node => node.type === 'Image' && node.props.source.uri === 'header-avatar'));
  assert.equal(camera().props.disabled, false);
  assert.equal(h.calls.saves.length, 0, 'Changing the avatar cannot submit the profile form');
});

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
  const toast = evaluate(read('src/stores/toast.store.ts'), { zustand: { create },
    '../lib/checkin-presentation': { checkinPresentation: { defer: () => false, subscribe: () => () => {} } },
    '../lib/tokenStore': { tokenStore: { subscribeSession: () => () => {} } },
  });
  const host = evaluate(read('src/components/GlobalToastHost.tsx'), {
    react: {
      useCallback: fn => fn, useId: () => scope,
      useLayoutEffect: effect => { if (!cleanups.has(scope)) cleanups.set(scope, effect()); },
    },
    zustand: { create }, '../stores/toast.store': toast, './Toast': { Toast: 'Toast' },
    '../hooks/useCheckinPresentation': { useCheckinPresentationBlocked: () => false },
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
// Run the actual profile logout callback against the persistent toast host.
const profileAst = ts.createSourceFile('profile.tsx', read('src/features/profile/ProfileScreen.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let logoutCallback;
function findLogout(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(profileAst) === 'handleLogout') logoutCallback = node.initializer.arguments[0].getText(profileAst);
  ts.forEachChild(node, findLogout);
}
findLogout(profileAst);
assert.ok(logoutCallback);
const { createLogoutHandler } = evaluate(`export function createLogoutHandler(deps) {
  const { logout, setShowLogoutModal, showToast, setPendingToast, t, router } = deps;
  return ${logoutCallback};
}`);
const loginAst = ts.createSourceFile('login.tsx', read('app/login/email.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let loginMount;
function findLoginMount(node) {
  if (ts.isCallExpression(node) && node.expression.getText(loginAst) === 'React.useEffect' && node.arguments[0]?.getText(loginAst).includes('flushPending()')) loginMount = node.arguments[0].getText(loginAst);
  ts.forEachChild(node, findLoginMount);
}
findLoginMount(loginAst);
assert.ok(loginMount);
const { mountLogin } = evaluate(`export function mountLogin(deps) {
  const { flushPending, useAuthStore } = deps;
  return (${loginMount})();
}`);
for (const language of ['vi', 'en']) {
  for (const loginFirst of [true, false]) {
    await test(`${language}: logout success remains visible when Login mounts ${loginFirst ? 'before' : 'after'} logout completes`, async () => {
      const h = toastHarness(); const expected = JSON.parse(read(`src/i18n/locales/${language}/profile.json`)).logoutSuccess;
      let finish; const pending = new Promise(resolve => { finish = resolve; });
      const routes = []; const visibility = [];
      const confirm = createLogoutHandler({
        logout: () => pending, setShowLogoutModal: value => visibility.push(value),
        showToast: h.showToast, setPendingToast: h.setPendingToast, t: key => { assert.equal(key, 'logoutSuccess'); return expected; },
        router: { replace: path => routes.push(path) },
      });
      const enterLogin = () => mountLogin({ flushPending: h.useToastStore.getState().flushPending, useAuthStore: { setState() {} } });
      const work = confirm();
      assert.deepEqual(visibility, [false]); assert.equal(h.root().props.visible, false);
      assert.equal(h.useToastStore.getState().pending, null, 'success must not be queued before logout completes');
      if (loginFirst) enterLogin();
      finish(); await work;
      assert.equal(h.root().props.visible, true); assert.equal(h.root().props.message, expected);
      assert.equal(h.root().props.type, 'success'); assert.deepEqual(routes, ['/login']);
      if (!loginFirst) enterLogin();
      assert.equal(h.useToastStore.getState().toastId, 1, 'navigation must not duplicate the success message');
      assert.equal(h.useToastStore.getState().pending, null, 'logout feedback must not leak into the next login');
    });
  }
}
await test('an incomplete logout cannot show success or navigate to Login', async () => {
  const h = toastHarness(); const routes = [];
  const confirm = createLogoutHandler({
    logout: async () => { throw new Error('local logout cleanup failed'); }, setShowLogoutModal() {},
    showToast: h.showToast, setPendingToast: h.setPendingToast, t: () => 'Logged out successfully',
    router: { replace: path => routes.push(path) },
  });
  await assert.rejects(confirm(), /local logout cleanup failed/);
  assert.equal(h.root().props.visible, false); assert.equal(h.useToastStore.getState().pending, null);
  assert.deepEqual(routes, []);
});

await test('the Other gender choice is retained on the personal information page',()=>{const h=harness({personalInformation:true,profile:{gender:'Khác'}});assert.ok(text(h.render()).includes(h.t('genderOther')));});
await test('saved measurements hide decimal zeroes and retain meaningful decimal values',()=>{const h=harness({personalInformation:true,profile:{heightCm:'176.00',weightKg:'75.00'}});const page=h.render();assert.ok(text(page).includes('176 cm'));assert.ok(text(page).includes('75 kg'));assert.ok(!text(page).includes('176.00'));h.updateProfile({weightKg:'75.50'});assert.ok(text(h.render()).includes('75.5 kg'));});
console.log(`Profile editing: ${checks} runtime regressions passed.`);
