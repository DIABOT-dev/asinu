import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
function evaluate(file, adapters, globals = {}, source = fs.readFileSync(file, "utf8")) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  // Execute local feature modules with controlled native dependencies.
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", ...Object.keys(globals), code)(
    module,
    module.exports,
    (id) => {
      if (id === "react/jsx-runtime") {
        const jsx = (type, props, key) => ({ type, props: { ...props, key } });
        return { jsx, jsxs: jsx };
      }
      assert.ok(id in adapters, `Missing hook adapter ${id}`);
      return adapters[id];
    },
    ...Object.values(globals),
  );
  return module.exports;
}

// Controlled React lifecycle and API adapters, executing the actual feature hooks.
function runtime() {
  let cursor = 0;
  let focused = true;
  let pending = [];
  const slots = [];
  const memo = (fn, deps) => {
    const index = cursor++;
    if (
      !slots[index] ||
      deps.some((value, i) => !Object.is(value, slots[index].deps[i]))
    ) {
      slots[index] = { deps, value: fn() };
    }
    return slots[index].value;
  };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index])
        slots[index] = {
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
    useRef(initial) {
      return memo(() => ({ current: initial }), []);
    },
    useCallback: (fn, deps) => memo(() => fn, deps),
    useMemo: (fn, deps) => memo(fn, deps),
    useEffect(callback, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
        slots[index] = { kind: 'effect', deps };
        pending.push(() => {
          previous?.cleanup?.();
          slots[index].cleanup = callback();
        });
      }
    },
  };
  const router = {
    useFocusEffect(callback) {
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
  };
  return {
    hooks,
    router,
    render(fn) {
      cursor = 0;
      return fn();
    },
    async settle(fn) {
      this.render(fn);
      const effects = pending;
      pending = [];
      effects.forEach((fn) => fn());
      await flush();
      return this.render(fn);
    },
    blur() {
      focused = false;
      slots.forEach((slot) => {
        if (slot.kind !== 'focus') return;
        slot.cleanup?.();
        slot.cleanup = null;
      });
    },
    focus() {
      focused = true;
      slots.forEach((slot) => {
        if (slot.callback && !slot.cleanup) slot.cleanup = slot.callback();
      });
    },
  };
}
let checks = 0;
const permissionEvents = evaluate("src/lib/device-permission-events.ts", {});
async function test(label, work) {
  await work();
  checks++;
  console.log(`PASS ${label}`);
}

function coinsHarness() {
  const r = runtime();
  const auth = { profile: { id: "alice" } };
  const listeners = new Set();
  const calls = { balances: 0, history: [] };
  const server = {
    enabled: true,
    balance: 12,
    date: "2026-11-03",
    pages: { "": [] },
    historyError: false,
    balanceError: false,
    pendingBalance: null,
  };
  const { useProfileCoins } = evaluate("src/features/v21/useProfileCoins.ts", {
    react: r.hooks,
    "expo-router": r.router,
    "../auth/auth.store": { useAuthStore: (selector) => selector(auth) },
    "../../lib/health-action-events": {
      subscribeHealthAction: (callback) => {
        listeners.add(callback);
        return () => listeners.delete(callback);
      },
    },
    "./v21.api": {
      v21Api: {
        flags: async () => ({ coins: server.enabled }),
        coins: async () => {
          calls.balances++;
          if (server.pendingBalance) return server.pendingBalance;
          if (server.balanceError) throw new Error("offline");
          return { balance: server.balance, serverDate: server.date };
        },
        history: async (before = "") => {
          calls.history.push(before);
          if (server.historyError) throw new Error("offline");
          return { items: server.pages[before] ?? [] };
        },
      },
    },
  });
  return {
    ...r,
    server,
    calls,
    auth,
    read: () => r.render(useProfileCoins),
    settle: () => r.settle(useProfileCoins),
    update: () => listeners.forEach((fn) => fn()),
  };
}
const entry = (
  id,
  delta,
  reason = "CHECKIN",
  created_at = "2026-11-03T02:00:00Z",
) => ({ id: String(id), delta, reason, created_at });

await test("profile balance stays hidden when server disables coins", async () => {
  const h = coinsHarness();
  h.server.enabled = false;
  assert.equal((await h.settle()).enabled, false);
  assert.equal(h.calls.balances, 0);
  h.blur();
});
await test("daily coins use Vietnam midnight and exclude spending, expiry and compensation", async () => {
  const h = coinsHarness();
  h.server.pages[""] = [
    entry(6, 10, "CHECKIN", "2026-11-02T17:00:00Z"),
    entry(5, 2, "GIFT_OPEN"),
    entry(4, 5, "VITAL", "2026-11-02T16:59:59Z"),
    entry(3, -50, "REDEEM"),
    entry(2, -1, "EXPIRE"),
    entry(1, 50, "REFUND"),
  ];
  const result = await h.settle();
  assert.equal(result.balance, 12);
  assert.equal(result.earnedToday, 12);
  h.blur();
});
await test("a full history page cannot truncate today’s earned coins", async () => {
  const h = coinsHarness();
  h.server.pages[""] = Array.from({ length: 30 }, (_, i) =>
    entry(60 - i, i === 0 ? 10 : -1, i === 0 ? "CHECKIN" : "REDEEM"),
  );
  h.server.pages["31"] = [entry(30, 2, "GIFT_OPEN")];
  assert.equal((await h.settle()).earnedToday, 12);
  assert.deepEqual(h.calls.history, ["", "31"]);
  h.blur();
});
await test("history failure retains the real balance without inventing a daily total", async () => {
  const h = coinsHarness();
  h.server.historyError = true;
  const result = await h.settle();
  assert.equal(result.balance, 12);
  assert.equal(result.earnedToday, null);
  h.blur();
});
await test("earning events refresh the balance; failed refresh preserves the confirmed value", async () => {
  const h = coinsHarness();
  await h.settle();
  h.server.balance = 22;
  h.update();
  await h.settle();
  assert.equal(h.read().balance, 22);
  h.server.balanceError = true;
  h.update();
  await h.settle();
  assert.equal(h.read().balance, 22);
  h.blur();
  const count = h.calls.balances;
  h.update();
  await flush();
  assert.equal(h.calls.balances, count);
});
await test("a late balance cannot replace another account’s balance", async () => {
  const h = coinsHarness();
  let finish;
  h.server.pendingBalance = new Promise((resolve) => {
    finish = resolve;
  });
  await h.settle();
  h.auth.profile = { id: "bob" };
  h.server.pendingBalance = null;
  h.server.balance = 7;
  assert.equal(h.read().enabled, false);
  await h.settle();
  finish({ balance: 99, serverDate: h.server.date });
  await flush();
  assert.equal(h.read().balance, 7);
  h.blur();
});

function cameraHarness(requestOnFocus) {
  const r = runtime();
  const listeners = new Set();
  const server = {
    permission: { granted: false, canAskAgain: true },
    pending: null,
  };
  const calls = { requests: 0, settings: 0 };
  const get = async () => server.pending ?? server.permission;
  const request = async () => {
    calls.requests++;
    server.permission = { granted: true, canAskAgain: true };
    return server.permission;
  };
  const { useQrCameraPermission } = evaluate(
    "src/features/care-circle/useQrCameraPermission.ts",
    {
      react: r.hooks,
      "expo-router": r.router,
      "expo-camera": {
        useCameraPermissions: () => [server.permission, request, get],
      },
      "react-native": {
        Linking: {
          openSettings: async () => {
            calls.settings++;
          },
        },
        AppState: {
          addEventListener: (_, listener) => {
            listeners.add(listener);
            return { remove: () => listeners.delete(listener) };
          },
        },
      },
      "../../lib/native-permissions": {
        runNativePermission: (fn, options) => (options.canRun() ? fn() : null),
      },
    },
  );
  const useCameraFeature = () => useQrCameraPermission(requestOnFocus);
  return {
    ...r,
    server,
    calls,
    read: () => r.render(useCameraFeature),
    settle: () => r.settle(useCameraFeature),
    resume: () => listeners.forEach((fn) => fn("active")),
  };
}
await test("opening Profile reads camera permission without prompting", async () => {
  const h = cameraHarness(false);
  await h.settle();
  assert.equal(h.calls.requests, 0);
  assert.equal(h.calls.settings, 0);
  h.blur();
});
await test("opening scanner requests camera permission directly, once", async () => {
  const h = cameraHarness(true);
  await h.settle();
  await h.settle();
  assert.equal(h.calls.requests, 1);
  assert.equal(h.read().permission.granted, true);
  h.blur();
});
await test("permanent denial is not automatically redirected; an explicit tap opens Settings", async () => {
  const h = cameraHarness(true);
  h.server.permission.canAskAgain = false;
  await h.settle();
  assert.equal(h.calls.settings, 0);
  await h.read().change(true);
  assert.equal(h.calls.settings, 1);
  assert.equal(h.calls.requests, 0);
  h.blur();
});
await test("revoking camera access opens OS Settings rather than inventing a local permission", async () => {
  const h = cameraHarness(false);
  h.server.permission.granted = true;
  await h.settle();
  await h.read().change(false);
  assert.equal(h.calls.settings, 1);
  assert.equal(h.read().permission.granted, true);
  h.blur();
});
await test("leaving scanner before permission lookup completes cannot trigger a camera dialog", async () => {
  const h = cameraHarness(true);
  let finish;
  h.server.pending = new Promise((resolve) => {
    finish = resolve;
  });
  await h.settle();
  h.blur();
  finish({ granted: false, canAskAgain: true });
  await flush();
  assert.equal(h.calls.requests, 0);
  assert.equal(h.calls.settings, 0);
});

function treeHarness() {
  const r = runtime();
  const auth = { profile: { id: "alice" } };
  const server = {
    score: { level: "monitor", factors: ["status_tired"], checkinDone: true },
    error: false,
    pending: null,
  };
  const calls = { scores: 0 };
  const { useHealthTreeOverview } = evaluate(
    "src/features/tree/useHealthTreeOverview.ts",
    {
      react: r.hooks,
      "expo-router": r.router,
      "../auth/auth.store": { useAuthStore: (selector) => selector(auth) },
      "../checkin/checkin.api": {
        checkinApi: {
          getHealthScore: async () => {
            calls.scores++;
            if (server.pending) return server.pending;
            if (server.error) throw new Error("offline");
            return server.score;
          },
        },
      },
    },
  );
  return {
    ...r,
    server,
    auth,
    calls,
    read: () => r.render(useHealthTreeOverview),
    settle: () => r.settle(useHealthTreeOverview),
  };
}
await test("initial health-score completion does not invalidate the calendar that is already loading", async () => {
  const h = treeHarness(); let finish;
  h.server.pending = new Promise(resolve => { finish = resolve; });
  await h.settle(); assert.equal(h.read().refreshKey, 0);
  finish(h.server.score); await flush();
  assert.equal(h.read().refreshKey, 0); assert.equal(h.calls.scores, 1); h.blur();
});
await test("calendar refresh starts once per pull and is independent of the health-score response", async () => {
  const h = treeHarness(); await h.settle(); let finish;
  h.server.pending = new Promise(resolve => { finish = resolve; });
  const pending = h.read().refresh();
  assert.equal(h.read().refreshKey, 1); assert.equal(h.read().refreshing, true);
  finish(h.server.score); await pending;
  assert.equal(h.read().refreshKey, 1);
  h.server.pending = null; h.server.error = true;
  await h.read().refresh();
  assert.equal(h.read().refreshKey, 2); assert.equal(h.read().error, true); h.blur();
});
await test("returning to Overview updates its calendar once without a second update after the score finishes", async () => {
  const h = treeHarness(); await h.settle(); h.blur(); h.focus(); await flush();
  assert.equal(h.calls.scores, 2); assert.equal(h.read().refreshKey, 1); h.blur();
});
await test("failed health refresh preserves the real status and exposes retry", async () => {
  const h = treeHarness();
  await h.settle();
  h.server.error = true;
  await h.read().refresh();
  assert.equal(h.read().score.level, "monitor");
  assert.equal(h.read().error, true);
  h.server.error = false;
  h.server.score = { level: "ok", factors: [], checkinDone: true };
  await h.read().retry();
  assert.equal(h.read().score.level, "ok");
  assert.equal(h.read().error, false);
  h.blur();
});
await test("late health status cannot cross account boundaries", async () => {
  const h = treeHarness();
  let finish;
  h.server.pending = new Promise((resolve) => {
    finish = resolve;
  });
  await h.settle();
  h.auth.profile = { id: "bob" };
  h.server.pending = null;
  h.server.score = {
    level: "danger",
    factors: ["emergency_triggered"],
    checkinDone: true,
  };
  assert.equal(h.read().score, null);
  await h.settle();
  finish({ level: "ok", factors: [], checkinDone: true });
  await flush();
  assert.equal(h.read().score.level, "danger");
  h.blur();
});
await test("leaving Overview ignores a pending health result", async () => {
  const h = treeHarness();
  let finish;
  h.server.pending = new Promise((resolve) => {
    finish = resolve;
  });
  await h.settle();
  h.blur();
  finish({ level: "ok", factors: [], checkinDone: true });
  await flush();
  assert.equal(h.read().score, null);
});

