import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
function evaluate(file, adapters) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  // Execute local feature modules with controlled native dependencies.
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", code)(
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
  };
  const router = {
    useFocusEffect(callback) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || previous.callback !== callback) {
        slots[index] = { callback };
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
        slot.cleanup?.();
        slot.cleanup = null;
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
  const { useHealthTreeOverview } = evaluate(
    "src/features/tree/useHealthTreeOverview.ts",
    {
      react: r.hooks,
      "expo-router": r.router,
      "../auth/auth.store": { useAuthStore: (selector) => selector(auth) },
      "../checkin/checkin.api": {
        checkinApi: {
          getHealthScore: async () => {
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
    read: () => r.render(useHealthTreeOverview),
    settle: () => r.settle(useHealthTreeOverview),
  };
}
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
  const server = { allowed: false, pending: null, error: false };
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
      { task_code: "CHECKIN", done: 1, daily_limit: 1, weekly_limit: 0 },
      { task_code: "MED_ANSWER", done: 0, daily_limit: 4, weekly_limit: 0 },
      { task_code: "VITAL", done: 0, daily_limit: 2, weekly_limit: 0 },
      { task_code: "GIFT_OPEN", done: 1, daily_limit: 1, weekly_limit: 0 },
      { task_code: "WEEKLY", done: 0, daily_limit: 0, weekly_limit: 1 },
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
          "react-native-svg": {
            __esModule: true,
            default: "Svg",
            Circle: "Circle",
          },
          "../../components/ScaledText": { ScaledText: "Text" },
          "../../hooks/useThemeColors": {
            useThemeColors: () => ({ isDark: false, colors: {} }),
          },
          "../../hooks/useScaledTypography": {
            useScaledFontSize: (size) => size,
          },
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
      assert.equal(progress.length, 6);
      assert.equal(progress[0].props.accessibilityValue.now, 40);
      assert.equal(progress.at(-1).props.accessibilityValue.now, 1);
      assert.equal(progress.at(-1).props.accessibilityValue.max, 5);
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

console.log(`UI feature state: ${checks} runtime checks passed.`);
