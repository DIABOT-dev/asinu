const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const test = require("node:test");
function evaluate(file, imports = {}, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const module = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  new Function("module", "exports", "require", ...Object.keys(globals), output)(
    module,
    module.exports,
    (name) => {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      assert.ok(name in imports, `Missing chat UI adapter: ${name}`);
      return imports[name];
    },
    ...Object.values(globals)
  );
  return module.exports;
}
const nodes = (tree) =>
  Array.isArray(tree)
    ? tree.flatMap(nodes)
    : tree && typeof tree === "object"
    ? [tree, ...nodes(tree.props?.children)]
    : [];
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function hooks() {
  let cursor = 0;
  const slots = [],
    effects = [];
  const changed = (old, deps) =>
    !old || deps.some((value, index) => !Object.is(value, old[index]));
  const react = {
    useRef: (value) => (slots[cursor++] ??= { current: value }),
    useState(initial) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        slots[i],
        (next) => {
          slots[i] = typeof next === "function" ? next(slots[i]) : next;
        },
      ];
    },
    useMemo(factory, deps) {
      const i = cursor++;
      if (changed(slots[i]?.deps, deps)) slots[i] = { deps, value: factory() };
      return slots[i].value;
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (changed(slots[i]?.deps, deps)) {
        const old = slots[i];
        slots[i] = { deps };
        effects.push(() => {
          old?.cleanup?.();
          slots[i].cleanup = effect();
        });
      }
    },
  };
  return {
    react,
    render: (fn) => {
      cursor = 0;
      const value = fn();
      effects.splice(0).forEach((fn) => fn());
      return value;
    },
    unmount: () => slots.forEach((value) => value?.cleanup?.()),
  };
}
const theme = evaluate("src/styles/theme.ts");
const format = evaluate(
  "src/features/app-assistant/assistant-message-format.ts"
);
function translator(lang, namespace) {
  const values = JSON.parse(
    fs.readFileSync(`src/i18n/locales/${lang}/${namespace}.json`)
  );
  return (key, parameters = {}) => {
    const value = key.split(".").reduce((object, key) => object?.[key], values);
    assert.equal(typeof value, "string", key);
    return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(parameters[name] ?? ""));
  };
}
function messageHarness({
  language = "vi",
  isDark = false,
  role = "assistant",
  body = "Đã ghi 200 ml nước.",
  copy = async () => true,
} = {}) {
  const state = hooks(),
    copied = [],
    ratings = [],
    toasts = [],
    timers = new Map();
  let nextTimer = 0;
  const t = translator(language, "settings");
  const { AssistantChatMessage } = evaluate(
    "src/features/app-assistant/AssistantChatMessage.tsx",
    {
      react: state.react,
      "react-native": {
        View: "View",
        Pressable: "Pressable",
        Image: "Image",
        StyleSheet: { create: (value) => value },
      },
      "@expo/vector-icons": { Ionicons: "Icon" },
      "expo-clipboard": {
        setStringAsync: async (text) => {
          copied.push(text);
          return copy(text);
        },
      },
      "react-i18next": { useTranslation: () => ({ t }) },
      "../../components/ScaledText": { ScaledText: "Text" },
      "../../hooks/useThemeColors": {
        useThemeColors: () => ({
          colors: isDark ? theme.darkColors : theme.lightColors,
          isDark,
        }),
      },
      "../../stores/toast.store": { showToast: (...args) => toasts.push(args) },
      "./AssistantMessageContent": { AssistantMessageContent: "RichMessage" },
      "./assistant-message-format": format,
      "../../../assets/asinu_assistant_listening_v1.png": "mascot",
    },
    {
      setTimeout: (fn) => {
        const id = ++nextTimer;
        timers.set(id, fn);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    }
  );
  let props = {
    message: { id: "m1", role, text: body },
    onRate: (value) => ratings.push(value),
  };
  const render = () => state.render(() => AssistantChatMessage(props));
  return {
    render,
    copied,
    ratings,
    toasts,
    t,
    button: (key) =>
      nodes(render()).find((node) => node.props.accessibilityLabel === t(key)),
    props: (patch) => {
      props = { ...props, ...patch };
    },
    unmount: state.unmount,
  };
}
for (const language of ["vi", "en"])
  for (const isDark of [false, true])
    test(`${language}/${
      isDark ? "dark" : "light"
    }: responses stay readable and copy/rating actions are accessible`, async () => {
      const h = messageHarness({ language, isDark });
      const tree = h.render();
      assert.ok(nodes(tree).some((node) => node.type === "RichMessage"));
      const actions = nodes(tree).filter((node) => node.type === "Pressable");
      assert.equal(actions.length, 3);
      assert.ok(
        actions.every(
          (node) =>
            node.props.accessibilityRole === "button" &&
            node.props.style.width >= 44
        )
      );
      h.button("appAssistant.likeMessage").props.onPress();
      assert.deepEqual(h.ratings, ["like"]);
      h.props({ rating: "like", ratingBusy: true });
      assert.equal(
        h.button("appAssistant.likeMessage").props.accessibilityState.selected,
        true
      );
      assert.equal(
        h.button("appAssistant.dislikeMessage").props.disabled,
        true
      );
      h.button("appAssistant.copyMessage").props.onPress();
      await flush();
      assert.deepEqual(h.copied, ["Đã ghi 200 ml nước."]);
      assert.ok(h.button("appAssistant.copied"));
      assert.deepEqual(h.toasts, [[h.t("appAssistant.copied")]]);
      h.unmount();
    });
test("only a long response can be collapsed, and copying always preserves the complete original response", async () => {
  const body =
      "## Thông tin đã lưu\nChiều cao: **176 cm**\n\n" +
      "Một đoạn thông tin đầy đủ. ".repeat(40),
    h = messageHarness({ body });
  assert.equal(
    nodes(h.render()).find((node) => node.type === "RichMessage").props.text,
    body
  );
  h.button("appAssistant.collapseMessage").props.onPress();
  assert.equal(
    nodes(h.render()).find((node) => node.props.numberOfLines).props
      .numberOfLines,
    4
  );
  h.button("appAssistant.copyMessage").props.onPress();
  await flush();
  assert.deepEqual(h.copied, [body]);
  h.button("appAssistant.expandMessage").props.onPress();
  assert.ok(nodes(h.render()).some((node) => node.type === "RichMessage"));
  h.unmount();
});
test("user messages have no assistant avatar or rating controls", () => {
  const h = messageHarness({ role: "user" });
  assert.equal(
    nodes(h.render()).filter((node) => node.type === "Pressable").length,
    0
  );
  assert.ok(
    nodes(h.render()).some(
      (node) => node.props.testID === "assistant-user-message"
    )
  );
  h.unmount();
});
for (const copy of [async () => false, async () => { throw Error("clipboard unavailable"); }])
  test("clipboard failure is visible and cannot display a false copied state", async () => {
    const h = messageHarness({ copy });
    h.button("appAssistant.copyMessage").props.onPress();
    await flush();
    assert.ok(!h.button("appAssistant.copied"));
    assert.deepEqual(h.toasts, []);
    assert.ok(
      nodes(h.render()).some((node) => node.props.accessibilityRole === "alert")
    );
    h.unmount();
  });
test("Vietnamese numeric keyboards use Xong and English uses Done without overriding explicit labels", () => {
  for (const language of ["vi", "en"]) {
    const { ScaledTextInput } = evaluate("src/components/ScaledTextInput.tsx", {
      react: { forwardRef: (fn) => fn },
      "react-native": {
        TextInput: "NativeInput",
        StyleSheet: { flatten: (style) => style },
      },
      "../hooks/useScaledTypography": { useScaledFontSize: (value) => value },
      "react-i18next": {
        useTranslation: () => ({ t: translator(language, "common") }),
      },
    });
    const input = ScaledTextInput(
      {
        style: { fontSize: 16 },
        keyboardType: "decimal-pad",
        returnKeyType: "done",
      },
      null
    );
    assert.equal(
      input.props.inputAccessoryViewButtonLabel,
      language === "vi" ? "Xong" : "Done"
    );
    assert.equal(
      input.props.returnKeyLabel,
      language === "vi" ? "Xong" : "Done"
    );
    assert.equal(
      ScaledTextInput({ inputAccessoryViewButtonLabel: "Custom" }, null).props
        .inputAccessoryViewButtonLabel,
      "Custom"
    );
  }
});
test("measurement labels remove trailing zeroes while preserving real fractions", () => {
  const { formatMeasurementValue } = evaluate(
    "src/features/profile/measurement-ruler.ts"
  );
  for (const [value, want] of [
    ["176.00", "176"],
    ["75.00", "75"],
    [75, "75"],
    ["75.50", "75.5"],
    [75.25, "75.25"],
  ])
    assert.equal(formatMeasurementValue(value), want);
});
function feedbackHarness({ initial = {}, post, read, language = "vi" } = {}) {
  const state = hooks();
  let auth = { profile: { id: "A" }, token: "token-A" },
    server = { ...initial },
    reads = 0;
  const posts = [], toasts = [];
  const t = translator(language, "settings");
  const store = (select) => select(auth);
  store.getState = () => auth;
  const { useAssistantMessageFeedback } = evaluate(
    "src/features/app-assistant/useAssistantMessageFeedback.ts",
    {
      react: state.react,
      "react-i18next": { useTranslation: () => ({ t }) },
      "../../stores/toast.store": { showToast: (...args) => toasts.push(args) },
      "../auth/auth.store": { useAuthStore: store },
      "../chat/chat.api": {
        chatApi: {
          fetchFeedbacks: async () => {
            reads++;
            return read ? read(reads) : { ...server };
          },
          sendFeedback: async (...args) => {
            posts.push(args);
            if (post) return post(...args);
            const [id, , type] = args;
            server[id] = type;
            return { ok: true, action: "saved" };
          },
        },
      },
    }
  );
  return {
    render: () => state.render(useAssistantMessageFeedback),
    posts,
    toasts,
    t,
    unmount: state.unmount,
    switchAccount: () => {
      auth = { profile: { id: "B" }, token: "token-B" };
    },
    get reads() {
      return reads;
    },
  };
}
const message = { id: "m1", role: "assistant", text: "Chiều cao: 176 cm" };
for (const language of ["vi", "en"])
  test(`${language}: feedback restores the saved choice, skips repeat taps and confirms a successful change`, async () => {
    const h = feedbackHarness({
      initial: { "legacy-message": "dislike", "asinu-assistant:m1": "like" },
      language,
    });
    h.render();
    await flush();
    assert.deepEqual(h.render().ratings, { m1: "like" });
    await h.render().rate(message, "like");
    assert.deepEqual(h.posts, []);
    assert.deepEqual(h.toasts, []);
    const save = h.render().rate(message, "dislike");
    assert.equal(h.render().ratings.m1, "like");
    assert.deepEqual(h.toasts, []);
    await save;
    assert.equal(h.render().ratings.m1, "dislike");
    assert.deepEqual(h.posts, [["asinu-assistant:m1", message.text, "dislike"]]);
    assert.deepEqual(h.toasts, [[h.t("appAssistant.feedbackThanks"), "success", 3500]]);
    await h.render().rate({ ...message, role: "user" }, "like");
    assert.equal(h.posts.length, 1);
    h.unmount();
  });
test("duplicate taps submit once and late results cannot update or thank another account", async () => {
  let resolve;
  const h = feedbackHarness({
    post: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  h.render();
  await flush();
  const stale = h.render().rate;
  const pending = stale(message, "like");
  await stale(message, "like");
  assert.equal(h.posts.length, 1);
  h.switchAccount();
  h.render();
  resolve({ ok: true, action: "saved" });
  await pending;
  await flush();
  assert.deepEqual(h.render().ratings, {});
  assert.deepEqual(h.toasts, []);
  await stale(message, "like");
  assert.equal(h.posts.length, 1);
  h.unmount();
});
test("a failed feedback request keeps the last confirmed choice and allows an explicit retry", async () => {
  let attempts = 0;
  const h = feedbackHarness({
    initial: { "asinu-assistant:m1": "like" },
    post: async () => {
      if (++attempts === 1) throw Error("connection lost");
      return { ok: true, action: "saved" };
    },
  });
  h.render();
  await flush();
  await h.render().rate(message, "dislike");
  assert.equal(h.posts.length, 1);
  assert.equal(h.reads, 1);
  assert.equal(h.render().ratings.m1, "like");
  assert.deepEqual(h.toasts, []);
  assert.equal(h.render().errors.m1, true);
  assert.equal(h.render().pending.m1, false);
  await h.render().rate(message, "dislike");
  assert.equal(h.posts.length, 2);
  assert.equal(h.render().ratings.m1, "dislike");
  assert.equal(h.toasts.length, 1);
  h.unmount();
});

function earlyHarness({
  assessment = null,
  healthScore = null,
  failRead = false,
  evaluate,
} = {}) {
  const state = hooks(),
    t = translator("vi", "tree");
  let reads = 0,
    evaluations = 0;
  state.react.useCallback = (fn, deps) => state.react.useMemo(() => fn, deps);
  const alert = { alertState: {}, showAlert() {}, dismissAlert() {} };
  const { EarlySignalCard } = evaluateModule();
  function evaluateModule() {
    return moduleEvaluate("src/components/EarlySignalCard.tsx", {
      react: state.react,
      "react-native": {
        ...Object.fromEntries(
          ["ActivityIndicator", "Modal", "Pressable", "ScrollView", "View"].map(
            (x) => [x, x]
          )
        ),
        StyleSheet: { create: (value) => value },
      },
      "@expo/vector-icons": {
        Ionicons: "Icon",
        MaterialCommunityIcons: "Icon",
      },
      "react-i18next": { useTranslation: () => ({ t }) },
      "./ScaledText": { ScaledText: "Text" },
      "./AppAlertModal": { AppAlertModal: "Alert", useAppAlert: () => alert },
      "../features/early-signal/EarlySignalDetails": {
        EarlySignalDetails: "EarlyDetails",
      },
      "../features/early-signal/early-signal.api": {
        earlySignalApi: {
          latest: async () => {
            reads++;
            if (failRead) throw Error("offline");
            return assessment;
          },
          evaluate: async () => {
            evaluations++;
            return evaluate ? evaluate() : assessment;
          },
        },
      },
      "../lib/realtimeSync": { subscribeRealtimeRefresh: () => () => {} },
      "../styles": {
        colors: theme.lightColors,
        radius: { full: 999, xl: 24, lg: 16 },
        spacing: { sm: 8, md: 12, lg: 16, xl: 24 },
        typography: { size: { xs: 12, sm: 14, md: 16, lg: 18 } },
      },
    });
  }
  const { EarlySignalDetails } = moduleEvaluate(
    "src/features/early-signal/EarlySignalDetails.tsx",
    {
      "react-native": {
        ActivityIndicator: "ActivityIndicator",
        Pressable: "Pressable",
        View: "View",
        StyleSheet: { create: (value) => value, hairlineWidth: 1 / 3 },
      },
      "@expo/vector-icons": { Ionicons: "Icon" },
      "react-i18next": {
        useTranslation: () => ({ t, i18n: { language: "vi" } }),
      },
      "../../components/ScaledText": { ScaledText: "Text" },
      "../../hooks/useThemeColors": {
        useThemeColors: () => ({ colors: theme.lightColors, isDark: false }),
      },
    }
  );
  const expand = (tree) =>
    Array.isArray(tree)
      ? tree.map(expand)
      : tree && typeof tree === "object"
      ? tree.type === "EarlyDetails"
        ? EarlySignalDetails(tree.props)
        : {
            ...tree,
            props: { ...tree.props, children: expand(tree.props?.children) },
          }
      : tree;
  const render = () =>
    expand(
      state.render(() =>
        EarlySignalCard({
          details: true,
          healthScore,
        })
      )
    );

  return {
    render,
    unmount: state.unmount,
    get reads() {
      return reads;
    },
    get evaluations() {
      return evaluations;
    },
  };
}
// Keep the evaluate option distinct from the source-module evaluator.
const moduleEvaluate = evaluate;
test("early signals show the actual assessment in their own presentation and never auto-run an assessment", async () => {
  const assessment = {
    id: 7,
    severity: "monitor",
    summary: "Dữ liệu đã ghi nhận",
    signals: ["Đã ghi huyết áp"],
    urgent_signs: [],
    disclaimer: "Thông tin tham khảo",
    is_red_flag: false,
  };
  const h = earlyHarness({ assessment });
  h.render();
  await flush();
  const tree = h.render();
  const visible = JSON.stringify(tree);
  assert.ok(visible.includes(assessment.summary));
  assert.ok(visible.includes(assessment.signals[0]));
  assert.ok(
    nodes(tree).some((node) => node.props.testID === "early-signal-level")
  );
  assert.ok(
    nodes(tree).some(
      (node) => node.props.testID === "early-signal-recorded-signs"
    )
  );
  assert.ok(!nodes(tree).some((node) => node.type === "ChatMessage"));
  assert.equal(h.evaluations, 0);
  h.unmount();
});
test("urgent early signals retain every warning without a call action or collapsed content", async () => {
  const h = earlyHarness({
    assessment: {
      id: 8,
      severity: "urgent",
      is_red_flag: true,
      summary: "Kết quả hiện tại",
      signals: ["Dấu hiệu A"],
      urgent_signs: ["Dấu hiệu B"],
      disclaimer: "Hướng dẫn trong kết quả",
      family_notified_at: null,
    },
  });
  h.render();
  await flush();
  const tree = h.render(),
    visible = JSON.stringify(tree);
  assert.ok(visible.includes("Dấu hiệu A"));
  assert.ok(visible.includes("Dấu hiệu B"));
  assert.ok(visible.includes("Chưa có người thân đủ quyền nhận cảnh báo"));
  assert.ok(
    !nodes(tree).some(
      (node) => node.props.numberOfLines || node.type === "ChatMessage"
    )
  );
  assert.ok(!nodes(tree).some((node) => node.props.testID === "early-signal-emergency"));
  assert.ok(!visible.includes("115"));
  assert.ok(visible.includes(translator("vi", "tree")("earlyRedFlagTitle")));
  h.unmount();
});
test("an empty early-signal view evaluates only after a deliberate press and blocks duplicate submissions", async () => {
  let resolve;
  const h = earlyHarness({
    evaluate: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  h.render();
  await flush();
  assert.equal(h.evaluations, 0);
  const button = nodes(h.render()).find(
    (node) => node.props.testID === "early-signal-evaluate"
  );
  const p = button.props.onPress();
  await button.props.onPress();
  assert.equal(h.evaluations, 1);
  resolve(null);
  await p;
  h.unmount();
});
test("a failed early-signal read retries the read instead of generating an assessment", async () => {
  const h = earlyHarness({ failRead: true });
  h.render();
  await flush();
  const button = nodes(h.render()).find((node) => node.type === "Pressable");
  button.props.onPress();
  await flush();
  assert.equal(h.reads, 2);
  assert.equal(h.evaluations, 0);
  h.unmount();
});
test("Home hides Asinu by default, keeps both connections, and supports re-enabling its card", () => {
  const routes = [];
  const featureFlags = evaluate("src/lib/appEnv.ts", {}, { process: { env: {} } });
  const { HomeConnections } = evaluate("src/components/HomeConnections.tsx", {
    "react-native": {
      Image: "Image",
      Pressable: "Pressable",
      View: "View",
      StyleSheet: { create: (value) => value },
    },
    "react-i18next": {
      useTranslation: () => ({ t: translator("vi", "home") }),
    },
    "./ScaledText": { ScaledText: "Text" },
    "../features/app-assistant/AsinuAssistantButton": {
      AsinuAssistantButton: "AssistantEntry",
    },
    "../hooks/useThemeColors": {
      useThemeColors: () => ({ colors: theme.lightColors }),
    },
    "../hooks/useGuardedRouter": {
      useGuardedRouter: () => ({ push: (route) => routes.push(route) }),
    },
    "../lib/appEnv": featureFlags,
    "../../assets/images/care-circle/family_3d_art.png": "family",
    "../../assets/images/care-circle/expert-consultation-cutout.png": "expert",
  });
  const tree = HomeConnections();
  assert.ok(!nodes(tree).some((node) => node.type === "AssistantEntry"));
  const images = nodes(tree).filter((node) => node.type === "Image");
  assert.deepEqual(images.map((node) => node.props.source), ["family", "expert"]);
  assert.deepEqual(images[0].props.style, images[1].props.style);
  assert.ok(images.every((node) => node.props.resizeMode === "contain"));
  for (const button of nodes(tree).filter(
    (node) => node.type === "Pressable"
  )) {
    assert.equal(
      button.props.style({ pressed: false })[0].paddingHorizontal,
      4
    );
    button.props.onPress();
  }
  assert.deepEqual(routes, ["/care-circle", "/doctor-consultation"]);
  Object.assign(
    featureFlags,
    evaluate("src/lib/appEnv.ts", {}, {
      process: { env: { EXPO_PUBLIC_ASINU_ASSISTANT_ENABLED: "true" } },
    })
  );
  assert.equal(
    nodes(HomeConnections()).find((node) => node.type === "AssistantEntry")?.props.variant,
    "card"
  );
});

test("Early signals open as a bottom modal with their own content and no assistant composer", () => {
  const state = hooks();
  const store = (select) => select({ token: "fixture-token" });
  store.getState = () => ({ token: "fixture-token" });
  const { EarlySignalDialog } = evaluate(
    "src/features/early-signal/EarlySignalDialog.tsx",
    {
      react: state.react,
      "react-native": {
        Linking: { openURL: async () => {} },
        Pressable: "Pressable",
        ScrollView: "ScrollView",
        View: "View",
        StyleSheet: { create: (value) => value, absoluteFill: {} },
      },
      "@expo/vector-icons": {
        Ionicons: "Icon",
        MaterialCommunityIcons: "Icon",
      },
      "expo-router": { useIsFocused: () => true },
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => ({ top: 59, bottom: 34 }),
      },
      "react-i18next": {
        useTranslation: (ns) => ({ t: translator("vi", ns) }),
      },
      "../../components/ScaledText": { ScaledText: "Text" },
      "../../components/QueuedModal": { QueuedModal: "QueuedModal" },
      "../../components/EarlySignalCard": {
        EarlySignalCard: "EarlySignalCard",
      },
      "../../hooks/useThemeColors": {
        useThemeColors: () => ({ colors: theme.lightColors }),
      },
      "../auth/auth.store": { useAuthStore: store },
    }
  );
  const tree = state.render(() => EarlySignalDialog({ onClose() {} }));
  assert.equal(tree.props.transparent, true);
  assert.equal(tree.props.visible, true);
  assert.equal(tree.props.children.props.style[0].justifyContent, "flex-end");
  assert.equal(
    nodes(tree).find((node) => node.props.testID === "early-signal-dialog")
      .props.style[0].maxHeight,
    "85%"
  );
  assert.ok(nodes(tree).some((node) => node.type === "EarlySignalCard"));
  assert.ok(
    !nodes(tree).some((node) => node.props.testID === "asinu-assistant-text")
  );
  state.unmount();
});

test("early-signal loading and empty states never show an invented reassuring level", async () => {
  const h = earlyHarness();
  assert.ok(
    nodes(h.render()).some(
      (node) => node.props.testID === "early-signal-loading"
    )
  );
  await flush();
  const tree = h.render();
  assert.ok(
    nodes(tree).some((node) => node.props.testID === "early-signal-empty")
  );
  assert.ok(
    !nodes(tree).some((node) => node.props.testID === "early-signal-level")
  );
  h.unmount();
});
test("early-signal follow-up, timestamp, and family notification remain separate readable sections", async () => {
  const h = earlyHarness({
    assessment: {
      id: 10,
      severity: "see_doctor",
      summary: "Kết quả đã ghi nhận",
      signals: ["Tín hiệu trong kết quả"],
      urgent_signs: [],
      suggested_specialty: "Chuyên khoa đã đề xuất",
      created_at: "2026-11-17T07:30:00.000Z",
      is_red_flag: true,
      family_notified_at: "2026-11-17T07:31:00.000Z",
    },
  });
  h.render();
  await flush();
  const tree = h.render();
  for (const id of [
    "early-signal-urgent-signs",
    "early-signal-next-step",
    "early-signal-family-status",
  ].filter((id) => id !== "early-signal-urgent-signs"))
    assert.ok(nodes(tree).some((node) => node.props.testID === id));
  assert.ok(JSON.stringify(tree).includes("Chuyên khoa đã đề xuất"));
  assert.ok(JSON.stringify(tree).includes("17/11/2026"));
  assert.ok(!JSON.stringify(tree).includes("Invalid Date"));
  h.unmount();
});

test('assistant typing respects motion preferences, pauses in background and releases subscriptions', async () => {
  const state = hooks(), motionListeners = new Set(), appListeners = new Set();
  let resolvePreference;
  const { AssistantThinkingIndicator } = evaluate('src/features/app-assistant/AssistantThinkingIndicator.tsx', {
    react: state.react,
    'react-native': {
      View: 'View', Image: 'Image', StyleSheet: { create: value => value },
      AccessibilityInfo: {
        isReduceMotionEnabled: () => new Promise(resolve => { resolvePreference = resolve; }),
        addEventListener: (_name, listener) => { motionListeners.add(listener); return { remove: () => motionListeners.delete(listener) }; },
      },
      AppState: { currentState: 'active', addEventListener: (_name, listener) => { appListeners.add(listener); return { remove: () => appListeners.delete(listener) }; } },
    },
    'react-native-reanimated': {},
    '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: theme.lightColors, isDark: false }) },
    '../../../assets/asinu_assistant_listening_v1.png': 'existing-asinu-avatar',
  });
  const render = () => state.render(() => AssistantThinkingIndicator({ label: 'Asinu đang suy nghĩ…' }));
  const dots = tree => nodes(tree).filter(node => typeof node.type === 'function');
  let tree = render();
  assert.equal(tree.props.accessibilityLabel, 'Asinu đang suy nghĩ…');
  assert.equal(tree.props.accessibilityState.busy, true);
  assert.equal(tree.props.accessibilityLiveRegion, 'polite');
  assert.equal(dots(tree).length, 3);
  assert.ok(dots(tree).every(dot => dot.props.animate === false));
  motionListeners.forEach(listener => listener(false));
  resolvePreference(true); await flush();
  assert.ok(dots(render()).every(dot => dot.props.animate === true), 'A newer preference event wins over an older pending read');
  appListeners.forEach(listener => listener('background'));
  assert.ok(dots(render()).every(dot => dot.props.animate === false));
  appListeners.forEach(listener => listener('active'));
  assert.ok(dots(render()).every(dot => dot.props.animate === true));
  motionListeners.forEach(listener => listener(true));
  assert.ok(dots(render()).every(dot => dot.props.animate === false));
  state.unmount();
  assert.equal(motionListeners.size, 0); assert.equal(appListeners.size, 0);
});

test('an urgent assessment without a red flag retains its clinic recommendation instead of becoming an emergency call',async()=>{
 const h=earlyHarness({assessment:{id:12,severity:'urgent',is_red_flag:false,summary:'Kết quả gốc',signals:['Dấu hiệu trong kết quả'],urgent_signs:[],disclaimer:'Thông tin gốc'}});
 h.render();await flush();const tree=h.render();assert.ok(JSON.stringify(tree).includes('Cần đi khám ngay'));assert.ok(!nodes(tree).some(node=>node.props.testID==='early-signal-emergency'));h.unmount();
});