function reminderHarness() {
  const r = runtime();
  const listeners = new Set();
  const auth = { token: "session-a" };
  const server = { allowed: false, pending: null, error: false, remindersEnabled: true, preferenceError: false, pendingPrefs: null };
  const calls = { reads: 0, routes: [] };
  const { ReminderSettingsEntry } = evaluate(
    "src/features/profile/ReminderSettingsEntry.tsx",
    {
      react: r.hooks,
      "expo-router": r.router,
      "react-native": {
        ActivityIndicator: "Spinner",
        Pressable: "Button",
        View: "View",
        StyleSheet: { create: (value) => value },
        AppState: {
          addEventListener: (_, listener) => {
            listeners.add(listener);
            return { remove: () => listeners.delete(listener) };
          },
        },
      },
      "@expo/vector-icons": { Ionicons: "Icon" },
      "react-i18next": { useTranslation: () => ({ t: (key) => key }) },
      "../../components/ScaledText": { ScaledText: "Text" },
      "../../hooks/useGuardedRouter": {
        useGuardedRouter: () => ({ push: (path) => calls.routes.push(path) }),
      },
      "../../hooks/useThemeColors": { useThemeColors: () => ({ colors: {} }) },
      "../auth/auth.store": { useAuthStore: { getState: () => auth } },
      "../notifications/notifications.api": {
        getNotificationPreferences: async () => {
          if (server.preferenceError) throw new Error("Reminder preference unavailable");
          return server.pendingPrefs ?? { ok: true, reminders_enabled: server.remindersEnabled };
        },
      },
      "../../lib/device-permission-events": permissionEvents,
      "../../lib/notifications": {
        checkNotificationPermission: async () => {
          calls.reads++;
          if (server.error) throw new Error("Permission lookup failed");
          return server.pending ?? server.allowed;
        },
      },
    },
  );
  return {
    ...r,
    auth,
    server,
    calls,
    read: () => r.render(ReminderSettingsEntry),
    settle: () => r.settle(ReminderSettingsEntry),
    foreground: () => listeners.forEach((listener) => listener("active")),
  };
}
await test("reminder settings are disabled without notification permission, including direct handler calls", async () => {
  const h = reminderHarness();
  await h.settle();
  assert.equal(h.read().props.disabled, true);
  assert.equal(h.read().props.accessibilityState.disabled, true);
  h.read().props.onPress();
  await flush();
  assert.deepEqual(h.calls.routes, []);
  h.blur();
});
await test("granting and revoking notifications in device Settings refreshes reminder access on return", async () => {
  const h = reminderHarness();
  await h.settle();
  h.server.allowed = true;
  h.foreground();
  await h.settle();
  assert.equal(h.read().props.disabled, false);
  h.server.allowed = false;
  h.foreground();
  await h.settle();
  assert.equal(h.read().props.disabled, true);
  h.blur();
});
await test("notification access alone cannot open reminder settings while task reminders are disabled", async () => {
  const h = reminderHarness();
  h.server.allowed = true;
  h.server.remindersEnabled = false;
  await h.settle();
  assert.equal(h.read().props.disabled, true);
  h.read().props.onPress();
  await flush();
  assert.deepEqual(h.calls.routes, []);
  h.server.remindersEnabled = true;
  permissionEvents.notifyTaskReminderPreferenceChanged();
  await h.settle();
  assert.equal(h.read().props.disabled, false);
  h.blur();
});
await test("failed task reminder preferences keep reminder settings disabled", async () => {
  const h = reminderHarness();
  h.server.allowed = true;
  h.server.preferenceError = true;
  await h.settle();
  assert.equal(h.read().props.disabled, true);
  h.read().props.onPress();
  await flush();
  assert.deepEqual(h.calls.routes, []);
  h.blur();
});
await test("a failed permission lookup never enables reminder settings", async () => {
  const h = reminderHarness();
  h.server.error = true;
  await h.settle();
  assert.equal(h.read().props.disabled, true);
  h.read().props.onPress();
  await flush();
  assert.deepEqual(h.calls.routes, []);
  h.blur();
});
await test("permission revoked after rendering is checked before opening reminder settings", async () => {
  const h = reminderHarness();
  h.server.allowed = true;
  await h.settle();
  assert.equal(h.read().props.disabled, false);
  h.server.allowed = false;
  h.read().props.onPress();
  await h.settle();
  assert.deepEqual(h.calls.routes, []);
  assert.equal(h.read().props.disabled, true);
  h.blur();
});
await test("duplicate taps recheck permission once and open one reminder screen", async () => {
  const h = reminderHarness();
  h.server.allowed = true;
  await h.settle();
  let finish;
  h.server.pending = new Promise((resolve) => {
    finish = resolve;
  });
  const button = h.read();
  button.props.onPress();
  button.props.onPress();
  assert.equal(h.read().props.disabled, true);
  assert.equal(h.calls.reads, 2);
  finish(true);
  await h.settle();
  assert.deepEqual(h.calls.routes, ["/reminder-config"]);
  h.blur();
});
await test("a late permission read cannot replace a newer revoked permission", async () => {
  const h = reminderHarness();
  let finish;
  h.server.pending = new Promise((resolve) => {
    finish = resolve;
  });
  await h.settle();
  assert.equal(h.read().props.accessibilityState.busy, true);
  h.server.pending = null;
  h.server.allowed = false;
  h.foreground();
  await h.settle();
  finish(true);
  await flush();
  assert.equal(h.read().props.disabled, true);
  h.blur();
});
for (const leave of ["blur", "account"]) {
  await test(`${leave}: a pending permission recheck cannot navigate after the session changes`, async () => {
    const h = reminderHarness();
    h.server.allowed = true;
    await h.settle();
    let finish;
    h.server.pending = new Promise((resolve) => {
      finish = resolve;
    });
    h.read().props.onPress();
    if (leave === "blur") h.blur();
    else h.auth.token = "session-b";
    finish(true);
    await flush();
    assert.deepEqual(h.calls.routes, []);
    h.blur();
  });
}

function devicePermissionHarness(kind) {
  const r = runtime();
  const auth = { token: "session-a" };
  const listeners = new Set();
  const server = {
    permission: { granted: false, canAskAgain: true },
    deny: false,
    readError: false,
    pendingRead: null,
    pendingRequest: null,
    settingsResult: null,
  };
  const calls = {
    reads: 0,
    requests: 0,
    settings: 0,
    native: [],
    toasts: [],
    push: [],
  };
  const get = async () => {
    calls.reads++;
    if (server.readError) throw new Error("Native permission unavailable");
    return server.pendingRead ?? { ...server.permission };
  };
  const request = async () => {
    calls.requests++;
    if (server.pendingRequest) await server.pendingRequest;
    if (!server.deny)
      server.permission = { ...server.permission, granted: true };
    return { ...server.permission };
  };
  const useAuthStore = Object.assign((select) => select(auth), {
    getState: () => auth,
  });
  const { useDevicePermission } = evaluate(
    "src/features/profile/useDevicePermission.ts",
    {
      react: r.hooks,
      "expo-router": r.router,
      "react-i18next": { useTranslation: () => ({ t: (key) => key }) },
      "expo-notifications": {
        getPermissionsAsync: get,
        requestPermissionsAsync: request,
      },
      "expo-audio": {
        getRecordingPermissionsAsync: get,
        requestRecordingPermissionsAsync: request,
      },
      "expo-image-picker": {
        getMediaLibraryPermissionsAsync: get,
        requestMediaLibraryPermissionsAsync: request,
      },
      "react-native": {
        AppState: {
          addEventListener: (_, callback) => {
            listeners.add(callback);
            return { remove: () => listeners.delete(callback) };
          },
        },
        Linking: {
          openSettings: async () => {
            calls.settings++;
            if (server.settingsResult)
              server.permission = server.settingsResult;
          },
        },
      },
      "../../lib/native-permissions": {
        runNativePermission: async (work, options) => {
          assert.equal(options.canRun(), true);
          calls.native.push(options.key);
          return work();
        },
      },
      "../../lib/notifications": {
        refreshNotificationLocalization: async () => {},
        getExpoPushToken: async () => "fixture-push-token",
      },
      "../../lib/device-permission-events": permissionEvents,
      "../../stores/toast.store": {
        showToast: (...args) => calls.toasts.push(args),
      },
      "../auth/auth.api": {
        authApi: { updatePushToken: async (token) => calls.push.push(token) },
      },
      "../auth/auth.store": { useAuthStore },
    },
  );
  const usePermissionFeature = () => useDevicePermission(kind);
  return {
    ...r,
    auth,
    server,
    calls,
    read: () => r.render(usePermissionFeature),
    settle: () => r.settle(usePermissionFeature),
    foreground: () => listeners.forEach((fn) => fn("active")),
  };
}

