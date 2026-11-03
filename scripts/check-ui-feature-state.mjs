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
    },
  }).outputText;
  new Function("module", "exports", "require", code)(
    module,
    module.exports,
    (id) => {
      assert.ok(id in adapters, `Missing hook adapter ${id}`);
      return adapters[id];
    }
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
  created_at = "2026-11-03T02:00:00Z"
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
    entry(60 - i, i === 0 ? 10 : -1, i === 0 ? "CHECKIN" : "REDEEM")
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
    }
  );
  const hook = () => useQrCameraPermission(requestOnFocus);
  return {
    ...r,
    server,
    calls,
    read: () => r.render(hook),
    settle: () => r.settle(hook),
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
    }
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

console.log(`UI feature state: ${checks} runtime checks passed.`);
