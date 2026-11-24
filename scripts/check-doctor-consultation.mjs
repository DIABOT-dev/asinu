import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (file) => fs.readFileSync(file, "utf8");
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
function load(file, imports = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(read(file), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  new Function("module", "exports", "require", "FormData", source)(
    module,
    module.exports,
    (name) => {
      if (name === "react/jsx-runtime") return require(name);
      assert.ok(name in imports, `Unexpected dependency ${name}`);
      return imports[name];
    },
    imports.FormData ?? FormData
  );
  return module.exports;
}
function hooks() {
  let cursor = 0,
    effects = [];
  const slots = [];
  const memo = (run, deps) => {
    const index = cursor++,
      old = slots[index];
    if (!old || deps.some((item, i) => !Object.is(item, old.deps[i])))
      slots[index] = { deps, value: run() };
    return slots[index].value;
  };
  return {
    useRef: (value) => (slots[cursor++] ??= { current: value }),
    useState: (initial) => {
      const index = cursor++;
      slots[index] ??= {
        value: typeof initial === "function" ? initial() : initial,
      };
      return [
        slots[index].value,
        (value) => {
          slots[index].value =
            typeof value === "function" ? value(slots[index].value) : value;
        },
      ];
    },
    useMemo: memo,
    useCallback: (run, deps) => memo(() => run, deps),
    useEffect: (run, deps) => {
      const index = cursor++,
        old = slots[index];
      if (!old || deps.some((item, i) => !Object.is(item, old.deps[i]))) {
        slots[index] = { deps };
        effects.push(() => {
          old?.cleanup?.();
          slots[index].cleanup = run();
        });
      }
    },
    render(run) {
      cursor = 0;
      const result = run();
      const pending = effects;
      effects = [];
      pending.forEach((work) => work());
      return result;
    },
    async settle(run) {
      let result;
      for (let i = 0; i < 7; i++) {
        result = this.render(run);
        await tick();
      }
      return result;
    },
    unmount() {
      for (const slot of slots) slot?.cleanup?.();
    },
    remount() {
      this.unmount();
      slots.length = 0;
      effects = [];
    },
  };
}
const nodes = (tree) =>
  !tree || typeof tree !== "object"
    ? []
    : Array.isArray(tree)
    ? tree.flatMap(nodes)
    : [tree, ...nodes(tree.props?.children)];
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const theme = load("src/styles/theme.ts");
// API response fixtures keep mobile state tests independent of a backend checkout.
function evaluateConsultationScreening({ answers = [], locale = "vi" }) {
  const catalog = JSON.parse(read(`src/i18n/locales/${locale}/home.json`));
  const steps = ["red_flags", "associated", "onset", "progression", "impact"];
  const values = [
    ["option:0", "option:1", "none", "unsure"],
    ["option:0", "option:1", "none"],
    ["today", "two_to_seven_days", "over_one_week", "ongoing"],
    ["improving", "stable", "worsening"],
    ["mild", "moderate", "severe"],
  ];
  const question = (index) => ({
    step: steps[index],
    title: `Screening ${steps[index]}`,
    options: values[index].map((value) => ({
      value,
      label:
        catalog[`doctorConsultationSeverity_${value}`] ||
        catalog[`doctorConsultationOnset_${value}`] ||
        catalog[`doctorConsultationProgression_${value}`] ||
        value,
    })),
    multiSelect: index < 2,
    allowFreeText: index < 2,
  });
  const danger = answers.find((answer) => answer.step === "red_flags");
  const status = danger?.values.includes("unsure")
    ? "incomplete"
    : danger && !danger.values.includes("none")
    ? "needs_in_person"
    : answers.length === 5
    ? "ready"
    : "question";
  const field = (name) =>
    answers.find((answer) => answer.step === name)?.values[0];
  return {
    status,
    isDone: status !== "question",
    suitable_for_remote_care: status === "ready",
    risk_level: status === "ready" ? "low" : "medium",
    message: status === "question" ? null : "Screening information recorded.",
    ...(status === "question" ? { question: question(answers.length) } : {}),
    intake: {
      symptom_onset: field("onset"),
      progression: field("progression"),
      severity: field("impact"),
    },
    recorded_answers: answers.map((answer, index) => ({
      step: answer.step,
      question: question(index).title,
      answers: answer.values.map(
        (value) =>
          question(index).options.find((option) => option.value === value)
            ?.label || value
      ),
    })),
  };
}
let checks = 0;
async function test(name, run) {
  await run();
  checks++;
  console.log(`PASS ${name}`);
}

async function historyHarness(tasks, isDark = false) {
  const runtime = hooks();
  const navigation = [];
  const colors = isDark ? theme.darkColors : theme.lightColors;
  const environment = { env: { doctorTenantId: "default-clinic" } };
  const taskService = load("src/features/doctor-consultation/consultation-tasks.ts", {
    "../../lib/appEnv": { isExpertConsultationEnabled: true },
    "../../lib/env": environment,
    "../../lib/apiClient": {
      apiClient: async (resource) =>
        resource === "/api/doctor/clinics"
          ? { ok: true, data: { items: [] } }
          : { ok: true, data: { tasks } },
    },
  });
  const Screen = load("app/doctor-consultation-history.tsx", {
    react: runtime,
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "expo-router": {
      Stack: { Screen: "StackScreen" },
      useFocusEffect: (callback) => runtime.useEffect(callback, [callback]),
    },
    "react-i18next": {
      useTranslation(name) {
        const catalog = JSON.parse(read(`src/i18n/locales/vi/${name}.json`));
        return {
          t: (key, options) => catalog[key] ?? options?.defaultValue,
          i18n: { language: "vi" },
        };
      },
    },
    "react-native": {
      ActivityIndicator: "ActivityIndicator",
      Pressable: "Pressable",
      SectionList: "SectionList",
      StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
      View: "View",
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 59, bottom: 34 }),
    },
    "../src/components/ScaledText": { ScaledText: "Text" },
    "../src/components/Screen": { Screen: "Screen" },
    "../src/components/ScreenHeaderButton": { ScreenBackButton: "Back" },
    "../src/hooks/useThemeColors": { useThemeColors: () => ({ colors }) },
    "../src/hooks/useGuardedRouter": {
      useGuardedRouter: () => ({ push: (route) => navigation.push(route) }),
    },
    "../src/features/doctor-consultation/consultation-tasks": taskService,
    "../src/lib/env": environment,
    "../src/styles": theme,
  }).default;
  const screen = await runtime.settle(Screen);
  const list = nodes(screen).find(({ type }) => type === "SectionList");
  return { list: list.props, colors, navigation };
}

await test("history cards put the consultation subject first and keep the latest message and destination", async () => {
  const item = {
    task_id: "consultation-1",
    tenant_id: "clinic-1",
    status: "started",
    summary: "Đau đầu\nĐã ghi nhận thông tin sàng lọc để chuyển cho chuyên gia.",
    latest_message: "Chào bạn",
    created_at: "2026-11-19T08:27:00Z",
  };
  for (const isDark of [false, true]) {
    const { list, colors, navigation } = await historyHarness([item], isDark);
    assert.equal(list.sections.length, 1);
    const card = list.renderItem({ item });
    const text = nodes(card).filter(({ type }) => type === "Text").map(({ props }) => props.children);
    assert.deepEqual(text.slice(0, 2), ["Đau đầu", "Chào bạn"]);
    assert.ok(text.includes("Đang tư vấn"));
    assert.equal(card.props.style({ pressed: false })[0].backgroundColor, colors.surface);
    assert.equal(card.props.style({ pressed: false })[0].borderWidth, 1);
    card.props.onPress();
    assert.deepEqual(navigation, [{
      pathname: "/doctor-consultation/[taskId]",
      params: { taskId: item.task_id, tenantId: item.tenant_id },
    }]);
  }
});