for (const kind of ["notifications", "microphone", "photos"]) {
  await test(`${kind}: opening Permissions only reads access; enabling requests native consent`, async () => {
    const h = devicePermissionHarness(kind);
    await h.settle();
    assert.equal(h.calls.requests, 0);
    assert.equal(h.calls.settings, 0);
    await h.read().change(true);
    await h.settle();
    assert.equal(h.calls.requests, 1);
    assert.equal(h.calls.settings, 0);
    assert.equal(h.read().permission.granted, true);
    if (kind === "notifications") {
      await flush();
      assert.deepEqual(h.calls.push, ["fixture-push-token"]);
    }
    h.blur();
  });
  await test(`${kind}: denying native consent leaves the switch off`, async () => {
    const h = devicePermissionHarness(kind);
    h.server.deny = true;
    await h.settle();
    await h.read().change(true);
    await h.settle();
    assert.equal(h.calls.requests, 1);
    assert.equal(h.calls.settings, 0);
    assert.equal(h.read().permission.granted, false);
    assert.equal(h.read().pending, false);
    h.blur();
  });
  await test(`${kind}: permanent denial opens Settings only after an explicit toggle`, async () => {
    const h = devicePermissionHarness(kind);
    h.server.permission.canAskAgain = false;
    await h.settle();
    assert.equal(h.calls.settings, 0);
    h.server.settingsResult = { granted: true, canAskAgain: false };
    await h.read().change(true);
    await h.settle();
    assert.equal(h.calls.requests, 0);
    assert.equal(h.calls.settings, 1);
    assert.equal(h.read().permission.granted, true);
    h.blur();
  });
  await test(`${kind}: turning off uses Settings and never invents a revoked permission`, async () => {
    const h = devicePermissionHarness(kind);
    h.server.permission.granted = true;
    await h.settle();
    await h.read().change(false);
    await h.settle();
    assert.equal(h.calls.settings, 1);
    assert.equal(h.read().permission.granted, true);
    h.server.permission.granted = false;
    h.foreground();
    await h.settle();
    assert.equal(h.read().permission.granted, false);
    h.blur();
  });
}
await test("limited photo access is preserved as limited and can be revoked through Settings", async () => {
  const h = devicePermissionHarness("photos");
  h.server.permission = {
    granted: false,
    canAskAgain: true,
    accessPrivileges: "limited",
  };
  await h.settle();
  assert.equal(h.read().permission.accessPrivileges, "limited");
  await h.read().change(false);
  await h.settle();
  assert.equal(h.calls.settings, 1);
  assert.equal(h.calls.requests, 0);
  h.blur();
});
await test("duplicate permission toggles send one native request and clear pending after consent", async () => {
  const h = devicePermissionHarness("microphone");
  await h.settle();
  let finish;
  h.server.pendingRequest = new Promise((resolve) => {
    finish = resolve;
  });
  const row = h.read();
  const first = row.change(true);
  const duplicate = row.change(true);
  await flush();
  assert.equal(h.calls.requests, 1);
  assert.equal(h.read().pending, true);
  finish();
  await Promise.all([first, duplicate]);
  await h.settle();
  assert.equal(h.read().pending, false);
  assert.equal(h.read().permission.granted, true);
  h.blur();
});
for (const change of ["blur", "account"]) {
  await test(`${change}: a late permission lookup cannot open a native prompt or Settings`, async () => {
    const h = devicePermissionHarness("notifications");
    await h.settle();
    let finish;
    h.server.pendingRead = new Promise((resolve) => {
      finish = resolve;
    });
    const pending = h.read().change(true);
    await flush();
    if (change === "blur") h.blur();
    else h.auth.token = "session-b";
    finish({ granted: false, canAskAgain: true });
    await pending;
    await flush();
    assert.equal(h.calls.requests, 0);
    assert.equal(h.calls.settings, 0);
    assert.deepEqual(h.calls.push, []);
    h.blur();
  });
}
await test("a failed native permission read is retryable and cannot enable the switch", async () => {
  const h = devicePermissionHarness("photos");
  h.server.readError = true;
  await h.settle();
  assert.equal(h.read().failed, true);
  assert.equal(h.read().permission, null);
  await h.read().change(true);
  assert.equal(h.calls.requests, 0);
  h.server.readError = false;
  await h.read().refresh();
  await h.settle();
  assert.equal(h.read().failed, false);
  assert.equal(h.read().permission.granted, false);
  h.blur();
});
await test("a stale foreground permission result cannot overwrite a newer revocation", async () => {
  const h = devicePermissionHarness("microphone");
  await h.settle();
  let finish;
  h.server.pendingRead = new Promise((resolve) => {
    finish = resolve;
  });
  h.foreground();
  await flush();
  h.server.pendingRead = null;
  h.foreground();
  await h.settle();
  finish({ granted: true, canAskAgain: true });
  await flush();
  assert.equal(h.read().permission.granted, false);
  h.blur();
});

await test("permission rows use the switch instead of repeating granted or denied text below the label", () => {
  let permission = { granted: true, canAskAgain: true };
  let failed = false;
  const { ProfileDevicePermissions } = evaluate(
    "src/features/profile/ProfileDevicePermissions.tsx",
    {
      "@expo/vector-icons": { Ionicons: "Icon" },
      "react-i18next": { useTranslation: () => ({ t: (key) => key }) },
      "react-native": {
        View: "View",
        ActivityIndicator: "Loading",
        Pressable: "Button",
        Switch: "Switch",
        StyleSheet: { create: (styles) => styles },
      },
      "../../components/ScaledText": { ScaledText: "Text" },
      "../../hooks/useThemeColors": { useThemeColors: () => ({ colors: {} }) },
      "../care-circle/components/QrCameraPermissionRow": {
        QrCameraPermissionRow: "CameraPermissionRow",
      },
      "../checkin-call/AndroidCallAccessCard": {
        AndroidCallAccessCard: "AndroidCallAccessCard",
      },
      "./useDevicePermission": {
        useDevicePermission: () => ({
          permission,
          loading: false,
          pending: false,
          failed,
          refresh() {},
          change() {},
        }),
      },
    },
  );
  const nodes = (value) =>
    !value || typeof value !== "object"
      ? []
      : Array.isArray(value)
        ? value.flatMap(nodes)
        : [value, ...nodes(value.props?.children)];
  for (const state of [
    { granted: true },
    { granted: false },
    { granted: false, accessPrivileges: "limited" },
  ]) {
    permission = state;
    for (const row of nodes(ProfileDevicePermissions()).filter(
      (node) => typeof node.type === "function",
    )) {
      const rendered = nodes(row.type(row.props));
      assert.deepEqual(
        rendered
          .filter((node) => node.type === "Text")
          .map((node) => node.props.children),
        [row.props.labelKey],
      );
      const toggle = rendered.find((node) => node.type === "Switch");
      assert.equal(
        toggle.props.value,
        state.granted || state.accessPrivileges === "limited",
      );
    }
  }
  failed = true;
  permission = null;
  for (const row of nodes(ProfileDevicePermissions()).filter(
    (node) => typeof node.type === "function",
  )) {
    const rendered = nodes(row.type(row.props));
    assert.deepEqual(
      rendered
        .filter((node) => node.type === "Text")
        .map((node) => node.props.children),
      [row.props.labelKey, "devicePermissionUnavailable"],
    );
    assert.equal(
      rendered.some((node) => node.type === "Switch"),
      false,
    );
    assert.equal(rendered.filter((node) => node.type === "Button").length, 1);
  }
});

const { getCoinJourney } = evaluate("src/features/v21/coin-progress.ts", {});
function journeyData() {
  return {
    balance: 24,
    weeklyDays: 1,
    serverDate: "2026-11-03",
    tasks: [
      { task_code: "CHECKIN", coins: 10, done: 1, daily_limit: 1, weekly_limit: 0 },
      { task_code: "MED_ANSWER", coins: 5, done: 0, daily_limit: 4, weekly_limit: 0 },
      { task_code: "VITAL", coins: 5, done: 0, daily_limit: 2, weekly_limit: 0 },
      { task_code: "GIFT_OPEN", coins: 2, done: 1, daily_limit: 1, weekly_limit: 0 },
      { task_code: "WEEKLY", coins: 20, done: 0, daily_limit: 0, weekly_limit: 1 },
    ],
  };
}
await test("coin journey matches the reference: two completed tasks out of five is 40%", () => {
  const result = getCoinJourney(journeyData());
  assert.equal(result.percent, 40);
  assert.equal(result.completed, 2);
  assert.equal(result.tasks.length, 5);
  assert.deepEqual(
    result.tasks.map((task) => task.percent),
    [100, 0, 0, 100, 20],
  );
});
await test("weekly progress uses distinct check-in days instead of counting a bonus award as one day", () => {
  const data = journeyData();
  data.weeklyDays = 4;
  const task = getCoinJourney(data).tasks.at(-1);
  assert.equal(task.done, 4);
  assert.equal(task.target, 5);
  assert.equal(task.complete, false);
  data.weeklyDays = 5;
  assert.equal(getCoinJourney(data).tasks.at(-1).complete, true);
  data.weeklyDays = 0;
  data.tasks.at(-1).done = 1;
  assert.equal(getCoinJourney(data).tasks.at(-1).done, 0);
});
await test("coin journey uses server task limits and does not count a partial task as completed", () => {
  const data = journeyData();
  data.tasks[1].done = 2;
  const result = getCoinJourney(data);
  assert.equal(result.tasks[1].percent, 50);
  assert.equal(result.percent, 40);
  data.tasks[1].daily_limit = 2;
  assert.equal(getCoinJourney(data).percent, 60);
});
await test("coin progress cannot exceed its target or fall below zero", () => {
  const data = journeyData();
  data.tasks[0].done = 99;
  data.tasks[1].done = -5;
  data.weeklyDays = 99;
  const result = getCoinJourney(data);
  assert.equal(result.tasks[0].done, 1);
  assert.equal(result.tasks[1].done, 0);
  assert.equal(result.tasks.at(-1).done, 5);
  assert.ok(
    result.tasks.every((task) => task.percent >= 0 && task.percent <= 100),
  );
});
await test("disabled, unknown and unavailable coin tasks never create fake progress", () => {
  const data = journeyData();
  data.tasks[0].daily_limit = 0;
  data.tasks[1].daily_limit = Number.NaN;
  data.tasks.push({
    task_code: "INTERNAL_FUTURE_TASK",
    done: 9,
    daily_limit: 9,
  });
  const result = getCoinJourney(data);
  assert.equal(result.tasks.length, 3);
  assert.equal(result.completed, 1);
  assert.deepEqual(getCoinJourney({ ...data, tasks: [] }), {
    tasks: [],
    completed: 0,
    percent: 0,
  });
});
await test("100% is shown only after every available task is completed", () => {
  const data = journeyData();
  data.weeklyDays = 5;
  for (const task of data.tasks)
    task.done = task.task_code === "WEEKLY" ? 1 : task.daily_limit;
  assert.equal(getCoinJourney(data).percent, 100);
  data.tasks[2].done = 1;
  assert.equal(getCoinJourney(data).percent, 80);
});
const journeyNodes = (value) =>
  !value || typeof value !== "object"
    ? []
    : Array.isArray(value)
      ? value.flatMap(journeyNodes)
      : [value, ...journeyNodes(value.props?.children)];
for (const language of ["vi", "en"]) {
  for (const dimensions of [
    { width: 393, fontScale: 1 },
    { width: 320, fontScale: 1.5 },
  ]) {
    await test(`${language}/${dimensions.width}: the real coin view exposes actual task progress and opens coin details`, () => {
      const catalog = JSON.parse(
        fs.readFileSync(`src/i18n/locales/${language}/v21.json`, "utf8"),
      );
      const t = (key, args = {}) => {
        assert.equal(typeof catalog[key], "string", key);
        return catalog[key].replace(/\{\{(\w+)\}\}/g, (_, name) =>
          String(args[name] ?? ""),
        );
      };
      const { HealthCoinJourney } = evaluate(
        "src/features/v21/HealthCoinJourney.tsx",
        {
          "@expo/vector-icons": { MaterialCommunityIcons: "Icon" },
          "react-i18next": { useTranslation: () => ({ t }) },
          "react-native": {
            View: "View",
            Pressable: "Button",
            StyleSheet: { create: (styles) => styles, hairlineWidth: 0.5 },
            useWindowDimensions: () => dimensions,
          },
          "../../components/ScaledText": { ScaledText: "Text" },
          "../../hooks/useThemeColors": {
            useThemeColors: () => ({ isDark: false, colors: {} }),
          },
          "./CoinRulesMascot": { CoinRulesMascot: "CoinRulesMascot" },
          "./HealthCoinIcon": { HealthCoinIcon: "HealthCoinIcon" },
          "./coin-progress": { getCoinJourney },
        },
      );
      let opened = 0;
      const nodes = journeyNodes(
        HealthCoinJourney({
          data: journeyData(),
          onOpenDetails: () => opened++,
        }),
      );
      const progress = nodes.filter(
        (node) => node.props.accessibilityRole === "progressbar",
      );
      assert.equal(progress.length, 5);
      assert.equal(progress[0].props.accessibilityValue.now, 1);
      assert.equal(progress.at(-1).props.accessibilityValue.now, 1);
      assert.equal(progress.at(-1).props.accessibilityValue.max, 5);
      assert.ok(nodes.some((node) => node.props.children === t("balance", { count: 24 })));
      for (const count of [10, 5, 2, 20]) assert.ok(nodes.some((node) => node.props.children === t("taskCoins", { count })));
      const details = nodes.find(
        (node) => node.props.accessibilityRole === "button",
      );
      assert.equal(details.props.accessibilityLabel, t("rules"));
      details.props.onPress();
      assert.equal(opened, 1);
    });
  }
}

await test("granting notifications in-app immediately updates reminder access without a foreground event", async () => {
  const reminder = reminderHarness();
  const device = devicePermissionHarness("notifications");
  await reminder.settle();
  await device.settle();
  assert.equal(reminder.read().props.disabled, true);
  reminder.server.allowed = true;
  await device.read().change(true);
  await reminder.settle();
  assert.equal(reminder.read().props.disabled, false);
  reminder.server.allowed = false;
  device.server.settingsResult = { granted: false, canAskAgain: false };
  await device.read().change(false);
  await reminder.settle();
  assert.equal(reminder.read().props.disabled, true);
  reminder.blur();
  device.blur();
  const reads = reminder.calls.reads;
  permissionEvents.notifyNotificationPermissionChanged();
  await flush();
  assert.equal(reminder.calls.reads, reads);
});

