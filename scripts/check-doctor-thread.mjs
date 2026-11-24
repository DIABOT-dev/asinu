import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (file) => fs.readFileSync(file, "utf8");
const jsx = (type, props) => ({ type, props });
function evaluate(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(read(file), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  new Function("module", "exports", "require", ...Object.keys(globals), output)(
    module,
    module.exports,
    (id) => {
      if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
      assert.ok(id in imports, `Unexpected thread dependency ${id}`);
      return imports[id];
    },
    ...Object.values(globals)
  );
  return module.exports;
}
const theme = evaluate("src/styles/theme.ts");
const nodes = (tree) =>
  !tree || typeof tree !== "object"
    ? []
    : Array.isArray(tree)
    ? tree.flatMap(nodes)
    : [tree, ...nodes(tree.props?.children)];
const tick = async () => {
  for (let i = 0; i < 45; i++) await Promise.resolve();
};
function hooks() {
  let cursor = 0,
    effects = [];
  const slots = [];
  return {
    Fragment: "Fragment",
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
      const tree = run(),
        pending = effects;
      effects = [];
      pending.forEach((work) => work());
      return tree;
    },
    unmount() {
      slots.forEach((slot) => slot?.cleanup?.());
    },
  };
}
function harness(language = "vi", initialStatus = null) {
  const runtime = hooks(),
    calls = [],
    navigation = [],
    openedUrls = [],
    scrolls = [],
    toasts = [],
    sockets = [],
    appStateListeners = new Set(),
    intervals = new Map(),
    timers = new Map();
  let sequence = 0,
    focused = true,
    status = initialStatus,
    doctorPresence = null,
    messages = [],
    initialRequest = null,
    fallbackStatus = null,
    failMessages = false,
    failList = false,
    held,
    heldFull;
  let now = Date.now();
  const TestDate = class extends Date {
    static now() {
      return now;
    }
  };
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
  const apiClient = async (url, input) => {
    calls.push({ url, input });
    if (url.includes("/messages?")) {
      const response = {
        data: {
          summary: "Ca kiểm thử vừa gửi.",
          initial_request: initialRequest,
          messages,
          doctor_presence: doctorPresence,
          task_status: status,
        },
      };
      if (!url.includes("view=messages") && heldFull) await heldFull;
      if (held) await held;
      if (failMessages) throw new Error("Offline");
      return response;
    }
    if (url.startsWith("/api/doctor/tasks?")) {
      if (failList) throw new Error("Directory offline");
      return {
        data: {
          tasks: fallbackStatus
            ? [{ task_id: "new-task", ...fallbackStatus }]
            : [],
        },
      };
    }
    return { ok: true };
  };
  class Socket {
    constructor() {
      sockets.push(this);
    }
    close() {
      this.closed = true;
      this.onclose?.();
    }
  }
  const Screen = evaluate(
    "app/doctor-consultation/[taskId].tsx",
    {
      react: runtime,
      "../../src/features/doctor-ivr/DoctorIvrEntry": {
        DoctorIvrEntry: "IvrEntry",
        DoctorIvrInvitation: "IvrInvitation",
      },
      "../../src/lib/native-permissions": {
        runNativePermission: (run) => run(),
      },
      "@expo/vector-icons": { Ionicons: "Icon" },
      "expo-image-picker": {},
      "expo-router": {
        Stack: { Screen: "Stack" },
        useIsFocused: () => focused,
        useLocalSearchParams: () => ({
          taskId: "new-task",
          tenantId: "clinic-demo",
        }),
      },
      "react-i18next": { useTranslation: () => ({ t, i18n: { language } }) },
      "react-native": {
        ActivityIndicator: "Spinner",
        AppState: {
          currentState: "active",
          addEventListener: (_event, listener) => {
            appStateListeners.add(listener);
            return { remove: () => appStateListeners.delete(listener) };
          },
        },
        KeyboardAvoidingView: "Keyboard",
        Platform: { OS: "ios" },
        Pressable: "Button",
        ScrollView: "Scroll",
        StyleSheet: { create: (value) => value },
        View: "View",
        Linking: { openURL: async (url) => { openedUrls.push(url); } },
        Image: "Image",
      },
      "react-native-svg": { default: "Svg", Path: "Path", Circle: "Circle" },
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => ({ top: 20, bottom: 20 }),
      },
      "../../src/components/ScaledText": { ScaledText: "Text" },
      "../../src/components/ScaledTextInput": { ScaledTextInput: "Input" },
      "../../src/components/AppAlertModal": { AppAlertModal: "Alert" },
      "../../src/components/AppActionSheetModal": {
        AppActionSheetModal: "Actions",
      },
      "../../src/components/ScreenHeaderButton": { ScreenBackButton: "Back" },
      "../../src/hooks/useThemeColors": {
        useThemeColors: () => ({ colors: theme.lightColors, isDark: false }),
      },
      "../../src/hooks/useGuardedRouter": {
        useGuardedRouter: () => ({
          back() {},
          replace() {},
          push: (value) => navigation.push(value),
        }),
      },
      "../../src/lib/apiClient": {
        apiClient,
        getApiErrorMessage: (_error, translate, key) => translate(key),
      },
      "../../src/lib/env": {
        env: {
          doctorTenantId: "clinic-demo",
          apiBaseUrl: "https://fixture.invalid",
        },
      },
      "../../src/lib/tokenStore": {
        tokenStore: {
          loadToken: async () => "fixture-token",
          getToken: () => "fixture-token",
          subscribeSession: () => () => {},
        },
      },
      "../../src/stores/toast.store": { showToast: (message, type) => toasts.push({ message, type }) },
      "../../src/styles": theme,
      "@/lib/audio": { Audio: {} },
    },
    {
      Date: TestDate,
      WebSocket: Socket,
      setInterval: (work) => {
        const id = ++sequence;
        intervals.set(id, work);
        return id;
      },
      clearInterval: (id) => intervals.delete(id),
      setTimeout: (work, delay = 0) => {
        const id = ++sequence;
        timers.set(id, { work, deadline: now + delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      requestAnimationFrame: (work) => work(),
      cancelAnimationFrame: () => undefined,
    }
  ).default;
  const render = () => {
    const tree = runtime.render(Screen);
    const scroll = nodes(tree).find((node) => node.type === "Scroll");
    if (scroll) {
      scroll.props.ref.current = {
        scrollTo: (options) => scrolls.push(options),
        scrollToEnd: () => scrolls.push({ end: true }),
      };
    }
    return tree;
  };
  const settle = async () => {
    let tree;
    for (let i = 0; i < 7; i++) {
      tree = render();
      await tick();
    }
    return tree;
  };
  const composer = (tree) =>
    nodes(tree).find(
      (node) =>
        node.type === "Input" &&
        node.props.placeholder === t("doctorConsultationReplyPlaceholder")
    );
  const texts = (tree) =>
    nodes(tree)
      .filter((node) => node.type === "Text")
      .map((node) => node.props.children);
  return {
    calls,
    sockets,
    navigation,
    openedUrls,
    scrolls,
    toasts,
    t,
    render,
    settle,
    composer,
    texts,
    cleanup: () => runtime.unmount(),
    advanceTime: async (elapsed) => {
      now += elapsed;
      for (const [id, timer] of timers) {
        if (timer.deadline > now) continue;
        timers.delete(id);
        timer.work();
      }
      return settle();
    },
    status(value) {
      status = value;
    },
    doctorPresence(value) {
      doctorPresence = value;
    },
    presenceEvent: async (data) => {
      sockets[0].onmessage({ data: JSON.stringify({ type: "chat.doctor.presence.changed", data }) });
      return settle();
    },
    messages(value) {
      messages = value;
    },
    initialRequest(value) {
      initialRequest = value;
    },
    fallback(value) {
      fallbackStatus = value;
    },
    failList(value) {
      failList = value;
    },
    failMessages(value) {
      failMessages = value;
    },
    hold(value) {
      held = value;
    },
    holdFull(value) {
      heldFull = value;
    },
    poll: async () => {
      intervals.forEach((work) => work());
      return settle();
    },
    socketOpen: async () => {
      sockets[0].onopen();
      return settle();
    },
    lifecycle: async () => {
      sockets[0].onmessage({
        data: JSON.stringify({
          type: "chat.task.status.changed",
          data: { task_id: "new-task", status: status?.status },
        }),
      });
      return settle();
    },
    chatChange: async (data) => {
      sockets[0].onmessage({
        data: JSON.stringify({ type: "chat.message.changed", data }),
      });
      return settle();
    },
    appState: async (state) => {
      appStateListeners.forEach((listener) => listener(state));
      return settle();
    },
    focus: async (value) => {
      focused = value;
      return settle();
    },
  };
}
let checks = 0;
async function test(name, run) {
  await run();
  checks++;
  console.log(`PASS ${name}`);
}

for (const language of ["vi", "en"])
  await test(`${language}: a newly queued task without status is syncing, never completed or permanently closed`, async () => {
    const h = harness(language);
    try {
      const tree = await h.settle();
      assert.ok(h.texts(tree).includes(h.t("doctorConsultationStatusSyncing")));
      assert.ok(
        !h.texts(tree).includes(h.t("doctorConsultationStatus_completed"))
      );
      assert.ok(
        !h.texts(tree).includes(h.t("doctorConsultationConversationClosed"))
      );
      assert.equal(
        h.composer(tree),
        undefined,
        "Unknown status never bypasses server write permissions"
      );
      assert.ok(
        nodes(tree).some(
          (n) => n.props.accessibilityLabel === h.t("common:retry")
        )
      );
    } finally {
      h.cleanup();
    }
  });

await test("unknown status keeps polling with WebSocket connected and opens the same task once assigned", async () => {
  const h = harness();
  try {
    await h.settle();
    await h.socketOpen();
    h.status({ status: "assigned", rateable: false });
    const tree = await h.poll();
    assert.ok(h.composer(tree));
    assert.ok(h.texts(tree).includes(h.t("doctorConsultationStatus_assigned")));
    assert.ok(
      !h.texts(tree).includes(h.t("doctorConsultationStatus_completed"))
    );
    assert.equal(
      h.calls.filter((c) => c.input?.method === "POST").length,
      0,
      "Refreshing does not create a case or send a message"
    );
  } finally {
    h.cleanup();
  }
});

await test("queued -> assigned still polls while chat is connected, before the expert accepts", async () => {
  const h = harness("vi", { status: "queued", rateable: false });
  try {
    await h.settle();
    await h.socketOpen();
    h.status({ status: "assigned", rateable: false });
    assert.ok(
      h.texts(await h.poll()).includes(h.t("doctorConsultationStatus_assigned"))
    );
  } finally {
    h.cleanup();
  }
});

await test("lifecycle WebSocket updates refresh an active conversation into a real completed state", async () => {
  const h = harness("vi", { status: "in_progress", rateable: false });
  try {
    assert.ok(h.composer(await h.settle()));
    await h.socketOpen();
    h.status({ status: "completed", rateable: true });
    const tree = await h.lifecycle();
    assert.equal(h.composer(tree), undefined);
    assert.ok(
      h.texts(tree).includes(h.t("doctorConsultationStatus_completed"))
    );
    assert.ok(
      h.texts(tree).includes(h.t("doctorConsultationConversationClosed"))
    );
  } finally {
    h.cleanup();
  }
});

await test("reconnecting WebSocket refreshes lifecycle changes missed while disconnected", async () => {
  const h = harness("vi", { status: "in_progress", rateable: false });
  try {
    assert.ok(h.composer(await h.settle()));
    await h.socketOpen();
    h.status({ status: "completed", rateable: true });
    assert.equal(h.composer(await h.socketOpen()), undefined);
  } finally {
    h.cleanup();
  }
});

await test("background closes the task socket and foreground reconnects it", async () => {
  const h = harness("vi", { status: "in_progress", rateable: false });
  try {
    await h.settle();
    await h.socketOpen();
    assert.equal(h.sockets.length, 1);
    await h.appState("background");
    assert.equal(h.sockets[0].closed, true);
    await h.appState("active");
    assert.equal(h.sockets.length, 2);
  } finally {
    h.cleanup();
  }
});

await test("leaving the consultation closes its socket even when the route remains mounted", async () => {
  const h = harness("vi", { status: "in_progress", rateable: false });
  try {
    await h.settle();
    await h.socketOpen();
    await h.focus(false);
    assert.equal(h.sockets[0].closed, true);
    assert.equal(h.sockets.length, 1);
    await h.focus(true);
    assert.equal(h.sockets.length, 2);
    assert.equal(h.sockets[1].closed, undefined);
  } finally {
    h.cleanup();
  }
});

for (const status of [
  "cancelled",
  "expired",
  "failed",
  "forwarded",
  "emergency_referred",
])
  await test(`${status}: actual terminal labels are retained instead of calling every case completed`, async () => {
    const h = harness("vi", { status, rateable: false });
    try {
      const tree = await h.settle();
      assert.equal(h.composer(tree), undefined);
      assert.ok(
        h.texts(tree).includes(h.t(`doctorConsultationStatus_${status}`))
      );
      assert.ok(
        !h.texts(tree).includes(h.t("doctorConsultationStatus_completed"))
      );
    } finally {
      h.cleanup();
    }
  });

await test("completed follow-up stays messageable only within the server-approved window", async () => {
  const h = harness("vi", {
    status: "completed",
    rateable: true,
    follow_up_open: true,
    follow_up_until: new Date(Date.now() + 3600000).toISOString(),
  });
  try {
    assert.ok(h.composer(await h.settle()));
  } finally {
    h.cleanup();
  }
});

await test("persisted lifecycle fallback unlocks assigned tasks when the remote status is unavailable", async () => {
  const h = harness();
  h.fallback({ status: "assigned" });
  try {
    assert.ok(h.composer(await h.settle()));
  } finally {
    h.cleanup();
  }
});

await test("unavailable status and fallback remain unknown and Retry can recover without a new consultation", async () => {
  const h = harness();
  h.failList(true);
  try {
    let tree = await h.settle();
    assert.ok(
      !h.texts(tree).includes(h.t("doctorConsultationStatus_completed"))
    );
    h.failList(false);
    h.status({ status: "assigned", rateable: false });
    await nodes(tree)
      .find((n) => n.props.accessibilityLabel === h.t("common:retry"))
      .props.onPress();
    tree = await h.settle();
    assert.ok(h.composer(tree));
  } finally {
    h.cleanup();
  }
});

await test("polling and realtime bursts do not overlap the initial pending request", async () => {
  const h = harness();
  let resolve;
  h.hold(
    new Promise((done) => {
      resolve = done;
    })
  );
  try {
    await h.settle();
    await h.socketOpen();
    await h.poll();
    await h.poll();
    await h.lifecycle();
    assert.equal(h.calls.filter((c) => c.url.includes("/messages?")).length, 1);
    h.hold(null);
    resolve();
    await h.settle();
    h.status({ status: "assigned", rateable: false });
    assert.ok(h.composer(await h.poll()));
  } finally {
    h.cleanup();
  }
});

await test("temporary lifecycle outage preserves a typed reply until the known active status returns", async () => {
  const h = harness("vi", { status: "assigned", rateable: false });
  try {
    let tree = await h.settle();
    h.composer(tree).props.onChangeText("Nội dung đang soạn.");
    await h.settle();
    h.status(null);
    tree = await h.lifecycle();
    assert.equal(h.composer(tree), undefined);
    h.status({ status: "assigned", rateable: false });
    tree = await h.poll();
    assert.equal(h.composer(tree).props.value, "Nội dung đang soạn.");
  } finally {
    h.cleanup();
  }
});

console.log(
  `Doctor conversation lifecycle: ${checks} runtime regressions passed.`
);

await test("completed consultations link to a new intake with the original task and tenant", async () => {
  const h = harness("vi", { status: "completed", rateable: true });
  const tree = await h.settle();
  const button = nodes(tree).find(
    (n) =>
      n.type === "Button" &&
      nodes(n).some(
        (c) => c.type === "Text" && c.props.children === h.t("doctorReconsult")
      )
  );
  assert.ok(button);
  button.props.onPress();
  assert.deepEqual(h.navigation[0], {
    pathname: "/doctor-consultation",
    params: { previousTaskId: "new-task", tenantId: "clinic-demo" },
  });
  h.cleanup();
});
const callButton = (tree, label) =>
  nodes(tree).find((node) => node.type === "Button" && node.props.accessibilityLabel === label);

const assignedDoctor = {
  id: "expert-1",
  name: "Chuyên gia kiểm thử",
  avatar_url: "https://fixture.invalid/expert.jpg",
};

await test("each specialist message shows its author, including after a removed message", async () => {
  const h = harness("vi", { status: "in_progress", call_available: true, doctor: assignedDoctor });
  const content = "Ca tư vấn của bạn đang được ưu tiên xử lý.";
  const date = "2026-11-19T01:00:00.000Z";
  const reply = "Chào bạn";
  const previousDoctorReply = "Tôi đã chuyển ca tư vấn.";
  h.messages([
    { id: "1", content, sender_type: "doctor", sender_ref: "doctor-sla-worker", created_at: date },
    { id: "2", content: "", sender_type: "doctor", sender_ref: assignedDoctor.id, created_at: date, is_deleted: true },
    { id: "3", content: reply, sender_type: "doctor", sender_ref: assignedDoctor.id, created_at: date },
    { id: "4", content: previousDoctorReply, sender_type: "doctor", sender_ref: "expert-previous", created_at: date },
  ]);
  const tree = await h.settle();
  assert.ok(h.texts(tree).includes(h.t("doctorConsultationSystem")));
  assert.ok(h.texts(tree).includes(content));
  const bubbleTexts = (message) => h.texts(nodes(tree).find((node) =>
    node.type === "Button" && h.texts(node).includes(message)
  ));
  assert.ok(bubbleTexts(h.t("doctorConsultationMessageUnsent")).includes(assignedDoctor.name));
  assert.ok(bubbleTexts(reply).includes(assignedDoctor.name));
  assert.ok(bubbleTexts(previousDoctorReply).includes(h.t("doctorConsultationDoctor")));
  assert.ok(!bubbleTexts(previousDoctorReply).includes(assignedDoctor.name));
  assert.equal(h.texts(tree).filter((text) => text === h.t("doctorConsultationDoctor")).length, 1);
  assert.equal(nodes(tree).filter((node) =>
    node.type === "Image" && node.props.source.uri === assignedDoctor.avatar_url
  ).length, 3);
  assert.ok(!h.texts(tree).includes("Hủy ca tư vấn"));
  assert.equal(h.texts(tree).filter((text) => text === h.t("doctorConsultationExpertStatusUnknown")).length, 1);
  assert.equal(h.calls.filter((call) => call.url.endsWith("/cancel")).length, 0);
  h.cleanup();
});

await test("waiting-user chat shows only the assigned expert's presence, and live presence expires", async () => {
  const h = harness("vi", { status: "waiting_user", doctor: assignedDoctor });
  const availableUntil = new Date(Date.now() + 45_000).toISOString();
  try {
    h.doctorPresence({ doctor_ref: assignedDoctor.id, status: "offline", expires_at: null });
    let tree = await h.settle();
    assert.ok(h.texts(tree).includes(h.t("doctorConsultationExpertOffline")));
    assert.ok(!h.texts(tree).includes(h.t("doctorConsultationStatus_waiting_user")));
    assert.ok(h.composer(tree));
    await h.socketOpen();
    tree = await h.presenceEvent({ doctor_ref: "other-expert", status: "online", expires_at: availableUntil });
    assert.ok(!h.texts(tree).includes(h.t("doctorConsultationExpertOnline")));
    tree = await h.presenceEvent({ doctor_ref: assignedDoctor.id, status: "online", expires_at: availableUntil });
    assert.ok(h.texts(tree).includes(h.t("doctorConsultationExpertOnline")));
    tree = await h.presenceEvent({ doctor_ref: "other-expert", status: "offline", expires_at: null });
    assert.ok(h.texts(tree).includes(h.t("doctorConsultationExpertOnline")));
    tree = await h.presenceEvent({ doctor_ref: assignedDoctor.id, status: "offline", expires_at: null });
    assert.ok(h.texts(tree).includes(h.t("doctorConsultationExpertOffline")));
    tree = await h.presenceEvent({ doctor_ref: assignedDoctor.id, status: "online", expires_at: availableUntil });
    assert.ok(h.texts(tree).includes(h.t("doctorConsultationExpertOnline")));
    tree = await h.advanceTime(46_000);
    assert.ok(h.texts(tree).includes(h.t("doctorConsultationExpertOffline")));
    assert.ok(!h.texts(tree).includes(h.t("doctorConsultationExpertOnline")));
  } finally {
    h.cleanup();
  }
});

await test("the initial request renders the original description and screening questions as distinct fields", async () => {
  const h = harness("vi", { status: "in_progress" });
  h.initialRequest({
    description: "Đau đầu",
    answers: [{
      step: "onset",
      question: "Vấn đề này bắt đầu từ khi nào?",
      answer: "Hôm nay",
    }],
    risk_label: "Mức cần chú ý: cần theo dõi",
  });
  const tree = await h.settle();
  const text = h.texts(tree);
  const position = text.indexOf(h.t("doctorConsultationInitialRequest"));
  assert.ok(position >= 0);
  assert.deepEqual(text.slice(position, position + 6), [
    h.t("doctorConsultationInitialRequest"), "Đau đầu", h.t("doctorConsultationDeclaredAnswers"),
    "Vấn đề này bắt đầu từ khi nào?", "Hôm nay", "Mức cần chú ý: cần theo dõi",
  ]);
  assert.ok(!text.includes("Ca kiểm thử vừa gửi."));
  h.cleanup();
});

await test("approved question sets render an invitation to the matching session in the chat", async () => {
  const h = harness("vi", { status: "in_progress" });
  const sessionId = "11111111-1111-4111-8111-111111111111";
  h.messages([{
    id: "question-invitation",
    sender_type: "system",
    content: "Bác sĩ đã gửi câu hỏi",
    created_at: "2026-11-19T01:00:00.000Z",
    ivr_session_id: sessionId,
  }]);
  const tree = await h.settle();
  assert.equal(nodes(tree).find((node) => node.type === "IvrInvitation").props.sessionId, sessionId);
  assert.deepEqual(nodes(tree).find((node) => node.type === "IvrEntry").props.linkedSessionIds, [sessionId]);
  h.cleanup();
});

await test("Doctor's pin, quote, edit and reactions appear in the patient thread", async () => {
  const h = harness("vi", { status: "in_progress", doctor: assignedDoctor });
  const created_at = "2026-11-18T04:00:00.000Z";
  const replyDate = "2026-11-19T04:00:00.000Z";
  const older = { id: "older", content: "Ghim cũ", sender_type: "patient", created_at, pinned_at: created_at };
  const original = {
    id: "pinned", content: "Nội dung đã ghim", sender_type: "doctor",
    sender_ref: assignedDoctor.id, created_at, pinned_at: "2026-11-20T04:00:00.000Z",
  };
  h.messages([
    older,
    original,
    {
      id: "reply", content: "Tôi đã đọc.", sender_type: "patient", created_at: replyDate,
      reply_to_message_id: original.id,
      reply_to: { id: original.id, sender_type: "doctor", kind: "text", content: original.content },
      is_edited: true,
      reactions: [{ emoji: "👍", count: 2, reacted_by_me: true }],
    },
    { ...older, id: "hidden", content: "Không hiện dòng này.", is_deleted_for_me: true },
    { ...older, id: "removed", content: null, created_at: replyDate, deleted_at: replyDate },
  ]);
  const tree = await h.settle();
  const dateFormat = new Intl.DateTimeFormat("vi-VN", {
    day: "numeric", month: "short", year: "numeric",
  });
  for (const date of [created_at, replyDate]) {
    assert.equal(h.texts(tree).filter((value) => value === dateFormat.format(new Date(date))).length, 1);
  }
  assert.ok(h.texts(tree).includes(h.t("doctorConsultationMessageEdited")));
  assert.ok(h.texts(tree).includes(h.t("doctorConsultationOwnMessageUnsent")));
  assert.ok(!h.texts(tree).includes("Không hiện dòng này."));

  const jumpButtons = nodes(tree).filter((node) => node.type === "Button" &&
    node.props.accessibilityHint === h.t("doctorConsultationJumpToMessage"));
  assert.equal(jumpButtons.length, 2);
  assert.deepEqual(h.texts(jumpButtons[0]), [h.t("doctorConsultationPinnedMessage"), original.content]);
  assert.deepEqual(h.texts(jumpButtons[1]), [assignedDoctor.name, original.content]);
  const scroll = nodes(tree).find((node) => node.type === "Scroll");
  const originalRow = nodes(scroll).find((node) => node.props.onLayout &&
    h.texts(node).includes(original.content));
  originalRow.props.onLayout({ nativeEvent: { layout: { y: 240 } } });
  scroll.props.onContentSizeChange();
  assert.equal(h.scrolls.at(-1).end, true);
  for (const button of jumpButtons) button.props.onPress();
  assert.deepEqual(h.scrolls.slice(-2).map(({ y }) => y), [240 - theme.spacing.sm, 240 - theme.spacing.sm]);
  const scrollCount = h.scrolls.length;
  scroll.props.onContentSizeChange();
  assert.equal(h.scrolls.length, scrollCount);

  const reaction = nodes(tree).find((node) => node.props.accessibilityLabel ===
    `${h.t("doctorConsultationReact")} 👍 2`);
  assert.equal(reaction.props.accessibilityState.selected, true);
  reaction.props.onPress();
  await h.settle();
  assert.ok(h.calls.some(({ input }) => input?.body?.action === "react" &&
    input.body.message_id === "reply" && input.body.reaction === null));
  h.cleanup();
});

await test("a Doctor chat change during a pending request triggers a fresh thread read", async () => {
  const h = harness("en", { status: "in_progress", doctor: assignedDoctor });
  const requestCount = () => h.calls.filter(({ url }) => url.includes("/messages?")).length;
  try {
    await h.settle();
    await h.socketOpen();
    const baseline = requestCount();
    let unblock;
    h.hold(new Promise((done) => { unblock = done; }));
    await h.chatChange({ action: "created", message_id: "first" });
    h.messages([{
      id: "new-while-loading", sender_type: "doctor", sender_ref: assignedDoctor.id,
      created_at: "2026-11-19T04:00:00.000Z", content: "Follow-up from Doctor", is_pinned: true,
    }]);
    await h.chatChange({ action: "pin", message_id: "new-while-loading" });
    assert.equal(requestCount(), baseline + 1);
    h.hold(null);
    unblock();
    const tree = await h.settle();
    assert.ok(h.texts(tree).includes(h.t("doctorConsultationPinnedMessage")));
    assert.ok(h.texts(tree).includes("Follow-up from Doctor"));
    assert.equal(requestCount(), baseline + 2);
  } finally {
    h.cleanup();
  }
});

await test("a new message appears while the consultation status request is still pending", async () => {
  const h = harness("en", { status: "in_progress", doctor: assignedDoctor });
  let unblock;
  h.holdFull(new Promise((done) => { unblock = done; }));
  try {
    await h.settle();
    await h.socketOpen();
    const message = {
      id: "realtime-while-status-pending",
      sender_type: "doctor",
      sender_ref: assignedDoctor.id,
      content: "New reply",
      created_at: "2026-11-19T04:00:00.000Z",
    };
    h.messages([message]);
    const tree = await h.chatChange({ action: "created", message_id: message.id });
    assert.ok(h.texts(tree).includes(message.content));
    assert.equal(h.calls.filter(({ url }) => url.includes("/messages?") && !url.includes("view=messages")).length, 1);
    assert.equal(h.calls.filter(({ url }) => url.includes("view=messages")).length, 1);
    h.holdFull(null);
    unblock();
    assert.ok(h.texts(await h.settle()).includes(message.content));
  } finally {
    unblock();
    h.cleanup();
  }
});

await test("header call actions use the current room or request a call from the assigned specialist", async () => {
  const active = { status: "in_progress", call_available: true, doctor: assignedDoctor };
  const h = harness("vi", active);
  let tree = await h.settle();
  callButton(tree, h.t("doctorConsultationVoiceCall")).props.onPress();
  tree = await h.settle();
  const posted = h.calls.filter(({ url, input }) => url.endsWith("/messages") && input?.method === "POST");
  assert.equal(posted.length, 1);
  assert.equal(posted[0].input.body.tenant_id, "clinic-demo");
  assert.equal(posted[0].input.body.content, h.t("doctorConsultationRequestVoiceCall"));
  assert.equal(h.toasts.at(-1).message, h.t("doctorConsultationVoiceCallRequested"));

  const join = "https://meet.fixture.invalid/asinu-room";
  h.status({ ...active, video_room: { provider: "jitsi", join_url: join } });
  callButton(tree, h.t("doctorConsultationVideoCall")).props.onPress();
  tree = await h.settle();
  callButton(tree, h.t("doctorConsultationVoiceCall")).props.onPress();
  tree = await h.settle();
  assert.deepEqual(h.openedUrls, [
    join + "#config.disableDeepLinking=true",
    join + "#config.disableDeepLinking=true&config.startAudioOnly=true&config.startWithVideoMuted=true",
  ]);

  h.status({ status: "completed", call_available: false });
  callButton(tree, h.t("doctorConsultationVideoCall")).props.onPress();
  tree = await h.settle();
  assert.equal(callButton(tree, h.t("doctorConsultationVideoCall")).props.disabled, true);
  assert.equal(h.openedUrls.length, 2);
  assert.equal(h.calls.filter(({ url, input }) => url.endsWith("/messages") && input?.method === "POST").length, 1);
  h.cleanup();
});

await test("voice and video invitations label and open their respective join links", async () => {
  const h = harness("vi", { status: "in_progress", doctor: assignedDoctor });
  const videoUrl = "https://meet.fixture.invalid/asinu-doctor-0123456789abcdef01234567";
  const voiceUrl = `${videoUrl}#config.startAudioOnly=true&config.startWithVideoMuted=true`;
  const resourceUrl = "https://health.fixture.invalid/resource";
  h.messages([voiceUrl, videoUrl, resourceUrl].map((content, index) => ({
    id: `call-invitation-${index}`,
    sender_type: "doctor",
    sender_ref: assignedDoctor.id,
    created_at: "2026-11-19T01:00:00.000Z",
    content,
  })));

  const tree = await h.settle();
  const joinLinks = nodes(tree).filter(
    (node) => node.props?.accessibilityRole === "link"
  );
  assert.deepEqual(joinLinks.map((link) => h.texts(link).at(-1)), [
    h.t("doctorConsultationJoinVoice"),
    h.t("doctorConsultationJoinVideo"),
    h.t("doctorConsultationOpenLink"),
  ]);
  for (const link of joinLinks) link.props.onPress();
  assert.equal(h.openedUrls.length, 3);
  assert.equal(h.openedUrls[2], resourceUrl);
  h.openedUrls.slice(0, 2).forEach((opened, index) => {
    const [base, hash] = opened.split("#");
    assert.equal(base, videoUrl);
    const config = new URLSearchParams(hash);
    assert.equal(config.get("config.disableDeepLinking"), "true");
    assert.equal(config.get("config.startAudioOnly"), index === 0 ? "true" : null);
  });
  h.cleanup();
});

await test("patient typing starts immediately, renews during input and stops after idle, blur, send or exit", async () => {
  const h = harness("vi", { status: "in_progress" });
  let tree = await h.settle();
  const signals = () =>
    h.calls
      .filter(({ input }) => input?.body?.action === "typing")
      .map(({ url, input }) => {
        assert.equal(url, "/api/doctor/tasks/new-task/messages/action");
        assert.equal(input.body.tenant_id, "clinic-demo");
        assert.equal("content" in input.body, false);
        return input.body.is_typing;
      });
  const type = async (draft) => {
    h.composer(tree).props.onChangeText(draft);
    tree = await h.settle();
  };

  assert.deepEqual(signals(), []);
  await type("Tôi");
  assert.deepEqual(signals(), [true]);
  tree = await h.advanceTime(1_000);
  await type("Tôi đang");
  assert.deepEqual(signals(), [true]);
  tree = await h.advanceTime(1_000);
  await type("Tôi đang trả lời");
  assert.deepEqual(signals(), [true, true]);
  tree = await h.advanceTime(2_999);
  assert.deepEqual(signals(), [true, true]);
  tree = await h.advanceTime(1);
  assert.deepEqual(signals(), [true, true, false]);

  await type("Sửa lại");
  h.composer(tree).props.onBlur();
  tree = await h.settle();
  await type("Gửi phản hồi");
  const sendButton = nodes(tree).find(
    (node) => node.type === "Button" && node.props.children?.props?.name === "paper-plane",
  );
  assert.ok(sendButton);
  sendButton.props.onPress();
  tree = await h.settle();
  assert.ok(h.calls.some(({ input }) => input?.body?.content === "Gửi phản hồi"));
  await type("Tin nháp");
  h.cleanup();
  await tick();
  assert.deepEqual(signals(), [true, true, false, true, false, true, false, true, false]);
});

await test("consultation reacts and replies to a specialist message and displays projected results", async () => {
  const doctor = { id: "doctor-test", name: "Chuyên gia Kiểm thử" };
  const h = harness("vi", { status: "in_progress", doctor });
  const incoming = {
    id: "11111111-1111-4111-8111-111111111111",
    sender_type: "doctor",
    sender_ref: doctor.id,
    message_type: "question",
    content: "Nội dung được trích dẫn",
    created_at: new Date().toISOString(),
    read_at: new Date().toISOString(),
  };
  h.messages([incoming]);
  try {
    let tree = await h.settle();
    const openActions = async () => {
      nodes(tree).find((node) => node.props?.onLongPress).props.onLongPress();
      tree = await h.settle();
      return nodes(tree).find((node) => node.type === "Actions" && node.props.visible);
    };
    let sheet = await openActions();
    nodes(sheet.props.headerContent).find((node) =>
      node.props?.accessibilityLabel === `${h.t("doctorConsultationReact")} 👍`
    ).props.onPress();
    tree = await h.settle();
    assert.ok(h.calls.some(({ input }) =>
      input?.body?.action === "react" && input.body.message_id === incoming.id && input.body.reaction === "👍"
    ));

    h.messages([{ ...incoming, reactions: [{ emoji: "👍", count: 1, reacted_by_me: true }] }]);
    tree = await h.poll();
    const chip = nodes(tree).find((node) =>
      node.props?.accessibilityLabel === `${h.t("doctorConsultationReact")} 👍 1`
    );
    assert.equal(chip?.props.accessibilityState?.selected, true);
    chip.props.onPress();
    tree = await h.settle();
    assert.ok(h.calls.some(({ input }) => input?.body?.action === "react" && input.body.reaction === null));

    sheet = await openActions();
    sheet.props.onDismiss();
    sheet.props.actions.find((action) => action.key === "reply").onPress();
    tree = await h.settle();
    assert.ok(h.texts(tree).includes(h.t("doctorConsultationReplyingTo", { name: doctor.name })));
    h.composer(tree).props.onChangeText("Tin trả lời");
    tree = await h.settle();
    nodes(tree).find((node) => node.type === "Button" && node.props.children?.props?.name === "paper-plane").props.onPress();
    tree = await h.settle();
    assert.ok(h.calls.some(({ input }) => input?.body?.content === "Tin trả lời" && input.body.reply_to_message_id === incoming.id));
    assert.ok(!h.texts(tree).includes(h.t("doctorConsultationReplyingTo", { name: doctor.name })));

    h.messages([incoming, {
      ...incoming,
      id: "22222222-2222-4222-8222-222222222222",
      sender_type: "patient",
      content: "Tin trả lời",
      reply_to_message_id: incoming.id,
      reply_to: { id: incoming.id, sender_type: "doctor", content: incoming.content, kind: "text" },
    }]);
    tree = await h.poll();
    assert.equal(h.texts(tree).filter((text) => text === incoming.content).length, 2);
  } finally {
    h.cleanup();
  }
});

function entryPromptFixture() {
  const runtime = hooks();
  const routes = [];
  const requests = [];
  let pathname = "/home";
  let auth = { token: "fixture", hydrated: true, loading: false, profile: { id: 1, onboardingCompleted: true } };
  let guidanceReady = true;
  let blocked = false;
  let requestsHeld;
  let tasks = [];
  let foregroundListener;
  const authStore = Object.assign((select) => select(auth), { getState: () => auth });
  const feature = { isExpertConsultationEnabled: true };
  const taskService = evaluate("src/features/doctor-consultation/consultation-tasks.ts", {
    "../../lib/appEnv": feature,
    "../../lib/env": { env: { doctorTenantId: "clinic-default" } },
    "../../lib/apiClient": {
      async apiClient(url) {
        requests.push(url);
        if (url === "/api/doctor/clinics") {
          return { data: { items: [{ tenant_id: "clinic-other" }] } };
        }
        const response = { data: { tasks: url.includes("clinic-other") ? tasks : [] } };
        if (requestsHeld) await requestsHeld;
        return response;
      },
    },
  });
  const { ConsultationEntryPrompt: Prompt } = evaluate(
    "src/features/doctor-consultation/ConsultationEntryPrompt.tsx",
    {
      "expo-router": { usePathname: () => pathname },
      "react": runtime,
      "react-i18next": { useTranslation: () => ({ t: (key) => key }) },
      "react-native": { AppState: {
        currentState: "active",
        addEventListener(_event, listener) {
          foregroundListener = listener;
          return { remove() { foregroundListener = undefined; } };
        },
      } },
      "../../components/AppAlertModal": { AppAlertModal: "Alert" },
      "../../hooks/useCheckinPresentation": { useCheckinPresentationBlocked: () => blocked },
      "../../hooks/useGuardedRouter": { useGuardedRouter: () => ({ push: (route) => routes.push(route) }) },
      "../../lib/appEnv": feature,
      "../auth/auth.store": { useAuthStore: authStore },
      "../guidance/guidance.store": { useGuidanceStore: (select) => select({
        account: String(auth.profile?.id), ready: guidanceReady,
        progress: { welcomeSeen: true }, welcomeOpen: !guidanceReady,
      }) },
      "./consultation-tasks": taskService,
    },
  );
  return {
    routes,
    requests,
    tasks(value) { tasks = value; },
    path(value) { pathname = value; },
    foreground(value) { foregroundListener(value); },
    guidance(value) { guidanceReady = value; },
    checkin(value) { blocked = value; },
    logout() { auth = { ...auth, token: null, profile: null }; },
    hold(value) { requestsHeld = value; },
    async settle() {
      runtime.render(Prompt);
      await tick();
      return runtime.render(Prompt).props;
    },
    cleanup: () => runtime.unmount(),
  };
}

await test("Home prompts for an open consultation only once per entry and resumes the matching clinic chat", async () => {
  const h = entryPromptFixture();
  try {
    h.tasks([
      { task_id: "newer-closed", status: "completed", created_at: "2026-11-21", follow_up_until: "2020-01-01" },
      { task_id: "open", status: "waiting_user", created_at: "2026-11-20" },
    ]);
    h.guidance(false);
    assert.equal((await h.settle()).visible, false);
    assert.deepEqual(h.requests, []);
    h.guidance(true);
    const modal = await h.settle();
    assert.equal(modal.visible && modal.queued, true);
    assert.equal(modal.buttons[1].text, "doctorConsultationContinueLater");
    modal.onDismiss();
    h.path("/account");
    await h.settle();
    h.path("/home");
    h.foreground("inactive");
    h.foreground("active");
    assert.equal((await h.settle()).visible, false);
    assert.equal(h.requests.length, 3);

    h.foreground("background");
    assert.equal((await h.settle()).visible, false);
    h.foreground("active");
    const nextModal = await h.settle();
    assert.equal(nextModal.visible, true);
    nextModal.onDismiss();
    nextModal.buttons[0].onPress();
    assert.deepEqual(h.routes, [{
      pathname: "/doctor-consultation/[taskId]",
      params: { taskId: "open", tenantId: "clinic-other" },
    }]);
  } finally {
    h.cleanup();
  }
});

await test("startup ignores closed and unknown cases, deep links to chat and results received after logout", async () => {
  const h = entryPromptFixture();
  try {
    h.path("/doctor-consultation/open");
    assert.equal((await h.settle()).visible, false);
    h.path("/home");
    assert.equal((await h.settle()).visible, false);
    assert.deepEqual(h.requests, []);

    h.tasks([{ task_id: "unknown", status: null, created_at: "2026-11-20" }]);
    h.foreground("background");
    h.foreground("active");
    assert.equal((await h.settle()).visible, false);

    h.foreground("background");
    h.foreground("active");
    h.checkin(true);
    assert.equal((await h.settle()).visible, false);
    assert.equal(h.requests.length, 3);
    h.checkin(false);
    h.tasks([{ task_id: "open", status: "in_progress", created_at: "2026-11-20" }]);
    let release;
    h.hold(new Promise((resolve) => { release = resolve; }));
    await h.settle();
    h.logout();
    release();
    assert.equal((await h.settle()).visible, false);
    assert.deepEqual(h.routes, []);
  } finally {
    h.cleanup();
  }
});