await test("history cards keep closed cases and follow-ups legible when later messages are absent or are attachments", async () => {
  const closed = {
    task_id: "closed-1",
    status: "completed",
    summary: "Tư vấn huyết áp\nGhi chú từ ca tư vấn.",
    created_at: "2026-11-19T08:27:00Z",
  };
  const followup = {
    ...closed,
    task_id: "followup-1",
    follow_up_until: "2099-09-01T00:00:00Z",
    latest_message: "[ASINU_VOICE] private attachment metadata",
  };
  const { list } = await historyHarness([closed, followup]);
  assert.deepEqual(list.sections.map(({ data }) => data.map(({ task_id }) => task_id)), [
    ["followup-1"], ["closed-1"],
  ]);
  const testText = (item) =>
    nodes(list.renderItem({ item })).filter(({ type }) => type === "Text").map(({ props }) => props.children);
  assert.ok(testText(closed).includes("Ghi chú từ ca tư vấn."));
  assert.ok(testText(closed).includes("Ca tư vấn đã hoàn tất"));
  assert.ok(testText(followup).includes("Có thể trao đổi thêm"));
  assert.ok(testText(followup).includes(JSON.parse(read("src/i18n/locales/vi/home.json")).doctorConsultationVoiceMessage));
  assert.ok(!testText(followup).some((text) => String(text).includes("private attachment metadata")));
});