function coinDetailsHarness() {
  const r = runtime();
  const auth = { profile: { id: "alice" } };
  const storage = new Map();
  const calls = { redeems: [], toasts: [], errors: [], history: [] };
  const reward = { code: "GREETING_CARD", cost: 50, daily_limit: 1, monthly_limit: 0 };
  const server = { balance: 100, pendingCoins: null, pendingRedeem: null, pendingStorage: null, failRedeem: false, pages: { "": [] } };
  const t = key => key;
  const useAuthStore = Object.assign(select => select(auth), { getState: () => auth });
  const data = () => ({ ...journeyData(), balance: server.balance });
  const { useHealthCoins } = evaluate("src/features/v21/useHealthCoins.ts", {
    react: r.hooks,
    "expo-router": r.router,
    "../../hooks/useGuardedRouter": { useGuardedRouter: () => ({ push() {} }) },
    "react-i18next": { useTranslation: () => ({ t }) },
    "@react-native-async-storage/async-storage": { __esModule: true, default: {
      getItem: async key => server.pendingStorage ? await server.pendingStorage : storage.get(key) ?? null,
      setItem: async (key, value) => storage.set(key, value), removeItem: async key => storage.delete(key),
    } },
    "expo-crypto": { randomUUID: () => "fixture-request-" + calls.redeems.length },
    "../auth/auth.store": { useAuthStore },
    "../../stores/toast.store": { useToastStore: { getState: () => ({ show: (...args) => calls.toasts.push(args) }) } },
    "./V21Layout": { v21Error: error => calls.errors.push(error) },
    "./v21.api": { v21Api: {
      coins: async () => server.pendingCoins ?? data(),
      rewards: async () => ({ items: [reward], recipients: [{ id: 7, name: "Fixture recipient" }], templates: [{ code: "fixture-card", title: "Fixture card", title_en: "Fixture card" }] }),
      history: async before => { calls.history.push(before || ""); return { items: server.pages[before || ""] ?? [] }; },
      redeem: async (code, id, payload) => {
        calls.redeems.push({ code, id, payload });
        if (server.pendingRedeem) await server.pendingRedeem;
        if (server.failRedeem) throw new Error("Fixture network failure");
        server.balance -= reward.cost;
        return {};
      },
    } },
  });
  return { ...r, auth, server, calls, storage, reward, data,
    read: () => r.render(useHealthCoins), settle: () => r.settle(useHealthCoins),
    prepare: () => { r.render(useHealthCoins).selectReward(reward); r.render(useHealthCoins).selectRecipient(7); r.render(useHealthCoins).selectTemplate("fixture-card"); },
  };
}
await test("coin details load backend values and require a recipient and template before redemption", async () => {
  const h = coinDetailsHarness(); await h.settle();
  assert.equal(h.read().data.balance, 100);
  h.read().selectReward(h.reward);
  await h.read().redeem();
  assert.equal(h.calls.redeems.length, 0);
  h.read().selectRecipient(7);
  await h.read().redeem();
  assert.equal(h.calls.redeems.length, 0);
  h.blur();
});
await test("duplicate reward confirmation submits once and refreshes confirmed backend data", async () => {
  const h = coinDetailsHarness(); await h.settle(); h.prepare(); let finish;
  h.server.pendingRedeem = new Promise(resolve => { finish = resolve; });
  const first = h.read().redeem(); const second = h.read().redeem(); await flush();
  assert.equal(h.calls.redeems.length, 1); assert.equal(h.read().busy, true);
  finish(); await Promise.all([first, second]); await flush();
  assert.equal(h.read().data.balance, 50); assert.equal(h.read().selected, null);
  assert.equal(h.read().busy, false); assert.equal(h.storage.size, 0); assert.equal(h.calls.toasts.length, 1); h.blur();
});
await test("an interrupted redemption reuses its request ID when retried", async () => {
  const h = coinDetailsHarness(); await h.settle(); h.prepare(); h.server.failRedeem = true;
  await h.read().redeem();
  assert.equal(h.read().data.balance, 100); assert.equal(h.calls.toasts.length, 0);
  assert.equal(h.storage.size, 1); assert.equal(h.read().busy, false);
  h.server.failRedeem = false;
  await h.read().redeem();
  assert.equal(h.calls.redeems.length, 2); assert.equal(h.calls.redeems[0].id, h.calls.redeems[1].id);
  assert.deepEqual(h.calls.redeems[1].payload, { recipientId: 7, templateCode: "fixture-card" }); h.blur();
});
await test("insufficient coins cannot submit a reward even through a stale handler", async () => {
  const h = coinDetailsHarness(); h.server.balance = 12; await h.settle(); h.prepare();
  await h.read().redeem(); assert.equal(h.calls.redeems.length, 0); assert.equal(h.storage.size, 0); h.blur();
});
await test("a late coin response cannot expose the previous account's balance or rewards", async () => {
  const h = coinDetailsHarness(); await h.settle(); let finish;
  h.server.pendingCoins = new Promise(resolve => { finish = resolve; });
  const pending = h.read().refresh(); await flush();
  h.auth.profile.id = "bob"; assert.equal(h.read().data, null); assert.equal(h.read().catalog, null);
  h.server.pendingCoins = null; h.server.balance = 200; await h.settle();
  finish({ ...h.data(), balance: 999 }); await pending; await flush();
  assert.equal(h.read().data.balance, 200); assert.equal(h.read().selected, null); h.blur();
});
await test("leaving the coin screen before request preparation prevents a redemption API call", async () => {
  const h = coinDetailsHarness(); await h.settle(); h.prepare(); let finish;
  h.server.pendingStorage = new Promise(resolve => { finish = resolve; });
  const pending = h.read().redeem(); await flush(); h.blur(); finish(null); await pending;
  assert.equal(h.calls.redeems.length, 0); assert.equal(h.storage.size, 0);
});

await test("coin history loads the next cursor once, removes duplicate entries and stops at the last page", async () => {
  const h = coinDetailsHarness();
  h.server.pages[""] = Array.from({ length: 30 }, (_, index) => entry(60 - index, 2));
  h.server.pages["31"] = [entry(31, 2), entry(30, 2)];
  await h.settle(); assert.equal(h.read().hasMore, true);
  await h.read().more();
  assert.deepEqual(h.calls.history, ["", "31"]);
  assert.equal(h.read().history.length, 31); assert.equal(h.read().hasMore, false);
  await h.read().more(); assert.equal(h.calls.history.length, 2); h.blur();
});

await test("withdrawing task reminders immediately locks reminder times without leaving Profile", async () => {
  const h = reminderHarness(); h.server.allowed = true; await h.settle();
  h.server.remindersEnabled = false; permissionEvents.notifyTaskReminderPreferenceChanged(); await h.settle();
  assert.equal(h.read().props.disabled, true); h.blur();
});
await test("task reminder consent is checked again before opening reminder times", async () => {
  const h = reminderHarness(); h.server.allowed = true; await h.settle();
  h.server.remindersEnabled = false; h.read().props.onPress(); await h.settle();
  assert.deepEqual(h.calls.routes, []); assert.equal(h.read().props.disabled, true); h.blur();
});
await test("an older reminder preference result cannot undo a newer withdrawal", async () => {
  const h = reminderHarness(); h.server.allowed = true; await h.settle(); let finish;
  h.server.pendingPrefs = new Promise(resolve => { finish = resolve; }); h.foreground(); await flush();
  h.server.pendingPrefs = null; h.server.remindersEnabled = false; permissionEvents.notifyTaskReminderPreferenceChanged(); await h.settle();
  finish({ ok: true, reminders_enabled: true }); await flush();
  assert.equal(h.read().props.disabled, true); h.blur();
});

await test("the real card reward view allows a free preview with insufficient coins but keeps redemption disabled", () => {
  const r = runtime();
  const recipient = { id: 7, name: "Fixture family" };
  const template = { code: "MISS_YOU", title: "Fixture card", title_en: "Fixture card", body: "Fixture greeting" };
  const reward = { code: "GREETING_CARD", cost: 50 };
  const coins = {
    busy: false, selected: null, recipient: recipient.id, template: template.code,
    data: { balance: 12 }, catalog: { items: [reward], recipients: [recipient], templates: [template] },
    selectReward: item => { coins.selected = item; }, cancelReward() {},
  };
  const { CoinSpendTab } = evaluate("src/features/v21/CoinDetailsContent.tsx", {
    react: r.hooks,
    "@expo/vector-icons": { Ionicons: "Icon", MaterialCommunityIcons: "Icon" },
    "react-native": { ActivityIndicator: "Spinner", Pressable: "Pressable", View: "View", useWindowDimensions: () => ({ width: 393 }) },
    "react-i18next": { useTranslation: () => ({ t: key => key, i18n: { language: "vi" } }) },
    "../../components/ScaledText": { ScaledText: "Text" },
    "../../hooks/useThemeColors": { useThemeColors: () => ({ colors: {} }) },
    "../../hooks/useScaledTypography": { useScaledFontSize: n => n },
    "./HealthCoinIcon": { HealthCoinIcon: "Coin" },
    "./coin-details.styles": { coinDetailsStyles: {} },
    "./GreetingCard": { GreetingCard: "GreetingCard" },
  });
  const preview = journeyNodes(r.render(() => CoinSpendTab({ coins }))).find(node => node.props?.label === "greetingPreview");
  assert.equal(preview.props.disabled, false); preview.props.onPress();
  const selection = r.render(() => CoinSpendTab({ coins }));
  const readSelection = () => r.render(() => selection.type(selection.props));
  const review = journeyNodes(readSelection()).find(node => node.props?.label === "coinsReviewAction");
  assert.equal(review.props.disabled, false); review.props.onPress();
  const nodes = journeyNodes(readSelection());
  assert.equal(nodes.find(node => node.type === "GreetingCard").props.template, template);
  assert.equal(nodes.find(node => node.props?.label === "redeem").props.disabled, true);
  coins.data.balance = 50;
  assert.equal(journeyNodes(readSelection()).find(node => node.props?.label === "redeem").props.disabled, false);
});

function greetingHarness() {
  const r = runtime();
  const auth = { profile: { id: "recipient" } };
  const session = { token: "session-a" };
  const params = { cardId: "11111111-2222-4333-8444-555555555555" };
  const server = { pending: null, fail: false };
  const calls = [];
  const useAuthStore = Object.assign(select => select(auth), { getState: () => auth });
  const { default: Screen } = evaluate("app/coins/card/[cardId].tsx", {
    react: r.hooks,
    "expo-router": { ...r.router, useLocalSearchParams: () => params },
    "react-i18next": { useTranslation: () => ({ t: key => key }) },
    "react-native": { ActivityIndicator: "ActivityIndicator" },
    "../../../src/features/v21/GreetingCard": { GreetingCard: "GreetingCard" },
    "../../../src/features/v21/V21Layout": { V21Layout: "Layout", Note: "Note", Action: "Action" },
    "../../../src/features/auth/auth.store": { useAuthStore },
    "../../../src/lib/tokenStore": { tokenStore: { getToken: () => session.token } },
    "../../../src/hooks/useThemeColors": { useThemeColors: () => ({ colors: {} }) },
    "../../../src/features/v21/v21.api": { v21Api: { openCard: async id => {
      calls.push(id);
      if (server.pending) return server.pending;
      if (server.fail) throw new Error("fixture offline");
      return { card: { id, template: { code: "MISS_YOU" }, senderName: "Fixture sender", status: "DELIVERED", isRecipient: true } };
    } } },
  });
  return { ...r, auth, params, server, session, calls,
    read: () => r.render(Screen), settle: () => r.settle(Screen),
    cards: () => journeyNodes(r.render(Screen)).filter(node => node.type === "GreetingCard"),
  };
}
await test("the received card screen loads the selected redemption and displays its saved template", async () => {
  const h = greetingHarness(); await h.settle();
  assert.deepEqual(h.calls, [h.params.cardId]);
  assert.equal(h.cards()[0].props.senderName, "Fixture sender");
  assert.equal(h.cards()[0].props.template.code, "MISS_YOU"); h.blur();
});
await test("an invalid card link does not make a request and offers retry", async () => {
  const h = greetingHarness(); h.params.cardId = "invalid"; await h.settle();
  assert.equal(h.calls.length, 0); assert.equal(h.cards().length, 0);
  assert.ok(journeyNodes(h.read()).some(node => node.type === "Action")); h.blur();
});
await test("retrying a failed card read recovers without leaving the screen", async () => {
  const h = greetingHarness(); h.server.fail = true; await h.settle();
  assert.equal(h.cards().length, 0); h.server.fail = false;
  journeyNodes(h.read()).find(node => node.type === "Action").props.onPress(); await flush();
  assert.equal(h.cards().length, 1); h.blur();
});
for (const event of ["account", "token", "blur"]) {
  await test(`${event}: a late card response cannot expose another session's family message`, async () => {
    const h = greetingHarness(); let finish;
    h.server.pending = new Promise(resolve => { finish = resolve; }); await h.settle();
    if (event === "account") h.auth.profile.id = "outsider";
    else if (event === "token") h.session.token = "session-b";
    else h.blur();
    finish({ card: { template: { code: "PRIVATE_FIXTURE" }, senderName: "Private fixture" } });
    await flush(); assert.equal(h.cards().length, 0); h.blur();
  });
}

function taskReminderHarness() {
  const r = runtime();
  const auth = { token: "session-a" };
  const listeners = new Set();
  const calls = { writes: [], nativeRequests: 0, toasts: [] };
  const server = { allowed: false, reminders: false, deny: false, readError: false, writeError: false, savedOverride: null, pendingWrite: null, pendingNative: null };
  const native = {
    permission: { granted: false }, loading: false, pending: false, failed: false,
    refresh: async () => {},
    change: async () => {
      if (server.pendingNative) await server.pendingNative;
      if (!server.allowed) calls.nativeRequests++;
      if (!server.deny) { server.allowed = true; native.permission.granted = true; }
    },
  };
  const useAuthStore = Object.assign(select => select(auth), { getState: () => auth });
  const { useTaskReminderPreference } = evaluate("src/features/profile/useTaskReminderPreference.ts", {
    react: r.hooks, "expo-router": r.router,
    "react-native": { AppState: { addEventListener: (_, callback) => { listeners.add(callback); return { remove: () => listeners.delete(callback) }; } } },
    "react-i18next": { useTranslation: () => ({ t: key => key }) },
    "../auth/auth.store": { useAuthStore },
    "./useDevicePermission": { useDevicePermission: () => native },
    "../../lib/notifications": { checkNotificationPermission: async () => server.allowed },
    "../../lib/device-permission-events": permissionEvents,
    "../../stores/toast.store": { showToast: (...args) => calls.toasts.push(args) },
    "../notifications/notifications.api": {
      getNotificationPreferences: async () => {
        if (server.readError) throw new Error("Fixture read failure");
        return { ok: true, reminders_enabled: server.reminders };
      },
      updateNotificationPreferences: async prefs => {
        calls.writes.push(prefs);
        if (server.pendingWrite) await server.pendingWrite;
        if (server.writeError) throw new Error("Fixture write failure");
        server.reminders = server.savedOverride ?? prefs.reminders_enabled;
        permissionEvents.notifyTaskReminderPreferenceChanged();
        return { ok: true, reminders_enabled: server.reminders };
      },
    },
  });
  return { ...r, auth, server, calls, native,
    read: () => r.render(useTaskReminderPreference), settle: () => r.settle(useTaskReminderPreference),
  };
}
await test("opening task reminder permissions never requests notification consent or enables delivery", async () => {
  const h = taskReminderHarness(); await h.settle();
  assert.equal(h.read().enabled, false); assert.equal(h.calls.nativeRequests, 0); assert.deepEqual(h.calls.writes, []); h.blur();
});
await test("enabling task reminders requires native consent and a confirmed backend preference", async () => {
  const h = taskReminderHarness(); await h.settle(); await h.read().change(true); await h.settle();
  assert.equal(h.calls.nativeRequests, 1); assert.deepEqual(h.calls.writes, [{ reminders_enabled: true }]);
  assert.equal(h.read().enabled, true); assert.equal(h.read().pending, false); h.blur();
});
await test("denying notification consent cannot enable task reminders on the backend", async () => {
  const h = taskReminderHarness(); h.server.deny = true; await h.settle(); await h.read().change(true);
  assert.equal(h.read().enabled, false); assert.deepEqual(h.calls.writes, []); assert.equal(h.read().pending, false); h.blur();
});
await test("turning off task reminders keeps other notification permissions granted", async () => {
  const h = taskReminderHarness(); h.server.allowed = true; h.server.reminders = true; h.native.permission.granted = true;
  await h.settle(); await h.read().change(false);
  assert.equal(h.read().enabled, false); assert.equal(h.server.allowed, true); assert.equal(h.calls.nativeRequests, 0);
  assert.deepEqual(h.calls.writes, [{ reminders_enabled: false }]); h.blur();
});
await test("a backend rejection or failed save never displays a false reminder permission", async () => {
  const h = taskReminderHarness(); h.server.savedOverride = false; await h.settle(); await h.read().change(true);
  assert.equal(h.read().enabled, false);
  h.server.savedOverride = null; h.server.writeError = true; await h.read().change(true);
  assert.equal(h.read().enabled, false); assert.equal(h.read().pending, false); assert.equal(h.calls.toasts.length, 1); h.blur();
});
await test("duplicate task reminder toggles write once and wait for server confirmation", async () => {
  const h = taskReminderHarness(); await h.settle(); let finish;
  h.server.pendingWrite = new Promise(resolve => { finish = resolve; });
  const first = h.read().change(true); const second = h.read().change(true); await flush();
  assert.equal(h.calls.writes.length, 1); assert.equal(h.read().enabled, false); assert.equal(h.read().pending, true);
  finish(); await Promise.all([first, second]); assert.equal(h.read().enabled, true); h.blur();
});
await test("unavailable task reminder preferences stay disabled and can be read again", async () => {
  const h = taskReminderHarness(); h.server.readError = true; await h.settle();
  assert.equal(h.read().available, false); assert.equal(h.read().failed, true);
  await h.read().change(true); assert.deepEqual(h.calls.writes, []);
  h.server.readError = false; h.read().refresh(); await h.settle(); assert.equal(h.read().failed, false); assert.equal(h.read().available, true); h.blur();
});
for (const leave of ["blur", "account"]) {
  await test(`${leave}: task reminder consent cannot be saved for a session that left during the native prompt`, async () => {
    const h = taskReminderHarness(); await h.settle(); let finish;
    h.server.pendingNative = new Promise(resolve => { finish = resolve; });
    const pending = h.read().change(true); await flush();
    if (leave === "blur") h.blur(); else h.auth.token = "session-b";
    finish(); await pending; assert.deepEqual(h.calls.writes, []); h.blur();
  });
}