function harness(language = "vi", platform = "ios") {
  const runtime = hooks(),
    routeRuntime = hooks(),
    secure = new Map(),
    plain = new Map(),
    calls = [],
    navigation = [],
    toasts = [];
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/home.json`));
  const common = JSON.parse(read(`src/i18n/locales/${language}/common.json`));
  const t = (key, values = {}) => {
    const value = key.startsWith("common:")
      ? common[key.slice(7)]
      : key.split(".").reduce((entry, part) => entry?.[part], catalog);
    assert.equal(
      typeof (value || values.defaultValue),
      "string",
      `Missing copy ${key}`
    );
    return String(value || values.defaultValue).replace(
      /{{([^}]+)}}/g,
      (_, name) => values[name] ?? ""
    );
  };
  let routeParams = {};
  let hardwareBack;
  let pickedImages = [];
  let pickedDocuments = [];
  const pickerCalls = [];
  let owner = "A",
    token = "token-A",
    generation = 0,
    failGet = false,
    failPost = false,
    failDraftRemoval = false,
    holdRead,
    holdWrite;
  let options = [
    { code: "general", name: "General" },
    { code: "internal_medicine", name: "Internal medicine" },
  ];
  const doctor = (id, specialty = "general") => ({
    doctorId: id,
    fullName: id,
    specialties: [specialty],
    reputation: 4,
    preferred: false,
    estimatedWaitMinutes: 0,
    routingTenantId: "clinic-demo",
    availability: "online",
  });
  let doctors = [doctor("expert-A")],
    responder;
  const secureStorage = {
    async getItem(key) {
      const value = secure.get(key) ?? null;
      if (holdRead) await holdRead;
      return value;
    },
    async setItem(key, value) {
      if (holdWrite) await holdWrite;
      secure.set(key, value);
    },
    async removeItem(key) {
      if (failDraftRemoval) throw new Error("Could not delete the draft");
      secure.delete(key);
    },
  };
  const session = load("src/lib/healthStoreSession.ts", {
    "./secureStorage": { secureStorage },
    "./tokenStore": {
      tokenStore: { getToken: () => token, subscribeSession() {} },
    },
  });
  session.healthStoreSession.setOwner(owner);
  const healthModule = session;
  const apiClient = async (url, input) => {
    calls.push({ url, input });
    if (responder) {
      const result = responder(url, input);
      if (result !== undefined) return result;
    }
    if (url.includes("/reconsultation?"))
      return { data: { specialty: "general", tenant_id: "clinic-demo" } };
    if (url === "/api/doctor/screening")
      return {
        data: evaluateConsultationScreening(input.body, { birth_year: 1992 }),
      };
    if (url === "/api/doctor/specialty-options") {
      if (failGet) throw new Error("Offline");
      return { data: { items: options } };
    }
    if (url === "/api/doctor/specialists")
      return {
        data: {
          items: doctors,
          estimatedWaitMinutes: doctors.length ? 0 : null,
        },
      };
    if (input?.method === "POST" && url === "/api/doctor/tasks") {
      if (failPost) throw new Error("Save failed");
      return { data: { task_id: "saved-task" } };
    }
    return { data: { tasks: [] } };
  };
  const draftHook = load(
    "src/features/doctor-consultation/useConsultationDraft.ts",
    { react: runtime, "../../lib/healthStoreSession": healthModule }
  );
  const directoryHook = load(
    "src/features/doctor-consultation/useConsultationDirectory.ts",
    {
      react: runtime,
      "../../lib/apiClient": { apiClient },
      "../../lib/appEnv": { isExpertConsultationEnabled: true },
    }
  );
  const screeningHook = load(
    "src/features/doctor-consultation/useConsultationScreening.ts",
    {
      react: runtime,
      "../../lib/apiClient": { apiClient },
      "../../lib/appEnv": { isExpertConsultationEnabled: true },
    }
  );
  let renderingRoute = false;
  const Screen = load("app/doctor-consultation.tsx", {
    react: {
      ...runtime,
      useState: (initial) => (renderingRoute ? routeRuntime : runtime).useState(initial),
    },
    "expo-linear-gradient": { LinearGradient: "Gradient" },
    "expo-router": {
      Stack: { Screen: "Stack" },
      useFocusEffect: (effect) => runtime.useEffect(effect, [effect]),
      useLocalSearchParams: () => routeParams,
    },
    "react-native": {
      ActivityIndicator: "Spinner",
      BackHandler: {
        addEventListener: (_event, listener) => {
          hardwareBack = listener;
          return { remove: () => { hardwareBack = undefined; } };
        },
      },
      Image: "Image",
      Keyboard: { dismiss() {} },
      KeyboardAvoidingView: "Keyboard",
      Modal: "Modal",
      Platform: { OS: platform },
      Pressable: "Button",
      RefreshControl: "Refresh",
      ScrollView: "Scroll",
      useWindowDimensions: () => ({ width: 393, fontScale: 1 }),
      View: "View",
      StyleSheet: { create: (value) => value },
    },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "expo-image-picker": {
      UIImagePickerPreferredAssetRepresentationMode: { Compatible: "compatible" },
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
      launchImageLibraryAsync: async (config) => {
        pickerCalls.push(config);
        return { canceled: false, assets: pickedImages };
      },
    },
    "expo-document-picker": {
      getDocumentAsync: async (config) => {
        pickerCalls.push(config);
        return { canceled: false, assets: pickedDocuments };
      },
    },
    "expo-file-system": { File: class { delete() {} } },
    FormData: class {
      entries = [];
      append(key, value) { this.entries.push({ key, value }); }
    },
    "@react-native-async-storage/async-storage": {
      __esModule: true,
      default: {
        getItem: async (key) => plain.get(key) ?? null,
        setItem: async (key, value) => plain.set(key, value),
        removeItem: async (key) => plain.delete(key),
      },
    },
    "react-i18next": { useTranslation: () => ({ t, i18n: { language } }) },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 20, bottom: 20 }),
    },
    "../src/features/doctor-consultation/DoctorConsultationIntake": {
      DoctorConsultationIntake: "Intake",
    },
    "../src/features/doctor-consultation/useConsultationDraft": draftHook,
    "../src/features/doctor-consultation/useConsultationScreening":
      screeningHook,
    "../src/features/doctor-consultation/useConsultationDirectory":
      directoryHook,
    "../src/lib/native-permissions": { runNativePermission: (run) => run() },
    "../src/components/ScaledText": { ScaledText: "Text" },
    "../src/components/AppAlertModal": { AppAlertModal: "Alert" },
    "../src/components/ScreenHeaderButton": { ScreenBackButton: "Back" },
    "../src/features/auth/auth.store": {
      useAuthStore: (selector) =>
        selector({ profile: { id: owner, consentVersion: "v1" } }),
    },
    "../src/lib/apiClient": {
      apiClient,
      getApiErrorMessage: (_error, translate, key) => translate(key),
    },
    "../src/lib/env": { env: { doctorTenantId: "clinic-demo" } },
    "../src/lib/healthStoreSession": session,
    "../src/hooks/useThemeColors": {
      useThemeColors: () => ({ colors: theme.lightColors, isDark: false }),
    },
    "../src/hooks/useGuardedRouter": {
      useGuardedRouter: () => ({
        back: () => navigation.push("back"),
        replace: (route) => navigation.push(route),
        push: (route) => navigation.push(route),
      }),
    },
    "../src/stores/toast.store": {
      showToast: (message, type) => toasts.push({ message, type }),
    },
  }).default;
  let formKey;
  const renderForm = () => {
    renderingRoute = true;
    const form = routeRuntime.render(Screen);
    renderingRoute = false;
    if (form.key !== formKey) {
      runtime.remount();
      formKey = form.key;
    }
    return form.type(form.props);
  };
  const render = () => runtime.render(renderForm);
  const settle = () => runtime.settle(renderForm);
  const get = (tree, type) => nodes(tree).find((node) => node.type === type);
  const button = (tree, text) =>
    nodes(tree).find(
      (node) =>
        node.type === "Button" &&
        (node.props.accessibilityLabel === text || nodes(node).some(
          (child) => child.type === "Text" && child.props.children === text
        ))
    );
  const complete = async () => {
    let tree = await settle();
    const intake = get(tree, "Intake").props;
    if (intake.stage === "description") await intake.onStartScreening();
    else if (!intake.screening.result) await intake.screening.check();
    tree = await settle();
    const defaults = {
      red_flags: "none",
      associated: "none",
      onset: "two_to_seven_days",
      progression: "stable",
      impact: "mild",
    };
    for (let i = 0; i < 5; i++) {
      const screening = get(tree, "Intake").props.screening;
      const question = screening.result?.question;
      if (!question) break;
      await screening.answer({
        step: question.step,
        values: [defaults[question.step]],
        text: "",
      });
      tree = await settle();
    }
    assert.equal(get(tree, "Intake").props.screening.result?.status, "ready");
    return tree;
  };
  const fill = async () => {
    const tree = await settle();
    get(tree, "Intake").props.onSummaryChange(
      "Ca kiểm thử: đau mỏi cổ vai sau khi làm việc."
    );
    return complete();
  };
  const chooseSpecialist = async (tree) => {
    get(tree, "Intake").props.onContinue();
    tree = await settle();
    const seeSpecialists = button(tree, t("doctorConsultationSeeSpecialists"));
    if (!seeSpecialists) return tree;
    if (seeSpecialists.props.disabled) {
      const option = nodes(tree).find((node) => node.props.accessibilityRole === "radio");
      if (!option) return tree;
      option.props.onPress();
      tree = await settle();
    }
    button(tree, t("doctorConsultationSeeSpecialists")).props.onPress();
    return settle();
  };
  const cancelDraft = async (tree) => {
    button(tree, t("doctorConsultationDiscardAction")).props.onPress();
    tree = await settle();
    const alert = nodes(tree).find((node) =>
      node.type === "Alert" && node.props.title === t("doctorConsultationDiscardTitle")
    );
    alert.props.onDismiss();
    await alert.props.buttons.find((item) => item.style === "destructive").onPress();
    return settle();
  };
  const review = async (tree) => {
    button(tree, t("common:continue")).props.onPress();
    return settle();
  };
  return {
    runtime,
    secure,
    plain,
    calls,
    navigation,
    toasts,
    t,
    render,
    settle,
    get,
    button,
    fill,
    complete,
    chooseSpecialist,
    cancelDraft,
    review,
    pressHardwareBack: () => hardwareBack?.() ?? false,
    pickerCalls,
    setPickedImages(value) { pickedImages = value; },
    setPickedDocuments(value) { pickedDocuments = value; },
    setParams(value) {
      routeParams = value;
    },
    changeLanguage(value) {
      language = value;
    },
    changeOwner(value) {
      owner = value;
      token = `token-${value}`;
      generation++;
      session.healthStoreSession.setOwner(value);
    },
    setOptions(value) {
      options = value;
    },
    setDoctors(value) {
      doctors = value;
    },
    doctor,
    failGet(value) {
      failGet = value;
    },
    failPost(value) {
      failPost = value;
    },
    failDraftRemoval(value) {
      failDraftRemoval = value;
    },
    holdRead(value) {
      holdRead = value;
    },
    holdWrite(value) {
      holdWrite = value;
    },
    respond(value) {
      responder = value;
    },
  };
}

await test("the consultation form opens without a credit banner or a credit lookup", async () => {
  const h = harness();
  const tree = await h.settle();
  assert.ok(h.get(tree, "Intake"));
  assert.ok(!h.calls.some(({ url }) => url === "/api/doctor/credits"));
  const copy = nodes(tree).filter((node) => node.type === "Text").map((node) => node.props.children);
  assert.ok(!copy.some((label) => typeof label === "string" && /^doctorCredit|Có 1 lượt/.test(label)));
});

await test("consultation progress is read-only and Back cannot reopen completed steps", async () => {
  const h = harness("vi", "android");
  let tree = await h.settle();
  const progress = () => nodes(tree).find((node) => node.props.accessibilityRole === "progressbar");
  assert.deepEqual(progress().props.accessibilityValue, { min: 1, max: 4, now: 1 });
  assert.ok(h.get(tree, "Back"));
  assert.equal(h.pressHardwareBack(), false);
  h.get(tree, "Intake").props.onSummaryChange("Tôi bị đau bụng");
  tree = await h.settle();
  assert.ok(!h.calls.some(({ url }) => url === "/api/doctor/screening"));

  await h.get(tree, "Intake").props.onStartScreening();
  tree = await h.settle();
  const screening = h.get(tree, "Intake").props;
  assert.equal(screening.stage, "screening");
  assert.equal(progress().props.accessibilityValue.now, 2);
  assert.ok(nodes(progress()).every((node) => node.type !== "Button"));
  assert.equal(h.get(tree, "Back"), undefined);
  assert.equal(h.get(tree, "Stack").props.options.gestureEnabled, false);
  assert.equal(h.pressHardwareBack(), true);
  assert.equal(screening.screening.result.question.step, "red_flags");

  tree = await h.chooseSpecialist(await h.complete());
  assert.equal(progress().props.accessibilityValue.now, 3);
  assert.equal(h.get(tree, "Scroll").key, "consultation-experts");
  assert.equal(h.button(tree, h.t("doctorConsultationSpecialty_general")), undefined);
  tree = await h.review(tree);
  assert.equal(progress().props.accessibilityValue.now, 4);
  assert.equal(h.button(tree, h.t("common:back")), undefined);
  assert.equal(h.pressHardwareBack(), true);
  tree = await h.cancelDraft(tree);
  assert.equal(progress().props.accessibilityValue.now, 1);
  assert.equal(h.pressHardwareBack(), false);
});

await test("a new description after cancellation starts screening from its first question", async () => {
  const h = harness();
  let tree = await h.cancelDraft(await h.fill());
  h.get(tree, "Intake").props.onSummaryChange("Đau bụng từ sáng");
  tree = await h.settle();
  await h.get(tree, "Intake").props.onStartScreening();
  tree = await h.settle();
  assert.equal(h.get(tree, "Intake").props.screening.result.question.step, "red_flags");
  assert.deepEqual(h.calls.filter(({ url }) => url === "/api/doctor/screening").at(-1).input.body, {
    summary: "Đau bụng từ sáng", answers: [], locale: "vi",
  });
});

await test("cancel keeps the draft until confirmed and clears its secure copy and retry ID", async () => {
  const h = harness();
  let tree = await h.chooseSpecialist(await h.fill());
  const draftKey = [...h.secure.keys()][0];
  const requestKey = "@asinu/doctor-consultation/pending-task-id:A:new";
  h.plain.set(requestKey, "retry-keep");
  h.button(tree, "expert-A").props.onPress();
  tree = await h.settle();
  const openConfirmation = async () => {
    h.button(tree, h.t("doctorConsultationDiscardAction")).props.onPress();
    tree = await h.settle();
    const alert = nodes(tree).find((node) =>
      node.type === "Alert" && node.props.title === h.t("doctorConsultationDiscardTitle")
    );
    assert.equal(alert.props.visible, true);
    alert.props.onDismiss();
    return alert.props.buttons.find((button) => button.style === "destructive");
  };
  await openConfirmation();
  assert.ok(h.secure.has(draftKey));
  assert.equal(h.plain.get(requestKey), "retry-keep");

  h.failDraftRemoval(true);
  await (await openConfirmation()).onPress();
  tree = await h.settle();
  assert.ok(h.secure.has(draftKey));
  assert.equal(h.plain.get(requestKey), "retry-keep");
  assert.equal(h.toasts.at(-1).message, h.t("doctorConsultationDiscardError"));
  assert.equal(h.button(tree, "expert-A").props.accessibilityState.selected, true);

  h.failDraftRemoval(false);
  await (await openConfirmation()).onPress();
  tree = await h.settle();
  assert.ok(!h.secure.has(draftKey));
  assert.ok(!h.plain.has(requestKey));
  assert.equal(h.get(tree, "Intake").props.stage, "description");
  assert.equal(h.get(tree, "Intake").props.summary, "");
  assert.equal(h.toasts.at(-1).message, h.t("doctorConsultationDiscarded"));
  assert.ok(!h.calls.some(({ input }) => ["DELETE", "PATCH"].includes(input?.method)));
  tree = await h.chooseSpecialist(await h.fill());
  assert.equal(h.button(tree, "expert-A").props.accessibilityState.selected, false);
});

await test("the expert carousel snaps horizontally and presents ratings, availability, and wait from the directory", async () => {
  const h = harness();
  h.setDoctors([
    { ...h.doctor("expert-A"), specialties: ["Nội khoa", "internal-medicine", "staff-only"], ratingCount: 5 },
    { ...h.doctor("expert-B"), availability: "busy", estimatedWaitMinutes: 12 },
  ]);
  let tree = await h.chooseSpecialist(await h.fill());
  const carousel = nodes(tree).find(({ type, props }) => type === "Scroll" && props.horizontal);
  assert.ok(carousel.props.scrollEnabled);
  assert.ok(carousel.props.snapToInterval > 0);
  const text = nodes(carousel).filter((node) => node.type === "Text").map(({ props }) => props.children);
  assert.equal(text.filter((value) => value === "Nội khoa").length, 1);
  assert.ok(!text.some((value) => /staff-only|internal-medicine|0 phút/.test(value)));
  assert.ok(text.includes(h.t("doctorConsultationSpecialistBusy")));
  assert.ok(text.includes(h.t("doctorConsultationDoctorRating", { rating: "4", count: 5 })));
  assert.ok(text.includes(h.t("doctorConsultationDoctorWait", { minutes: 12 })));
  h.button(tree, "expert-B").props.onPress();
  tree = await h.settle();
  assert.equal(h.button(tree, "expert-B").props.accessibilityState.checked, true);
  assert.equal(h.button(tree, h.t("doctorConsultationAutoAssign")).props.accessibilityState.checked, false);
});

await test("a configured specialty can be chosen and routed for auto-assignment even without an online expert", async () => {
  const h = harness();
  h.setOptions([
    { code: "general", name: "General", routingTenantId: "clinic-demo" },
    { code: "dermatology", name: "Dermatology", routingTenantId: "clinic-skin" },
  ]);
  h.setDoctors([]);
  let tree = await h.fill();
  h.get(tree, "Intake").props.onContinue();
  tree = await h.settle();
  assert.equal(h.get(tree, "Scroll").key, "consultation-specialty");
  assert.ok(!h.calls.some(({ url }) => url === "/api/doctor/specialists"));
  assert.ok(h.button(tree, h.t("doctorConsultationSpecialty_general")));
  h.button(tree, h.t("doctorConsultationSpecialty_dermatology")).props.onPress();
  tree = await h.settle();
  h.button(tree, h.t("doctorConsultationSeeSpecialists")).props.onPress();
  tree = await h.settle();
  assert.equal(h.get(tree, "Scroll").key, "consultation-experts");
  assert.ok(nodes(tree).some((node) =>
    node.type === "Text" && node.props.children === h.t("doctorConsultationNoSpecialists")
  ));
  assert.ok(h.button(tree, h.t("doctorConsultationAutoAssign")).props.accessibilityState.checked);
  tree = await h.review(tree);
  nodes(tree).filter((node) => node.props.accessibilityRole === "checkbox")
    .forEach((node) => node.props.onPress());
  tree = await h.settle();
  await h.button(tree, h.t("doctorConsultationSubmit")).props.onPress();
  const request = h.calls.find(({ url, input }) => url === "/api/doctor/tasks" && input?.method === "POST");
  assert.equal(request.input.body.specialty, "dermatology");
  assert.equal(request.input.body.tenant_id, "clinic-skin");
  assert.equal(request.input.body.preferred_doctor_id, null);
});

await test("re-entry resumes confirmed screening at the specialty step after revalidation", async () => {
  const h = harness();
  let tree = await h.fill();
  const original = h.get(tree, "Intake").props;
  const notice = { message: h.t("doctorScreeningRecorded"), type: "success" };
  assert.deepEqual(h.toasts, [notice]);
  const Intake = loadIntake(hooks(), 393, 1);
  const result = nodes(Intake({
    ...original,
    screening: {
      ...original.screening,
      result: { ...original.screening.result, risk_level: "medium" },
    },
  }));
  assert.equal(h.get(tree, "Scroll").key, "screening-result");
  const resultText = result.filter((node) => node.type === "Text");
  assert.deepEqual(resultText.slice(0, 2).map(({ props }) => props.children), [
    h.t("doctorScreeningRiskLabel"),
    h.t("doctorScreeningRisk_medium"),
  ]);
  assert.equal(resultText.at(-1).props.children, h.t("doctorScreeningChooseExpert"));
  assert.equal(resultText[1].props.accessibilityRole, "header");
  assert.deepEqual(
    result.filter((node) => node.type === "Choice").flatMap((node) =>
      nodes(node).filter((child) => child.type === "Text").map((child) => child.props.children)
    ),
    [h.t("doctorScreeningChooseExpert")]
  );
  assert.ok(!result.some((node) => node.type === "Text" && node.props.children === notice.message));

  // Existing drafts without explicit confirmation still show their screening result.
  h.runtime.remount();
  tree = await h.settle();
  assert.equal(h.get(tree, "Intake").props.screening.result?.status, "ready");
  tree = await h.chooseSpecialist(tree);
  tree = await h.review(tree);
  nodes(tree)
    .filter((n) => n.props.accessibilityRole === "checkbox")
    .forEach((n) => n.props.onPress());
  await h.settle();

  const revalidation = deferred();
  h.respond((url) => url === "/api/doctor/screening" ? revalidation.promise : undefined);
  h.runtime.remount();
  tree = await h.settle();
  const restored = h.get(tree, "Intake").props;
  assert.equal(restored.stage, "screening");
  assert.equal(restored.summary, original.summary);
  assert.equal(restored.screening.busy, true);
  const { input } = h.calls.filter(({ url }) => url === "/api/doctor/screening").at(-1);
  assert.equal(input.body.answers.length, 5);
  revalidation.resolve({ data: evaluateConsultationScreening(input.body) });
  tree = await h.settle();
  assert.deepEqual(h.toasts, [notice]);
  assert.equal(h.get(tree, "Intake"), undefined);
  h.button(tree, h.t("doctorConsultationSpecialty_general")).props.onPress();
  tree = await h.settle();
  h.button(tree, h.t("doctorConsultationSeeSpecialists")).props.onPress();
  tree = await h.settle();
  tree = await h.review(tree);
  assert.ok(
    nodes(tree)
      .filter((n) => n.props.accessibilityRole === "checkbox")
      .every((n) => !n.props.accessibilityState.checked)
  );
  assert.equal(h.plain.size, 0, "Health text never reaches AsyncStorage");
});

await test("a resumed screening cannot advance after a blocked result or a language change", async () => {
  const h = harness();
  let tree = await h.fill();
  h.get(tree, "Intake").props.onContinue();
  h.respond((url, input) => url === "/api/doctor/screening" ? {
    data: {
      ...evaluateConsultationScreening(input.body),
      status: "needs_in_person",
      suitable_for_remote_care: false,
    },
  } : undefined);

  h.runtime.remount();
  tree = await h.settle();
  assert.equal(h.get(tree, "Intake").props.screening.result?.status, "needs_in_person");
  assert.equal(h.button(tree, h.t("doctorConsultationSeeSpecialists")), undefined);

  h.changeLanguage("en");
  h.runtime.remount();
  tree = await h.settle();
  assert.equal(h.get(tree, "Intake").props.stage, "description");
  assert.equal(h.get(tree, "Intake").props.screening.result, null);
});

await test("Back immediately after the last keystroke still restores the latest edit", async () => {
  const h = harness();
  let tree = await h.settle();
  h.get(tree, "Intake").props.onSummaryChange(
    "Nội dung vừa nhập trước khi bấm Back."
  );
  h.runtime.remount();
  tree = await h.settle();
  assert.equal(
    h.get(tree, "Intake").props.summary,
    "Nội dung vừa nhập trước khi bấm Back."
  );
});

await test("refresh reloads specialties, online experts and tasks without losing condition or preferred expert", async () => {
  const h = harness();
  let tree = await h.fill();
  tree = await h.chooseSpecialist(tree);
  h.button(tree, "expert-A").props.onPress();
  tree = await h.settle();
  const before = h.calls.length;
  const refresh = h.get(tree, "Scroll").props.refreshControl;
  const request = refresh.props.onRefresh();
  tree = await h.settle();
  await request;
  assert.ok(
    h.calls.slice(before).some((c) => c.url === "/api/doctor/specialty-options")
  );
  assert.ok(
    h.calls.slice(before).some((c) => c.url === "/api/doctor/specialists")
  );
  assert.ok(
    h.calls.slice(before).some((c) => c.url.startsWith("/api/doctor/tasks?"))
  );
  assert.equal(
    h.button(tree, "expert-A").props.accessibilityState.selected,
    true
  );
  assert.equal(h.get(tree, "Scroll").key, "consultation-experts");
  assert.equal(
    JSON.parse([...h.secure.values()][0]).summary,
    "Ca kiểm thử: đau mỏi cổ vai sau khi làm việc."
  );
});

await test("refresh discovers newly configured specialties without leaving the screen", async () => {
  const h = harness();
  h.setOptions([]);
  let tree = await h.fill();
  tree = await h.chooseSpecialist(tree);
  assert.equal(h.button(tree, h.t("doctorConsultationSeeSpecialists")).props.disabled, true);
  h.setOptions([{ code: "general", name: "General" }]);
  await h.get(tree, "Scroll").props.refreshControl.props.onRefresh();
  tree = await h.settle();
  h.button(tree, h.t("doctorConsultationSpecialty_general")).props.onPress();
  tree = await h.settle();
  h.button(tree, h.t("doctorConsultationSeeSpecialists")).props.onPress();
  tree = await h.settle();
  assert.ok(h.button(tree, "expert-A"));
  assert.equal(h.button(tree, h.t("common:continue")).props.disabled, false);
});

for (const language of ["vi", "en"])
  await test(`${language}: failed refresh preserves inputs and cached selection, shows Retry, then recovers`, async () => {
    const h = harness(language);
    let tree = await h.fill();
    tree = await h.chooseSpecialist(tree);
    h.button(tree, "expert-A").props.onPress();
    tree = await h.settle();
    h.failGet(true);
    await h.get(tree, "Scroll").props.refreshControl.props.onRefresh();
    tree = await h.settle();
    assert.ok(
      nodes(tree).some(
        (n) =>
          n.props.accessibilityRole === "alert" &&
          n.props.children === h.t("doctorConsultationDirectoryError")
      )
    );
    assert.equal(
      h.button(tree, "expert-A").props.accessibilityState.selected,
      true
    );
    assert.equal(
      h.get(tree, "Scroll").props.refreshControl.props.refreshing,
      false
    );
    h.failGet(false);
    await h.button(tree, h.t("common:retry")).props.onPress();
    tree = await h.settle();
    assert.ok(!nodes(tree).some((n) => n.props.accessibilityRole === "alert"));
    const { answers } = JSON.parse([...h.secure.values()][0]);
    assert.deepEqual(answers.find((answer) => answer.step === "impact")?.values, ["mild"]);
  });

await test("an expert going offline is unselected without losing the condition or specialty", async () => {
  const h = harness();
  let tree = await h.fill();
  tree = await h.chooseSpecialist(tree);
  h.button(tree, "expert-A").props.onPress();
  tree = await h.settle();
  h.setDoctors([]);
  await h.get(tree, "Scroll").props.refreshControl.props.onRefresh();
  tree = await h.settle();
  assert.equal(
    h.button(tree, h.t("doctorConsultationAutoAssign")).props.accessibilityState
      .selected,
    true
  );
  assert.ok(nodes(tree).some((node) =>
    node.type === "Text" && node.props.children === h.t("doctorConsultationSpecialty_general")
  ));
});

await test("late specialist results cannot overwrite a newer choice before the specialty is confirmed", async () => {
  const h = harness();
  let tree = await h.fill();
  h.get(tree, "Intake").props.onContinue();
  tree = await h.settle();
  const held = deferred();
  h.respond((url, input) =>
    url === "/api/doctor/specialists" && input?.body.specialty === "general"
      ? held.promise
      : undefined
  );
  h.button(tree, h.t("doctorConsultationSpecialty_general")).props.onPress();
  tree = await h.settle();
  h.setDoctors([h.doctor("expert-B", "internal_medicine")]);
  h.button(tree, h.t("doctorConsultationSpecialty_internal_medicine")).props.onPress();
  tree = await h.settle();
  h.button(tree, h.t("doctorConsultationSeeSpecialists")).props.onPress();
  tree = await h.settle();
  held.resolve({
    data: { items: [h.doctor("stale-expert-A")], estimatedWaitMinutes: 30 },
  });
  tree = await h.settle();
  assert.ok(h.button(tree, "expert-B"));
  assert.equal(h.button(tree, "stale-expert-A"), undefined);
});

await test("duplicate refresh gestures share the in-flight request", async () => {
  const h = harness();
  let tree = await h.fill();
  const held = deferred();
  h.respond((url) =>
    url === "/api/doctor/specialty-options" ? held.promise : undefined
  );
  const before = h.calls.length,
    refresh = h.get(tree, "Scroll").props.refreshControl.props.onRefresh;
  const pending = refresh();
  await refresh();
  await h.settle();
  assert.equal(
    h.calls
      .slice(before)
      .filter((c) => c.url === "/api/doctor/specialty-options").length,
    1
  );
  held.resolve({ data: { items: [{ code: "general", name: "General" }] } });
  await pending;
});

await test("intake accepts five images and one PDF, then retries only the unsent attachment", async () => {
  const h = harness();
  let tree = await h.chooseSpecialist(await h.fill());
  const imageLabel = (count) => h.t("doctorConsultationAttachImages", { count, limit: 5 });
  const documentLabel = (count) => h.t("doctorConsultationAttachDocument", { count });
  const image = (number) => ({ uri: `file://photo-${number}.jpg`, fileName: `photo-${number}.jpg` });
  h.setPickedImages([image(1), image(2), image(3)]);
  h.button(tree, imageLabel(0)).props.onPress();
  tree = await h.settle();
  h.setPickedImages([image(4), image(5), image(6)]);
  h.button(tree, imageLabel(3)).props.onPress();
  tree = await h.settle();
  assert.deepEqual(h.pickerCalls.map((config) => config.selectionLimit), [5, 2]);
  assert.equal(h.button(tree, imageLabel(5)).props.disabled, true);

  h.setPickedDocuments([
    { uri: "file://record.pdf", name: "record.pdf", mimeType: "application/pdf" },
    { uri: "file://extra.pdf", name: "extra.pdf", mimeType: "application/pdf" },
  ]);
  h.button(tree, documentLabel(0)).props.onPress();
  tree = await h.settle();
  assert.equal(h.pickerCalls.at(-1).multiple, false);
  assert.equal(h.button(tree, documentLabel(1)).props.disabled, true);
  assert.equal(h.button(tree, h.t("doctorConsultationRemoveAttachment", { name: "extra.pdf" })), undefined);

  tree = await h.review(tree);
  nodes(tree).filter((node) => node.props.accessibilityRole === "checkbox")
    .forEach((node) => node.props.onPress());
  tree = await h.settle();
  let failPdf = true;
  h.respond((url, input) => {
    if (url.includes("/attachments?") && input.body.entries[0].value.type === "application/pdf" && failPdf) {
      throw new Error("temporary upload failure");
    }
  });
  h.button(tree, h.t("doctorConsultationSubmit")).props.onPress();
  tree = await h.settle();
  assert.equal(h.navigation.length, 0);
  assert.equal(h.toasts.at(-1).message, h.t("doctorConsultationAttachmentError"));
  const uploads = () => h.calls.filter(({ url }) => url.includes("/attachments?"));
  const firstBatch = uploads();
  assert.equal(firstBatch.length, 6);
  assert.equal(new Set(firstBatch.map(({ input }) => input.headers["X-Client-Message-Id"])).size, 6);
  assert.deepEqual(firstBatch.map(({ input }) => input.body.entries[0].value.name),
    ["photo-1.jpg", "photo-2.jpg", "photo-3.jpg", "photo-4.jpg", "photo-5.jpg", "record.pdf"]);

  failPdf = false;
  h.button(tree, h.t("doctorConsultationSubmit")).props.onPress();
  await h.settle();
  assert.equal(h.navigation.length, 1);
  assert.equal(uploads().length, 7);
  assert.equal(uploads().at(-1).input.headers["X-Client-Message-Id"],
    firstBatch.at(-1).input.headers["X-Client-Message-Id"]);
});