// Execute the real screen effects with only their native/UI surroundings removed.
// This lets request counts and cleanup be tested without duplicating their logic.
function screenLifecycle(file, select, globals, setup = '', returns = '{}') {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = source.statements.find(node => ts.isFunctionDeclaration(node)
    && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword));
  assert.ok(component?.body, `Missing screen component in ${file}`);
  const statements = component.body.statements.filter(node => select(node.getText(source), node)).map(node => node.getText(source));
  assert.ok(statements.length, `No lifecycle selected in ${file}`);
  return evaluate(file, {}, globals, `export function run() { ${setup}\n${statements.join('\n')}\nreturn ${returns}; }`).run;
}
function controlledApp() {
  let id = 0;
  const timers = new Map();
  const listeners = new Set();
  const AppState = { currentState: 'active', addEventListener(_event, listener) {
    listeners.add(listener); return { remove: () => listeners.delete(listener) };
  } };
  return {
    AppState, timers,
    setInterval(fn, ms) { const key = ++id; timers.set(key, { fn, ms }); return key; },
    clearInterval(key) { timers.delete(key); },
    tick(ms) { for (const { fn, ms: delay } of [...timers.values()]) if (delay === ms) fn(); },
    state(value) { AppState.currentState = value; for (const fn of listeners) fn(value); },
  };
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

await test('profile focus and mount together request subscription status exactly once', async () => {
  const r = runtime(); const calls = []; let clock = 10000;
  const run = screenLifecycle('app/(tabs)/profile/index.tsx', text =>
    /^use(?:Focus)?Effect\(/.test(text) && text.includes('/api/subscriptions/status'), {
    ...r.hooks, ...r.router, Date: { now: () => clock }, lastFetchRef: { current: 0 },
    profileReadyRef: { current: false }, setProfileReady() {}, setSubStatus() {},
    fetchLogs: async () => { calls.push('unused-logs'); }, fetchMissions: async () => { calls.push('unused-missions'); },
    apiClient: async path => { calls.push(path); return {}; },
    authApi: { fetchProfile: async () => null }, useAuthStore: { setState() {} },
  });
  await r.settle(run); await r.settle(run);
  assert.deepEqual(calls, ['/api/subscriptions/status']);
  r.blur(); clock += 4000; r.focus(); await flush();
  assert.equal(calls.length, 2, 'returning to profile still refreshes plan expiry'); r.blur();
});

await test('missions mount and focus share one load, and loading status does not cancel it', async () => {
  const r = runtime(); const signals = [];
  const store = { missions: [], status: 'idle', isStale: false, errorState: 'none',
    fetchMissions: async signal => { signals.push(signal); store.status = 'loading'; } };
  const { useMissionActions } = evaluate('src/features/missions/useMissionActions.ts', {
    react: r.hooks, './missions.store': { useMissionsStore: select => select(store) },
  });
  const run = screenLifecycle('app/(tabs)/missions/index.tsx', text =>
    text.startsWith('useFocusEffect(') && text.includes('fetchMissions'), {
    ...r.hooks, ...r.router, useMissionActions, lastFetchRef: { current: 0 },
  }, 'const { fetchMissions } = useMissionActions();');
  await r.settle(run); await r.settle(run);
  assert.equal(signals.length, 1); assert.equal(signals[0].aborted, false);
  r.blur(); assert.equal(signals[0].aborted, true);
});

await test('log refresh survives idle-to-loading rerenders and refreshes after returning from log entry', async () => {
  const r = runtime(); const signals = [];
  const store = { status: 'idle', fetchLogs: async signal => { signals.push(signal); store.status = 'loading'; } };
  const run = screenLifecycle('app/logs/index.tsx', text =>
    /^use(?:Focus)?Effect\(/.test(text) && text.includes('fetchLogs'), {
    ...r.hooks, ...r.router, store,
  }, 'const { status, fetchLogs } = store;');
  await r.settle(run); await r.settle(run);
  assert.equal(signals.length, 1); assert.equal(signals[0].aborted, false);
  r.blur(); assert.equal(signals[0].aborted, true);
  r.focus(); await flush(); assert.equal(signals.length, 2); r.blur();
});

function homePollingHarness() {
  const r = runtime(); const app = controlledApp(); let calls = 0;
  const auth = { profile: { id: 'alice' }, token: 'alice-session' };
  const run = screenLifecycle('app/(tabs)/home/index.tsx', text =>
    /^use(?:Focus)?Effect\(/.test(text) && text.includes('AppState.addEventListener'), {
    ...r.hooks, ...r.router, ...app, auth, fetchFromBackend: async () => { calls++; },
  }, 'const profile = auth.profile; const profileId = profile?.id; const sessionToken = auth.token;');
  return { ...r, app, auth, run, calls: () => calls };
}
await test('home notification polling pauses offscreen and in background, then refreshes on foreground', async () => {
  const h = homePollingHarness(); await h.settle(h.run); assert.equal(h.calls(), 1);
  h.app.tick(30000); assert.equal(h.calls(), 2);
  h.app.state('background'); h.app.tick(30000); assert.equal(h.calls(), 2);
  h.app.state('active'); assert.equal(h.calls(), 3);
  h.blur(); h.app.tick(30000); h.app.state('active'); assert.equal(h.calls(), 3);
  assert.equal(h.app.timers.size, 0); h.focus(); assert.equal(h.calls(), 4); h.blur();
});
await test('a profile object refresh does not restart home notification requests', async () => {
  const h = homePollingHarness(); await h.settle(h.run);
  h.auth.profile = { ...h.auth.profile, name: 'updated' }; await h.settle(h.run);
  assert.equal(h.calls(), 1); h.auth.token = 'renewed-session'; await h.settle(h.run);
  assert.equal(h.calls(), 2); h.blur();
});
await test('opening notifications leaves its screen as the sole owner of the first read', () => {
  let reads = 0; const routes = [];
  const run = screenLifecycle('app/(tabs)/home/index.tsx', text => text.startsWith('const handleOpenNotifications ='), {
    useCallback: fn => fn, fetchFromBackend: () => { reads++; }, router: { push: path => routes.push(path) },
  }, '', 'handleOpenNotifications');
  run()(); assert.deepEqual(routes, ['/notifications']); assert.equal(reads, 0);
});

await test('home feed depends on account identity and ignores a late response from another session', async () => {
  const r = runtime(); const auth = { profile: { id: 'alice' }, token: 'alice-session' };
  const waiting = deferred(); const items = []; let reads = 0;
  const run = screenLifecycle('app/(tabs)/home/index.tsx', text => text.startsWith('const refreshHealthFeed ='), {
    ...r.hooks, auth, useAuthStore: { getState: () => auth }, getHealthFeedPreference: async () => true,
    healthFeedApi: async () => { reads++; return waiting.promise; },
    setHealthFeedVisible() {}, setHealthFeedEnabled() {}, setHealthFeedItems: value => items.push(value),
  }, 'const profile = auth.profile; const profileId = profile?.id; const sessionToken = auth.token;', 'refreshHealthFeed');
  const first = r.render(run); const pending = first(); await flush();
  auth.profile = { ...auth.profile, name: 'new name' }; assert.equal(r.render(run), first);
  assert.equal(reads, 1); auth.token = 'bob-session'; auth.profile = { id: 'bob' };
  waiting.resolve({ ok: true, enabled: true, feed: ['private-alice'] }); await pending;
  assert.deepEqual(items, []); r.blur();
});

function preferenceApiHarness() {
  const calls = []; const pending = []; let token = 'alice-session'; let listener = () => {};
  const api = evaluate('src/features/notifications/notifications.api.ts', {
    '../../lib/apiClient': { apiClient: (path, options) => {
      const waiting = deferred(); calls.push({ path, method: options?.method ?? 'GET' }); pending.push(waiting); return waiting.promise;
    } },
    '../../lib/tokenStore': { tokenStore: { getToken: () => token } },
    '../../lib/device-permission-events': { notifyTaskReminderPreferenceChanged: () => listener() },
  });
  return { api, calls, pending, setToken: value => { token = value; }, onSave: fn => { listener = fn; } };
}
await test('home feed realtime updates unsubscribe on blur and load fresh data on return', async () => {
  const r = runtime(); const listeners = new Set(); let reads = 0;
  const run = screenLifecycle('app/(tabs)/home/index.tsx', text =>
    /^use(?:Focus)?Effect\(/.test(text) && (text.includes('subscribeRealtimeRefresh') || text.includes('refreshHealthFeed().catch')), {
    ...r.hooks, ...r.router, refreshHealthFeed: async () => { reads++; },
    subscribeRealtimeRefresh: (_topic, fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  });
  await r.settle(run); assert.equal(reads, 1);
  listeners.forEach(fn => fn()); await flush(); assert.equal(reads, 2);
  r.blur(); listeners.forEach(fn => fn()); await flush(); assert.equal(reads, 2);
  assert.equal(listeners.size, 0); r.focus(); await flush(); assert.equal(reads, 3); r.blur();
});
await test('permission rows share a simultaneous read without retaining a completed consent response', async () => {
  const h = preferenceApiHarness(); const reads = Array.from({ length: 3 }, () => h.api.getNotificationPreferences());
  assert.equal(h.calls.length, 1); h.pending[0].resolve({ ok: true, reminders_enabled: false });
  assert.ok((await Promise.all(reads)).every(value => value.reminders_enabled === false));
  const fresh = h.api.getNotificationPreferences(); assert.equal(h.calls.length, 2);
  h.pending[1].resolve({ ok: true, reminders_enabled: true }); assert.equal((await fresh).reminders_enabled, true);
});
await test('a failed preference read can retry and is never shared with a different session', async () => {
  const h = preferenceApiHarness(); const first = h.api.getNotificationPreferences();
  h.setToken('bob-session'); const second = h.api.getNotificationPreferences(); assert.equal(h.calls.length, 2);
  h.pending[0].resolve({ ok: true, reminders_enabled: true }); await first;
  const shared = h.api.getNotificationPreferences(); assert.equal(h.calls.length, 2, 'old finally cannot evict the new request');
  const failed = Promise.allSettled([second, shared]); h.pending[1].reject(new Error('offline'));
  assert.ok((await failed).every(result => result.status === 'rejected'));
  const retry = h.api.getNotificationPreferences(); assert.equal(h.calls.length, 3);
  h.pending[2].resolve({ ok: true }); await retry;
});
await test('saving preferences invalidates reads both before the write and before change listeners refresh', async () => {
  const h = preferenceApiHarness(); const before = h.api.getNotificationPreferences();
  const saved = h.api.updateNotificationPreferences({ reminders_enabled: true });
  const during = h.api.getNotificationPreferences(); let after;
  assert.equal(h.calls.length, 3); h.onSave(() => { after = h.api.getNotificationPreferences(); });
  h.pending[1].resolve({ ok: true, reminders_enabled: true }); await saved;
  assert.equal(h.calls.length, 4); h.pending[3].resolve({ ok: true, reminders_enabled: true });
  assert.equal((await after).reminders_enabled, true);
  h.pending[0].resolve({ ok: true, reminders_enabled: false }); h.pending[2].resolve({ ok: true, reminders_enabled: false });
  await Promise.all([before, during]);
});

function homeTasksHarness() {
  const r = runtime(); const app = controlledApp(); const actions = new Set();
  const auth = { profile: { id: 'alice' }, token: 'alice-session' };
  const server = { pending: null, error: null, flags: { coins: true, patients: [] }, done: 0 };
  const calls = { flags: 0, coins: 0 }; class ApiError extends Error { constructor(code) { super('API error'); this.statusCode = code; } }
  const { V21HomeCard } = evaluate('src/features/v21/V21HomeCard.tsx', {
    react: r.hooks, 'expo-router': r.router, 'react-native': { ...app, Pressable: 'Pressable', View: 'View' },
    '../../hooks/useGuardedRouter': { useGuardedRouter: () => ({ push() {} }) },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    'react-i18next': { useTranslation: () => ({ t: (key, values) => `${key}:${values?.done ?? ''}` }) },
    '../../components/ScaledText': { ScaledText: 'Text' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: {} }) },
    '../auth/auth.store': { useAuthStore: select => select(auth) },
    '../../lib/health-action-events': { subscribeHealthAction: fn => { actions.add(fn); return () => actions.delete(fn); } },
    '../../lib/apiClient': { ApiError },
    './v21.api': { v21Api: {
      flags: async () => { calls.flags++; if (server.error) throw server.error; return server.pending ?? server.flags; },
      coins: async () => { calls.coins++; return { tasks: [{ task_code: 'CHECKIN', daily_limit: 1, done: server.done }] }; },
    } },
  }, { setInterval: app.setInterval, clearInterval: app.clearInterval });
  const read = () => V21HomeCard();
  return { ...r, app, auth, server, calls, ApiError, read, action: () => actions.forEach(fn => fn()), settle: () => r.settle(read) };
}
await test('home tasks poll only while visible and active, without refetching when translation rerenders', async () => {
  const h = homeTasksHarness(); await h.settle(); await h.settle(); assert.equal(h.calls.flags, 1);
  h.app.state('background'); h.app.tick(15000); await flush(); assert.equal(h.calls.flags, 1);
  h.app.state('active'); await flush(); assert.equal(h.calls.flags, 2);
  h.blur(); h.action(); h.app.tick(15000); h.app.state('active'); await flush();
  assert.equal(h.calls.flags, 2); assert.equal(h.app.timers.size, 0);
});
await test('home tasks merge overlapping polls but queue a fresh read after a health action', async () => {
  const h = homeTasksHarness(); const waiting = deferred(); h.server.pending = waiting.promise;
  await h.settle(); h.app.tick(15000); h.app.tick(15000); h.action(); h.action(); await flush();
  assert.equal(h.calls.flags, 1); h.server.pending = null; h.server.done = 1; waiting.resolve(h.server.flags); await flush();
  assert.equal(h.calls.flags, 2); assert.equal(h.calls.coins, 2);
  assert.ok(JSON.stringify(h.render(h.read)).includes('taskProgress:1')); h.blur();
});
await test('home task icons survive a temporary failure but hide on access revocation or a server flag', async () => {
  const h = homeTasksHarness(); await h.settle(); assert.notEqual(h.render(h.read), null);
  h.server.error = new Error('offline'); h.app.tick(15000); await flush(); assert.notEqual(h.render(h.read), null);
  h.server.error = new h.ApiError(403); h.app.tick(15000); await flush(); assert.equal(h.render(h.read), null);
  h.server.error = null; h.server.flags = { coins: false, patients: [] }; h.app.tick(15000); await flush();
  assert.equal(h.render(h.read), null); h.blur();
});
await test('a home task response arriving after blur cannot show a previous session', async () => {
  const h = homeTasksHarness(); const waiting = deferred(); h.server.pending = waiting.promise;
  await h.settle(); h.blur(); h.auth.profile = { id: 'bob' }; h.auth.token = 'bob-session';
  waiting.resolve(h.server.flags); await flush(); assert.equal(h.render(h.read), null);
  assert.equal(h.calls.coins, 0);
});
await test('home tasks do not start the next API request when backgrounded during a flag read', async () => {
  const h = homeTasksHarness(); const waiting = deferred(); h.server.pending = waiting.promise;
  await h.settle(); h.app.state('background'); waiting.resolve(h.server.flags); await flush();
  assert.equal(h.calls.coins, 0); h.server.pending = null;
  h.app.state('active'); await flush(); assert.equal(h.calls.coins, 1); h.blur();
});

await test('opening the currently polled wallet QR reuses its refresh; another order starts its own', () => {
  const r = runtime(); const state = { qr: { order_code: 'current' }, pollStatus: 'polling' };
  const polled = []; const selected = []; const cleared = [];
  const run = screenLifecycle('app/wallet/index.tsx', text => text.startsWith('const handleOpenPendingPayment ='), {
    ...r.hooks, state, getPaymentDisplayStatus: payment => payment.status,
    setHistoryNowMs() {}, setSelectedPayment: payment => selected.push(payment),
    startModalPolling: code => polled.push(code), modalPollRef: { current: 11 }, clearInterval: id => cleared.push(id),
  }, 'const { qr, pollStatus } = state;', 'handleOpenPendingPayment');
  r.render(run)({ order_code: 'current', status: 'pending' }); assert.deepEqual(polled, []);
  r.render(run)({ order_code: 'older', status: 'pending' }); assert.deepEqual(polled, ['older']);
  state.pollStatus = 'idle'; r.render(run)({ order_code: 'current', status: 'pending' });
  assert.deepEqual(polled, ['older', 'current']); assert.equal(selected.length, 3);
  r.render(run)({ order_code: 'expired', status: 'expired' }); assert.equal(selected.length, 3);
  assert.deepEqual(cleared, [11, 11, 11]);
});
await test('wallet has no fabricated initial balance and retains the last confirmed balance on refresh failure', async () => {
  const r = runtime(); let waiting = deferred();
  const run = screenLifecycle('app/wallet/index.tsx', text => /^(const \[balance,|const \[loadingBalance,|const fetchBalance =)/.test(text), {
    ...r.hooks, apiClient: () => waiting.promise,
  }, '', '{ balance, loadingBalance, fetchBalance }');
  assert.equal(r.render(run).balance, null); assert.equal(r.render(run).loadingBalance, true);
  let pending = r.render(run).fetchBalance(); waiting.resolve({ ok: true, balance: '12' }); await pending;
  assert.equal(r.render(run).balance, '12'); assert.equal(r.render(run).loadingBalance, false);
  waiting = deferred(); pending = r.render(run).fetchBalance(); waiting.reject(new Error('offline')); await pending;
  assert.equal(r.render(run).balance, '12');
});

function inboxHarness() {
  const r = runtime();
  const theme = evaluate("src/styles/theme.ts", {});
  const backListeners = new Set();
  const native = {
    page: { x: 12, y: 24, width: 393, height: 800 },
    header: { x: 340, y: 82, width: 44, height: 44 },
    item: { x: 340, y: 320, width: 44, height: 44 },
    defer: false,
    pending: [],
  };
  const host = (kind) => ({
    measureInWindow(callback) {
      const finish = () => {
        const { x, y, width, height } = native[kind];
        callback(x, y, width, height);
      };
      if (native.defer) native.pending.push(finish);
      else finish();
    },
  });
  const calls = {
    reads: 0,
    marked: [],
    routes: [],
    all: 0,
    removed: [],
    alerts: [],
    clear: 0,
    pages: [],
  };
  const store = {
    notifications: [
      {
        id: "checkin",
        type: "morning_checkin",
        title: "Check-in reminder",
        body: "Full reminder text",
        timestamp: new Date(),
        read: false,
        data: { route: "/checkin" },
      },
      {
        id: "general",
        type: "general",
        title: "Account update",
        body: "Full account update",
        timestamp: new Date(),
        read: true,
      },
    ],
    unreadCount: 1,
    loading: false,
    loadingMore: false,
    hasMore: true,
    page: 1,
    error: null,
    fetchFromBackend: async (options) => {
      calls.reads++;
      if (options) calls.pages.push(options);
    },
    markAsRead: async (id) => {
      calls.marked.push(id);
      store.notifications = store.notifications.map((item) =>
        item.id === id ? { ...item, read: true } : item,
      );
      store.unreadCount = 0;
      return true;
    },
    markAllAsRead: async () => {
      calls.all++;
      store.unreadCount = 0;
      return true;
    },
    removeNotification: async (id) => {
      calls.removed.push(id);
      return true;
    },
    clearAll: async () => {
      calls.clear++;
      return true;
    },
  };
  const { NotificationsPage } = evaluate(
    "src/components/NotificationsPage.tsx",
    {
      react: r.hooks,
      "expo-router": r.router,
      "@/hooks/useGuardedRouter": {
        useGuardedRouter: () => ({
          back() {},
          push: (route) => calls.routes.push(route),
        }),
      },
      "react-i18next": {
        useTranslation: (namespace) => ({
          t: (key, args = {}) => {
            const copy = JSON.parse(
              fs.readFileSync(`src/i18n/locales/vi/${namespace}.json`, "utf8"),
            );
            return String(copy[key] ?? key).replace(
              /\{\{(\w+)\}\}/g,
              (_, name) => String(args[name] ?? ""),
            );
          },
          i18n: { language: "vi" },
        }),
      },
      "react-native": {
        ...Object.fromEntries(
          [
            "View",
            "Pressable",
            "FlatList",
            "ScrollView",
            "RefreshControl",
            "ActivityIndicator",
          ].map((name) => [name, name]),
        ),
        StyleSheet: {
          create: (styles) => styles,
          absoluteFillObject: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          },
        },
        BackHandler: {
          addEventListener: (_event, listener) => {
            backListeners.add(listener);
            return { remove: () => backListeners.delete(listener) };
          },
        },
      },
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => ({ top: 44, bottom: 24 }),
      },
      "@expo/vector-icons": { Ionicons: "Icon" },
      "./ScaledText": { ScaledText: "Text" },
      "./NotificationIcon": { NotificationIcon: "NotificationIcon" },
      "./state/Skeleton": { SkeletonBlock: "Skeleton" },
      "./Screen": { Screen: "Screen" },
      "./ScreenHeaderButton": { ScreenBackButton: "Back" },
      "./AppAlertModal": {
        AppAlertModal: "Alert",
        useAppAlert: () => ({
          alertState: {},
          dismissAlert() {},
          showAlert: (...args) => calls.alerts.push(args),
        }),
      },
      "../hooks/useScaledTypography": {
        useScaledTypography: () => theme.typography,
      },
      "../hooks/useThemeColors": {
        useThemeColors: () => ({ colors: theme.lightColors, isDark: false }),
      },
      "../styles": theme,
      "../stores/notification.store": {
        useNotificationStore: (select) => select(store),
      },
      "../stores/toast.store": { showToast() {} },
      "../lib/notifications": {
        routeFromNotificationData: (data) => data.route ?? null,
      },
    },
  );
  const mountRefs = (tree, row = false) => {
    for (const node of journeyNodes(tree)) {
      const ref = node.props.ref;
      if (typeof ref === "function") ref(host("item"));
      else if (ref && typeof ref === "object")
        ref.current = host(
          row ? "item" : node.props.collapsable === false ? "page" : "header",
        );
    }
    return tree;
  };
  const read = () => mountRefs(r.render(NotificationsPage));
  const list = () =>
    journeyNodes(read()).find((node) => node.type === "FlatList").props;
  const row = (id) => {
    const props = list();
    const item = props.data.find((item) => item.notification?.id === id);
    return journeyNodes(mountRefs(props.renderItem({ item }), true)).find(
      (node) => node.type === "Pressable",
    );
  };
  return {
    ...r,
    store,
    calls,
    read,
    list,
    row,
    native,
    back: () => [...backListeners].at(-1)?.(),
    resolveMeasurements: () => {
      while (native.pending.length) native.pending.shift()();
    },
    settle: async () => {
      await r.settle(NotificationsPage);
      return read();
    },
    panel: () =>
      journeyNodes(read()).find((node) => node.props.accessibilityViewIsModal),
  };
}
await test("the restyled inbox reads once on focus and still opens and marks the chosen notification", async () => {
  const h = inboxHarness();
  await h.settle();
  await h.settle();
  assert.equal(h.calls.reads, 1);
  const row = h.row("checkin");
  assert.ok(row.props.accessibilityLabel.includes("Chưa đọc"));
  row.props.onPress();
  await flush();
  assert.deepEqual(h.calls.marked, ["checkin"]);
  assert.deepEqual(h.calls.routes, ["/checkin"]);
  h.row("checkin").props.onPress();
  await flush();
  assert.deepEqual(h.calls.marked, ["checkin"]);
  h.blur();
});
await test("inbox item actions do not open or mark a notification and deletion still requires confirmation", async () => {
  const h = inboxHarness();
  await h.settle();
  let stopped = false;
  const button = journeyNodes(h.row("checkin")).find(
    (node) => node.props.accessibilityLabel === "Thao tác khác",
  );
  button.props.onPress({
    stopPropagation: () => {
      stopped = true;
    },
  });
  assert.equal(stopped, true);
  assert.deepEqual(h.calls.marked, []);
  assert.deepEqual(h.calls.routes, []);
  const nodes = journeyNodes(h.read());
  const remove = nodes.find(
    (node) =>
      node.type === "Pressable" &&
      journeyNodes(node).some((child) => child.props.children === "Xóa"),
  );
  remove.props.onPress();
  assert.deepEqual(h.calls.removed, []);
  assert.equal(h.calls.alerts.length, 1);
  const actions = h.calls.alerts[0][2];
  actions.find((action) => action.style === "destructive").onPress();
  await flush();
  assert.deepEqual(h.calls.removed, ["checkin"]);
  h.blur();
});
await test("the inbox omits the read-all summary and shortcut while its overflow action still marks all read", async () => {
  const h = inboxHarness();
  await h.settle();
  const assertRemovedLabels = () => {
    assert.ok(
      !journeyNodes(h.read()).some((node) =>
        ["Đã đọc tất cả", "Đọc tất cả"].includes(node.props.children),
      ),
    );
  };
  const openActions = () =>
    journeyNodes(h.read())
      .find(
        (node) =>
          node.type === "Pressable" &&
          node.props.accessibilityLabel === "Thao tác khác",
      )
      .props.onPress();
  const markAllButton = () =>
    journeyNodes(h.read()).find(
      (node) =>
        node.type === "Pressable" &&
        journeyNodes(node).some(
          (child) => child.props.children === "Đánh dấu tất cả đã đọc",
        ),
    );
  assertRemovedLabels();
  assert.ok(
    journeyNodes(h.read()).some((node) => node.props.children === "1 chưa đọc"),
  );
  assert.equal(markAllButton(), undefined);
  openActions();
  const button = markAllButton();
  assert.equal(button.props.disabled, false);
  button.props.onPress();
  await flush();
  assert.equal(h.calls.all, 1);
  assert.equal(h.calls.clear, 0);
  assertRemovedLabels();
  assert.ok(
    !journeyNodes(h.read()).some(
      (node) => node.props.children === "0 chưa đọc",
    ),
  );
  assert.equal(markAllButton(), undefined);
  openActions();
  assert.equal(markAllButton().props.disabled, true);
  h.blur();
});
await test("the inbox retains filtering, expansion, pagination and honest loading/error states", async () => {
  const h = inboxHarness();
  await h.settle();
  h.row("general").props.onPress();
  assert.equal(h.row("general").props.accessibilityState.expanded, true);
  assert.equal(
    journeyNodes(h.row("general")).find(
      (node) => node.props.children === "Full account update",
    ).props.numberOfLines,
    undefined,
  );
  h.row("general").props.onPress();
  assert.equal(h.row("general").props.accessibilityState.expanded, false);
  assert.deepEqual(h.calls.routes, []);
  assert.deepEqual(h.calls.marked, []);
  const reminder = journeyNodes(h.read()).find(
    (node) =>
      node.type === "Pressable" &&
      journeyNodes(node).some((child) => child.props.children === "Nhắc nhở"),
  );
  reminder.props.onPress();
  assert.deepEqual(
    h
      .list()
      .data.filter((item) => item.kind === "notification")
      .map((item) => item.notification.id),
    ["checkin"],
  );
  h.list().onEndReached();
  await flush();
  assert.deepEqual(h.calls.pages, [{ page: 2, append: true }]);
  h.store.loadingMore = true;
  h.list().onEndReached();
  assert.equal(h.calls.pages.length, 1);
  h.store.notifications = [];
  h.store.loading = true;
  h.store.unreadCount = 0;
  assert.ok(
    journeyNodes(h.list().ListEmptyComponent).some(
      (node) => node.props.accessibilityState?.busy,
    ),
  );
  h.store.loading = false;
  h.store.error = "offline";
  assert.ok(
    journeyNodes(h.list().ListEmptyComponent).some(
      (node) => node.props.children === "Chưa tải được thông báo",
    ),
  );
  assert.ok(
    !journeyNodes(h.read()).some(
      (node) => node.props.children === "Đã đọc tất cả",
    ),
  );
  h.blur();
});

const menuStyle = (node) =>
  Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
const headerMenuButton = (h) =>
  journeyNodes(h.read()).find(
    (node) =>
      node.type === "Pressable" &&
      node.props.accessibilityLabel === "Thao tác khác",
  );
await test("notification menus float outside the list and dismiss without reading or navigating", async () => {
  const h = inboxHarness();
  await h.settle();
  const data = h.list().data.map((item) => item.key);
  headerMenuButton(h).props.onPress();
  const panel = h.panel();
  assert.ok(panel);
  panel.props.onLayout({ nativeEvent: { layout: { height: 112 } } });
  assert.equal(menuStyle(h.panel()).position, "absolute");
  assert.deepEqual(
    h.list().data.map((item) => item.key),
    data,
  );
  assert.equal(headerMenuButton(h).props.accessibilityState.expanded, true);
  assert.ok(
    !journeyNodes(
      h
        .list()
        .renderItem({
          item: h
            .list()
            .data.find((item) => item.notification?.id === "checkin"),
        }),
    ).some((node) => node.props.accessibilityViewIsModal),
  );
  journeyNodes(h.read())
    .find(
      (node) =>
        node.type === "Pressable" && node.props.accessibilityLabel === "Đóng",
    )
    .props.onPress();
  assert.equal(h.panel(), undefined);
  assert.equal(h.calls.reads, 1);
  assert.deepEqual(h.calls.marked, []);
  assert.deepEqual(h.calls.routes, []);
  h.blur();
});
await test("notification menus near the bottom flip above the trigger and fit narrow screens with large text", async () => {
  const h = inboxHarness();
  h.native.page.width = 320;
  h.native.page.height = 568;
  h.native.item = { x: 272, y: 494, width: 44, height: 44 };
  await h.settle();
  journeyNodes(h.row("checkin"))
    .find((node) => node.props.accessibilityLabel === "Thao tác khác")
    .props.onPress({ stopPropagation() {} });
  h.panel().props.onLayout({ nativeEvent: { layout: { height: 240 } } });
  const style = menuStyle(h.panel());
  assert.ok(style.left >= 0 && style.left + style.width <= h.native.page.width);
  assert.ok(style.top >= 44 && style.top + 240 <= h.native.page.height - 24);
  assert.ok(style.top + 240 <= h.native.item.y - h.native.page.y);
  journeyNodes(h.read())
    .find((node) => node.props.collapsable === false)
    .props.onLayout();
  assert.equal(
    h.panel(),
    undefined,
    "changing the screen layout closes an outdated anchor",
  );
  h.blur();
});
await test("a delayed menu measurement cannot reopen a blurred notification screen", async () => {
  const h = inboxHarness();
  await h.settle();
  h.native.defer = true;
  headerMenuButton(h).props.onPress();
  assert.ok(h.native.pending.length);
  h.blur();
  h.resolveMeasurements();
  assert.equal(h.panel(), undefined);
  assert.deepEqual(h.calls.marked, []);
  assert.deepEqual(h.calls.routes, []);
});
await test("Android Back closes only the notification menu, and removing its target restores the page", async () => {
  const h = inboxHarness();
  await h.settle();
  headerMenuButton(h).props.onPress();
  await h.settle();
  assert.equal(h.back(), true);
  assert.equal(h.panel(), undefined);
  assert.deepEqual(h.calls.routes, []);
  journeyNodes(h.row("checkin"))
    .find((node) => node.props.accessibilityLabel === "Thao tác khác")
    .props.onPress({ stopPropagation() {} });
  assert.ok(h.panel());
  h.store.notifications = [];
  await h.settle();
  assert.equal(h.panel(), undefined);
  assert.ok(
    !journeyNodes(h.read()).some(
      (node) => node.props.importantForAccessibility === "no-hide-descendants",
    ),
  );
  assert.equal(h.calls.reads, 1);
  h.blur();
});


// Daily missions: exercise the production screen with controlled API/native adapters.
function missionsScreenHarness({ language = 'vi', dark = false } = {}) {
  const r = runtime(), routes = [], requests = [];
  const catalog = JSON.parse(fs.readFileSync(`src/i18n/locales/${language}/missions.json`, 'utf8'));
  const t = (key, args = {}) => {
    assert.equal(typeof catalog[key], 'string', `${language}: ${key}`);
    return catalog[key].replace(/\{\{(\w+)\}\}/g, (_, name) => String(args[name] ?? ''));
  };
  const store = { status: 'success', errorState: 'none', missions: [],
    fetchMissions: async signal => { requests.push(signal); } };
  const theme = evaluate('src/styles/theme.ts', {});
  const colors = dark ? theme.darkColors : theme.lightColors;
  const screenFile = 'app/(tabs)/missions/index.tsx';
  const assets = Object.fromEntries([...fs.readFileSync(screenFile, 'utf8').matchAll(/require\('([^']+)'\)/g)]
    .map(match => [match[1], match[1]]));
  const { default: Screen } = evaluate(screenFile, {
    ...assets, react: { ...r.hooks, default: { Fragment: 'Fragment' } },
    'react-native': { Image: 'Image', Pressable: 'Pressable', View: 'View',
      StyleSheet: { create: value => value, hairlineWidth: 0.5 } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    'react-i18next': { useTranslation: namespace => ({ t: namespace === 'missions' ? t : key => key }) },
    'expo-router': r.router, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/hooks/useGuardedRouter': { useGuardedRouter: () => ({
      push: route => routes.push(route), canGoBack: () => false, replace: route => routes.push(route),
    }) },
    '../../../src/components/RippleRefresh': { RippleRefreshScrollView: 'Scroll' },
    '../../../src/components/OfflineBanner': { OfflineBanner: 'OfflineBanner' },
    '../../../src/components/ScaledText': { ScaledText: 'Text' },
    '../../../src/components/Screen': { Screen: 'Screen' },
    '../../../src/components/ScreenHeaderButton': { ScreenBackButton: 'Back' },
    '../../../src/components/state/StateEmpty': { StateEmpty: 'Empty' },
    '../../../src/components/state/StateError': { StateError: 'Error' },
    '../../../src/components/state/MainScreenSkeletons': { MissionsTabSkeleton: 'Skeleton' },
    '../../../src/features/missions/useMissionActions': { useMissionActions: () => store },
    '../../../src/features/missions/MissionProgressBar': { MissionProgressBar: 'Progress' },
    '../../../src/hooks/useThemeColors': { useThemeColors: () => ({ colors, isDark: dark }) },
    '../../../src/styles': { getBottomTabBarHeight: theme.getBottomTabBarHeight },
  });
  const read = () => r.render(Screen);
  return { ...r, store, requests, routes, colors, t, read, settle: () => r.settle(Screen),
    nodes: () => journeyNodes(read()),
    find: id => journeyNodes(read()).find(node => node.props?.testID === id),
  };
}
const missionFixtures = () => [
  { missionKey: 'log_weight', progress: 0, goal: 1 },
  { missionKey: 'log_water', progress: 1, goal: 4 },
  { missionKey: 'log_glucose', progress: 0, goal: 2 },
  { missionKey: 'log_bp', progress: 1, goal: 2 },
  { missionKey: 'daily_checkin', progress: 1, goal: 1 },
].map(item => ({ ...item, id: item.missionKey, title: '', description: '', status: 'active' }));
const flattenMissionStyle = style => Array.isArray(style)
  ? Object.assign({}, ...style.filter(Boolean).map(flattenMissionStyle)) : style ?? {};
for (const language of ['vi', 'en']) {
  for (const dark of [false, true]) {
    await test(`${language}/${dark ? 'dark' : 'light'}: missions group real progress, preserve every destination and expose scalable text`, async () => {
      const h = missionsScreenHarness({ language, dark }); h.store.missions = missionFixtures();
      await h.settle();
      assert.equal(h.requests.length, 1);
      assert.equal(h.find('missions-completed'), undefined);
      const rows = journeyNodes(h.find('missions-remaining')).filter(node => node.props?.testID?.startsWith('mission-'));
      assert.deepEqual(rows.map(row => row.props.testID), ['mission-log_bp', 'mission-log_glucose', 'mission-log_water', 'mission-log_weight']);
      assert.ok(journeyNodes(h.find('missions-summary')).some(node => node.props.children === h.t('completionSummary', { completed: 1, total: 5 })));
      for (const row of rows) {
        assert.equal(row.props.accessibilityRole, 'button');
        assert.ok(row.props.accessibilityLabel && row.props.accessibilityHint);
        assert.ok(flattenMissionStyle(row.props.style({ pressed: false })).minHeight >= 44);
        row.props.onPress();
      }
      h.find('missions-completed-toggle').props.onPress();
      assert.equal(h.find('missions-completed-toggle').props.accessibilityState.expanded, true);
      h.find('mission-daily_checkin').props.onPress();
      assert.deepEqual(h.routes, ['/logs/blood-pressure', '/logs/glucose', '/logs/water', '/logs/weight', '/checkin']);
      assert.ok(h.nodes().filter(node => node.type === 'Text').every(node => node.props.allowFontScaling && !node.props.numberOfLines));
      assert.ok(h.nodes().filter(node => node.type === 'Image').every(node => node.props.resizeMode === 'contain' && node.props.accessible === false));
      const group = flattenMissionStyle(h.find('missions-remaining').props.style);
      assert.equal(group.backgroundColor, dark ? h.colors.surface : '#FDFFFE');
      h.blur();
    });
  }
  await test(`${language}: missing missions and empty/error/loading responses never fabricate tasks or progress`, async () => {
    const h = missionsScreenHarness({ language });
    for (const status of ['idle', 'loading']) {
      h.store.status = status;
      assert.equal(h.nodes().filter(node => node.type === 'Skeleton').length, 1);
      assert.equal(h.find('missions-summary'), undefined);
    }
    h.store.status = 'success';
    assert.equal(h.nodes().find(node => node.type === 'Empty').props.message, h.t('noMissionsToday'));
    assert.equal(h.find('missions-remaining'), undefined);
    h.store.status = 'error'; h.store.errorState = 'no-data';
    assert.equal(h.nodes().filter(node => node.type === 'Error').length, 1);
    assert.equal(h.nodes().filter(node => node.type === 'Empty').length, 0);
    h.store.status = 'success'; h.store.errorState = 'none';
    h.store.missions = [missionFixtures()[0]];
    assert.equal(h.nodes().filter(node => node.props?.testID?.startsWith('mission-')).length, 1);
    assert.ok(journeyNodes(h.find('missions-summary')).some(node => node.props.children === h.t('completionSummary', { completed: 0, total: 1 })));
    h.store.errorState = 'remote-failed';
    assert.equal(h.nodes().filter(node => node.type === 'OfflineBanner').length, 1);
    assert.ok(h.find('mission-log_weight')); h.blur();
  });
}
await test('mission disclosures neither navigate nor refetch, and completed tasks stay discoverable', async () => {
  const h = missionsScreenHarness(); h.store.missions = missionFixtures(); await h.settle();
  h.find('missions-help-toggle').props.onPress();
  assert.ok(h.find('missions-help'));
  assert.equal(h.find('missions-help-toggle').props.accessibilityState.expanded, true);
  h.find('missions-help-toggle').props.onPress(); assert.equal(h.find('missions-help'), undefined);
  for (let i = 0; i < 2; i++) h.find('missions-completed-toggle').props.onPress();
  assert.equal(h.find('missions-completed'), undefined);
  await h.settle(); assert.deepEqual(h.routes, []); assert.equal(h.requests.length, 1);
  h.store.missions = missionFixtures().map(item => ({ ...item, status: 'completed' }));
  assert.equal(h.find('missions-remaining'), undefined);
  assert.ok(h.find('missions-completed-toggle')); h.blur();
});
await test('returning immediately from a health log reloads missions once and aborts the previous focus', async () => {
  const h = missionsScreenHarness(); h.store.missions = missionFixtures(); await h.settle();
  const first = h.requests[0]; await h.settle(); assert.equal(h.requests.length, 1);
  h.blur(); assert.equal(first.aborted, true);
  h.focus(); await h.settle(); assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].aborted, false); h.blur();
});
await test('mission refresh clears its spinner even when the request rejects', async () => {
  const h = missionsScreenHarness(); h.store.missions = missionFixtures(); await h.settle();
  const pending = deferred(); h.store.fetchMissions = () => pending.promise;
  const refresh = h.nodes().find(node => node.type === 'Scroll').props.onRefresh();
  assert.equal(h.nodes().find(node => node.type === 'Scroll').props.refreshing, true);
  pending.reject(new Error('offline')); await assert.rejects(refresh, /offline/);
  assert.equal(h.nodes().find(node => node.type === 'Scroll').props.refreshing, false); h.blur();
});
await test('mission progress is bounded and only actual completion moves a row into the completed group', () => {
  const h = missionsScreenHarness();
  h.store.missions = [
    { ...missionFixtures()[0], progress: -2 },
    { ...missionFixtures()[1], progress: Number.NaN, goal: 0 },
    { ...missionFixtures()[2], progress: 99 },
  ];
  assert.ok(h.find('mission-log_weight')); assert.ok(h.find('mission-log_water'));
  assert.equal(h.find('mission-log_glucose'), undefined);
  h.find('missions-completed-toggle').props.onPress();
  assert.ok(h.find('mission-log_glucose'));
  const summary = journeyNodes(h.find('missions-summary')).find(node => node.type === 'Progress');
  assert.equal(summary.props.progress, 1); assert.equal(summary.props.goal, 3); h.blur();
});

console.log(`UI feature state: ${checks} runtime checks passed.`);