await test("failed submission keeps the draft; successful submission clears it after the existing consent gates", async () => {
  const h = harness();
  let tree = await h.fill();
  tree = await h.chooseSpecialist(tree);
  tree = await h.review(tree);
  await h.button(tree, h.t("doctorConsultationSubmit")).props.onPress();
  await h.settle();
  assert.equal(
    h.calls.filter(
      (c) => c.input?.method === "POST" && c.url === "/api/doctor/tasks"
    ).length,
    0
  );
  nodes(tree)
    .filter((n) => n.props.accessibilityRole === "checkbox")
    .forEach((n) => n.props.onPress());
  tree = await h.settle();
  h.failPost(true);
  h.button(tree, h.t("doctorConsultationSubmit")).props.onPress();
  tree = await h.settle();
  assert.ok(h.secure.size > 0);
  assert.equal(h.navigation.length, 0);
  h.failPost(false);
  h.button(tree, h.t("doctorConsultationSubmit")).props.onPress();
  await h.settle();
  const request = h.calls.find(
    (c) => c.input?.method === "POST" && c.url === "/api/doctor/tasks"
  );
  assert.deepEqual(request.input.body.clinical_intake, {
    symptom_onset: "two_to_seven_days",
    progression: "stable",
    severity: "mild",
    emergency_confirmation: true,
    screening_locale: "vi",
    screening_answers: request.input.body.clinical_intake.screening_answers,
  });
  assert.equal(request.input.body.clinical_intake.screening_answers.length, 5);
  assert.equal(h.secure.size, 0);
  assert.equal(h.navigation.length, 1);
  h.runtime.remount();
  tree = await h.settle();
  assert.equal(h.get(tree, "Intake").props.summary, "");
});

await test("a pending secure write cannot recreate a successfully submitted draft", async () => {
  const h = harness();
  let tree = await h.settle();
  const held = deferred();
  h.holdWrite(held.promise);
  h.get(tree, "Intake").props.onSummaryChange(
    "Ca kiểm thử có lượt ghi nháp đang chờ."
  );
  tree = await h.complete();
  tree = await h.chooseSpecialist(tree);
  tree = await h.review(tree);
  nodes(tree)
    .filter((n) => n.props.accessibilityRole === "checkbox")
    .forEach((n) => n.props.onPress());
  tree = await h.settle();
  h.button(tree, h.t("doctorConsultationSubmit")).props.onPress();
  await h.settle();
  assert.equal(
    h.navigation.length,
    0,
    "Success waits for queued draft deletion"
  );
  h.holdWrite(null);
  held.resolve();
  await h.settle();
  assert.equal(h.secure.size, 0);
  assert.equal(h.navigation.length, 1);
});

await test("drafts never appear in another account, including during delayed secure hydration", async () => {
  const h = harness();
  await h.fill();
  const held = deferred();
  h.holdRead(held.promise);
  h.runtime.remount();
  h.render();
  h.changeOwner("B");
  let tree = await h.settle();
  assert.equal(
    h.get(tree, "Intake"),
    undefined,
    "Nothing from A is rendered while B hydrates"
  );
  h.holdRead(null);
  held.resolve();
  tree = await h.settle();
  assert.equal(h.get(tree, "Intake").props.summary, "");
  h.changeOwner("A");
  tree = await h.settle();
  assert.equal(
    h.get(tree, "Intake").props.summary,
    "Ca kiểm thử: đau mỏi cổ vai sau khi làm việc."
  );
});

await test("expired and malformed drafts are removed rather than restored", async () => {
  const h = harness();
  await h.fill();
  const key = [...h.secure.keys()][0];
  for (const value of [
    "not json",
    JSON.stringify({
      version: 1,
      expiresAt: Date.now() - 1,
      summary: "Expired",
    }),
  ]) {
    h.secure.set(key, value);
    h.runtime.remount();
    const tree = await h.settle();
    assert.equal(h.get(tree, "Intake").props.summary, "");
    assert.equal(h.secure.size, 0);
  }
});

function loadIntake(runtime, width, fontScale, adapters = {}) {
  const catalog = JSON.parse(read("src/i18n/locales/vi/home.json"));
  return load(
    "src/features/doctor-consultation/DoctorConsultationIntake.tsx",
    {
      react: runtime,
      "react-native": {
        Pressable: "Choice",
        View: "View",
        ActivityIndicator: "Loading",
        Linking: {},
        StyleSheet: { create: (value) => value },
        useWindowDimensions: () => ({ width }),
      },
      "@expo/vector-icons": { Ionicons: "Icon" },
      "react-i18next": {
        useTranslation: () => ({ t: (key) => catalog[key] ?? key }),
      },
      "../../components/ScaledText": { ScaledText: "Text" },
      "../../components/ScaledTextInput": { ScaledTextInput: "Input" },
      "../../components/AiDataConsentModal": {},
      "../../hooks/useThemeColors": {
        useThemeColors: () => ({ colors: theme.lightColors, isDark: false }),
      },
      "../../hooks/useScaledTypography": {
        useScaledFontSize: (size) => size * fontScale,
      },
      "../../lib/tokenStore": {},
      "../../styles/theme": theme,
      "../auth/auth.store": {},
      "../guidance/VoiceAnswerButton": {},
      "../guidance/VoiceAnswerInput": {},
      ...adapters,
    }
  ).DoctorConsultationIntake;
}

function questionHarness(step, width = 393, fontScale = 1) {
  const runtime = hooks();
  let submitted;
  const full = [
    ["red_flags", "none"],
    ["associated", "none"],
    ["onset", "today"],
    ["progression", "stable"],
    ["impact", "mild"],
  ].map(([name, value]) => ({ step: name, values: [value], text: "" }));
  const index = full.findIndex((answer) => answer.step === step);
  const result = evaluateConsultationScreening({
    summary: "Tôi bị đau đầu",
    answers: full.slice(0, index),
    locale: "vi",
  });
  if (step === "red_flags") {
    result.question.options[0].label = "đau đầu dữ dội đột ngột";
  }
  const Intake = loadIntake(runtime, width, fontScale);
  const tree = Intake({
    stage: "screening",
    summary: "Tôi bị đau đầu",
    screening: {
      result,
      busy: false,
      error: false,
      answer: (value) => {
        submitted = value;
      },
      reset() {},
      back() {},
    },
    onSummaryChange() {},
    onContinue() {},
  });
  const question = nodes(tree).find(
    (node) => typeof node.type === "function" && node.props.question
  );
  const render = () => runtime.render(() => question.type(question.props));
  const choiceGroup = () => {
    const group = nodes(render()).find(
      (node) => typeof node.type === "function" && node.props.choices
    );
    return group.type(group.props);
  };
  const choices = () => nodes(choiceGroup()).filter((node) =>
    ["radio", "checkbox"].includes(node.props?.accessibilityRole)
  );
  return {
    choiceGroup,
    choices,
    submit() {
      const buttons = nodes(render()).filter(
        (node) =>
          node.type === "Choice" && node.props.accessibilityRole === "button"
      );
      assert.equal(buttons.length, 1, "The screening question only offers Continue");
      const [button] = buttons;
      assert.equal(button.props.disabled, false);
      button.props.onPress();
      return submitted;
    },
  };
}

await test("the symptom mic waits for consent, previews speech, and only adds finished text to the draft", async () => {
  const runtime = hooks();
  const typed = "Từ sáng";
  let summary = typed;
  let checked = 0;
  let mic;
  let apiToken = "session-a";
  const voiceState = { focused: true, busy: false, recording: false };
  const auth = { token: "session-a" };
  const useAuthStore = select => select(auth);
  useAuthStore.getState = () => auth;
  const dictation = load("src/features/guidance/VoiceAnswerInput.tsx", {
    react: {},
    "react-native": {},
    "../../components/ScaledTextInput": {},
    "./GuidanceProvider": {},
    "./VoiceAnswerButton": {},
  });
  const Intake = loadIntake(runtime, 320, 1.4, {
    "../../components/AiDataConsentModal": {
      AiDataConsentModal: "Consent",
      hasAiDataConsent: async () => false,
    },
    "../../lib/tokenStore": { tokenStore: { getToken: () => apiToken } },
    "../auth/auth.store": { useAuthStore },
    "../guidance/VoiceAnswerButton": {
      useVoiceAnswer: options => { mic = options; return voiceState; },
      renderVoiceAnswerButton: (_voice, options) => ({ type: "Mic", props: options }),
    },
    "../guidance/VoiceAnswerInput": dictation,
  });
  const props = {
    stage: "description",
    screening: { result: null, busy: false, error: false },
    onStartScreening: () => { checked++; },
    onSummaryChange: text => { summary = text; },
    onContinue() {},
  };
  const render = () => {
    const description = Intake({ ...props, summary });
    return nodes(runtime.render(() => description.type(description.props)));
  };
  const get = type => render().find(node => node.type === type);
  assert.equal(get("Mic").props.testID, "consultation-description-mic");
  assert.equal(get("Consent").props.visible, false);
  const denied = mic.onBeforeAi();
  await tick();
  assert.equal(get("Consent").props.visible, true);
  get("Consent").props.onDecline();
  assert.equal(await denied, false);
  const accepted = mic.onBeforeAi();
  await tick();
  get("Consent").props.onAgree();
  assert.equal(await accepted, true);

  voiceState.recording = true;
  mic.onInterimText("tôi đau");
  assert.equal(get("Input").props.value, "Từ sáng tôi đau");
  assert.equal(get("Input").props.editable, false);
  assert.equal(summary, typed);
  assert.equal(get("Choice").props.disabled, true);
  get("Choice").props.onPress();
  assert.equal(checked, 0);
  voiceState.recording = false;
  mic.onText("tôi đau đầu");
  assert.equal(summary, "Từ sáng tôi đau đầu");
  assert.equal(get("Input").props.editable, true);
  assert.equal(checked, 0);
  get("Input").props.onChangeText("Từ sáng tôi đau đầu nhẹ");
  get("Choice").props.onPress();
  assert.equal(checked, 1);

  const stale = mic.onBeforeAi();
  await tick();
  const previousConsent = get("Consent");
  apiToken = "session-b";
  assert.equal(mic.isSessionCurrent(), false);
  auth.token = "session-b";
  assert.equal(get("Consent").props.visible, false);
  previousConsent.props.onAgree();
  assert.equal(await stale, false);
  runtime.unmount();
});

for (const [width, fontScale] of [
  [393, 1],
  [360, 1],
  [393, 1.4],
]) {
  await test(`screening choices select, clear on a second tap, and switch at ${width}px / ${fontScale}x text`, () => {
    for (const step of ["onset", "progression", "impact"]) {
      const h = questionHarness(step, width, fontScale);
      const list = nodes(h.choiceGroup()).find((node) => node.props.accessibilityRole === "radiogroup");
      assert.equal(list.props.style.flexDirection, "column");
      h.choices().forEach((_choice, index) => {
        assert.equal(nodes(h.choices()[index]).filter((node) => node.type === "Icon").length, 0);
        h.choices()[index].props.onPress();
        assert.equal(h.choices()[index].props.accessibilityState.checked, true);
        assert.equal(
          h
            .choices()
            .filter((choice) => choice.props.accessibilityState.checked).length,
          1
        );
        h.choices()[index].props.onPress();
        assert.ok(
          h
            .choices()
            .every((choice) => !choice.props.accessibilityState.checked)
        );
      });
      h.choices()[0].props.onPress();
      h.choices()[1].props.onPress();
      assert.equal(h.choices()[0].props.accessibilityState.checked, false);
      assert.equal(h.choices()[1].props.accessibilityState.checked, true);
      assert.equal(h.submit().step, step);
    }
  });
}

await test("danger and associated choices are togglable, and None excludes positive symptoms", () => {
  for (const step of ["red_flags", "associated"]) {
    const h = questionHarness(step);
    const first = h.choices()[0];
    assert.equal(nodes(first).filter((node) => node.type === "Icon").length, 0);
    if (step === "red_flags") {
      const label = "Đau đầu dữ dội đột ngột";
      assert.equal(first.props.accessibilityLabel, label);
      assert.equal(nodes(first).find((node) => node.type === "Text").props.children, label);
    }
    h.choices()[0].props.onPress();
    h.choices()[1].props.onPress();
    assert.equal(
      h.choices().filter((choice) => choice.props.accessibilityState.checked)
        .length,
      2
    );
    const noneIndex = h.choices().length - (step === "red_flags" ? 2 : 1);
    h.choices()[noneIndex].props.onPress();
    assert.equal(
      h.choices().filter((choice) => choice.props.accessibilityState.checked)
        .length,
      1
    );
    assert.deepEqual(h.submit().values, ["none"]);
    h.choices()[noneIndex].props.onPress();
    assert.ok(
      h.choices().every((choice) => !choice.props.accessibilityState.checked)
    );
  }
});

for (const language of ["vi", "en"])
  await test(`${language}: blocked and uncertain screening cannot advance to specialists`, async () => {
    for (const value of ["option:0", "unsure"]) {
      const h = harness(language);
      let tree = await h.settle();
      assert.equal(
        h.calls.filter((call) => call.url === "/api/doctor/screening").length,
        0
      );
      h.get(tree, "Intake").props.onSummaryChange("Tôi bị đau đầu");
      tree = await h.settle();
      await h.get(tree, "Intake").props.onStartScreening();
      tree = await h.settle();
      assert.equal(
        h.get(tree, "Intake").props.screening.result.question.step,
        "red_flags"
      );
      await h.get(tree, "Intake").props.screening.answer({
        step: "red_flags",
        values: [value],
        text: "",
      });
      tree = await h.settle();
      assert.ok(!h.toasts.some(({ message }) => message === h.t("doctorScreeningRecorded")));
      tree = await h.chooseSpecialist(tree);
      assert.ok(h.get(tree, "Intake"));
      assert.equal(
        h.get(tree, "Intake").props.screening.result.suitable_for_remote_care,
        false
      );
      assert.equal(
        h.calls.filter(
          (call) =>
            call.url === "/api/doctor/tasks" && call.input?.method === "POST"
        ).length,
        0
      );
    }
  });

await test("screening requests and draft hydration respect the consultation flag", async () => {
  for (const enabled of [false, true])
    for (const resumeDraft of [false, true]) {
      const runtime = hooks(),
        calls = [];
      const answers = resumeDraft
        ? [{ step: "red_flags", values: ["none"], text: "" }]
        : [];
      const { useConsultationScreening } = load(
        "src/features/doctor-consultation/useConsultationScreening.ts",
        {
          react: runtime,
          "../../lib/appEnv": {
            isExpertConsultationEnabled: enabled,
            isDoctorFeaturesEnabled: !enabled,
          },
          "../../lib/apiClient": {
            apiClient: async (url, input) => {
              calls.push({ url, input });
              return { data: evaluateConsultationScreening(input.body) };
            },
          },
        }
      );
      const render = () =>
        useConsultationScreening({
          owner: "A",
          ready: true,
          summary: "Đau đầu",
          answers,
          locale: "vi",
          onAnswersChange() {},
        });
      let screening = await runtime.settle(render);
      if (!resumeDraft) {
        await screening.check();
        screening = await runtime.settle(render);
      }
      assert.equal(calls.length, enabled ? 1 : 0);
      assert.equal(
        screening.result?.status ?? null,
        enabled ? "question" : null
      );
      runtime.unmount();
    }
});

await test("a failed screening request preserves submitted answers and Retry resumes the same stage", async () => {
  const h = harness();
  let tree = await h.settle();
  h.get(tree, "Intake").props.onSummaryChange("Đau đầu");
  tree = await h.settle();
  await h.get(tree, "Intake").props.onStartScreening();
  tree = await h.settle();
  h.respond((url) =>
    url === "/api/doctor/screening"
      ? Promise.reject(new Error("Offline"))
      : undefined
  );
  await h
    .get(tree, "Intake")
    .props.screening.answer({ step: "red_flags", values: ["none"], text: "" });
  tree = await h.settle();
  assert.equal(JSON.parse([...h.secure.values()][0]).answers.length, 1);
  assert.equal(h.get(tree, "Intake").props.screening.error, true);
  h.respond(undefined);
  await h.get(tree, "Intake").props.screening.check();
  tree = await h.settle();
  assert.equal(
    h.get(tree, "Intake").props.screening.result.question.step,
    "associated"
  );
});

await test("late screening responses cannot approve a fresh draft or leak across accounts", async () => {
  const h = harness();
  let tree = await h.fill();
  const held = deferred();
  h.respond((url, input) =>
    url === "/api/doctor/screening" ? held.promise : undefined
  );
  const pending = h.get(tree, "Intake").props.screening.check();
  tree = await h.cancelDraft(tree);
  h.get(tree, "Intake").props.onSummaryChange("Vấn đề mới chưa kiểm tra");
  tree = await h.settle();
  held.resolve({
    data: {
      status: "ready",
      isDone: true,
      suitable_for_remote_care: true,
      intake: {},
      recorded_answers: [],
    },
  });
  await pending;
  tree = await h.settle();
  assert.equal(h.get(tree, "Intake").props.screening.result, null);
  h.changeOwner("B");
  tree = await h.settle();
  assert.equal(h.get(tree, "Intake").props.screening.result, null);
  assert.equal(h.get(tree, "Intake").props.summary, "");
});

await test("changing language restarts screening rather than reinterpreting old option values", async () => {
  const h = harness();
  const completed = await h.fill();
  const specialist = await h.chooseSpecialist(completed);
  assert.ok(h.button(specialist, "expert-A"));
  h.changeLanguage("en");
  const tree = await h.settle();
  assert.equal(h.get(tree, "Intake").props.stage, "screening");
  assert.equal(h.get(tree, "Intake").props.screening.result, null);
});

await test("rapid repeated answer taps create one request and one recorded answer", async () => {
  const h = harness();
  let tree = await h.settle();
  h.get(tree, "Intake").props.onSummaryChange("Đau đầu");
  tree = await h.settle();
  await h.get(tree, "Intake").props.onStartScreening();
  tree = await h.settle();
  const held = deferred();
  h.respond((url) =>
    url === "/api/doctor/screening" ? held.promise : undefined
  );
  const before = h.calls.filter(
    (call) => call.url === "/api/doctor/screening"
  ).length;
  const screening = h.get(tree, "Intake").props.screening;
  const answer = { step: "red_flags", values: ["none"], text: "" };
  const first = screening.answer(answer);
  await screening.answer(answer);
  held.resolve({ data: evaluateConsultationScreening({ answers: [answer] }) });
  await first;
  tree = await h.settle();
  assert.equal(
    h.calls.filter((call) => call.url === "/api/doctor/screening").length,
    before + 1
  );
  assert.equal(JSON.parse([...h.secure.values()][0]).answers.length, 1);
  assert.equal(
    h.get(tree, "Intake").props.screening.result.question.step,
    "associated"
  );
});

await test("legacy condition drafts keep the description and require fresh screening", async () => {
  const h = harness();
  await h.fill();
  const key = [...h.secure.keys()][0];
  h.secure.set(
    key,
    JSON.stringify({
      version: 1,
      expiresAt: Date.now() + 60000,
      summary: "Mô tả từ bản app cũ",
      symptomOnset: "today",
      progression: "stable",
      severity: "mild",
    })
  );
  h.runtime.remount();
  const tree = await h.settle();
  assert.equal(h.get(tree, "Intake").props.summary, "Mô tả từ bản app cũ");
  assert.equal(h.get(tree, "Intake").props.screening.result, null);
});

await test("a malformed screening response cannot unlock the specialist step", async () => {
  const h = harness();
  let tree = await h.settle();
  h.get(tree, "Intake").props.onSummaryChange("Đau đầu");
  tree = await h.settle();
  h.respond((url) =>
    url === "/api/doctor/screening"
      ? {
          data: {
            status: "ready",
            isDone: true,
            suitable_for_remote_care: true,
            intake: {},
            recorded_answers: [],
          },
        }
      : undefined
  );
  await h.get(tree, "Intake").props.onStartScreening();
  tree = await h.settle();
  assert.equal(h.get(tree, "Intake").props.screening.error, true);
  tree = await h.chooseSpecialist(tree);
  assert.ok(h.get(tree, "Intake"));
});

console.log(`Doctor consultation: ${checks} runtime regressions passed.`);

await test("linked reconsultation keeps the unsent original draft and requires new screening and consent", async () => {
  const h = harness();
  await h.fill();
  h.runtime.remount();
  h.setParams({ previousTaskId: "demo-previous", tenantId: "clinic-demo" });
  let tree = await h.settle();
  assert.equal(h.get(tree, "Intake").props.summary, "");
  tree = await h.fill();
  tree = await h.chooseSpecialist(tree);
  tree = await h.review(tree);
  await h.button(tree, h.t("doctorConsultationSubmit")).props.onPress();
  await h.settle();
  assert.equal(h.calls.filter((c) => c.url === "/api/doctor/tasks").length, 0);
  nodes(tree)
    .filter((n) => n.props.accessibilityRole === "checkbox")
    .forEach((n) => n.props.onPress());
  tree = await h.settle();
  await h.button(tree, h.t("doctorConsultationSubmit")).props.onPress();
  await h.settle();
  const request = h.calls.find((c) => c.url === "/api/doctor/tasks");
  assert.equal(request.input.body.previous_task_id, "demo-previous");
  assert.equal(request.input.body.tenant_id, "clinic-demo");
  assert.equal(request.input.body.clinical_intake.screening_answers.length, 5);
  h.runtime.remount();
  h.setParams({});
  tree = await h.settle();
  assert.ok(h.get(tree, "Intake").props.summary.includes("Ca kiểm thử"));
});

await test("a closed request id is cleared before the patient explicitly submits a new consultation", async () => {
  const h = harness();
  let tree = await h.fill();
  tree = await h.chooseSpecialist(tree);
  tree = await h.review(tree);
  nodes(tree)
    .filter((n) => n.props.accessibilityRole === "checkbox")
    .forEach((n) => n.props.onPress());
  tree = await h.settle();
  h.respond((url, input) =>
    url === "/api/doctor/tasks" && input?.method === "POST"
      ? Promise.reject(
          Object.assign(new Error("Closed request"), {
            code: "DOCTOR_TASK_CLOSED",
          })
        )
      : undefined
  );
  h.button(tree, h.t("doctorConsultationSubmit")).props.onPress();
  tree = await h.settle();
  const first = h.calls.find((c) => c.url === "/api/doctor/tasks").input.body
    .task_id;
  assert.equal(h.plain.size, 0);
  assert.ok(h.get(tree, "Intake") === undefined);
  h.respond(undefined);
  h.button(tree, h.t("doctorConsultationSubmit")).props.onPress();
  await h.settle();
  const requests = h.calls.filter((c) => c.url === "/api/doctor/tasks");
  assert.equal(requests.length, 2);
  assert.notEqual(requests[1].input.body.task_id, first);
});
