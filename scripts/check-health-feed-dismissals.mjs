import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { create } from "zustand";

const module = { exports: {} };
const compiled = ts.transpileModule(
  fs.readFileSync("src/features/health-feed/feed-dismissals.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
// Execute the local TypeScript module against the test storage adapter.
// eslint-disable-next-line no-new-func
new Function("require", "module", "exports", compiled)(
  (id) => {
    assert.equal(id, "zustand");
    return { create };
  },
  module,
  module.exports,
);
const { createFeedDismissals } = module.exports;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

function harness(options = {}) {
  const auth = { userId: "account-a", token: "fixture-session-a" };
  const memory = options.memory || new Map();
  const calls = [];
  const dependencies = {
    storage: {
      getItem: (key) =>
        options.read
          ? options.read(key)
          : Promise.resolve(memory.get(key) || null),
      setItem: async (key, value) => {
        if (options.write) await options.write(key, value);
        memory.set(key, value);
      },
    },
    request: async (id, token) => {
      calls.push({ id, token });
      return options.request ? options.request(id) : { ok: true };
    },
    session: () => auth,
  };
  const store = createFeedDismissals(dependencies);
  return {
    store,
    auth,
    memory,
    calls,
    dismiss: (id) =>
      store.getState().dismiss(String(auth.userId), auth.token, id),
    snapshot: () => store.getState().users[String(auth.userId)],
    reopen: () => createFeedDismissals(dependencies),
  };
}

let checks = 0;
async function test(label, run) {
  await run();
  checks++;
  console.log(`PASS ${label}`);
}

await test("a server item hides only after confirmation; duplicate taps send one request", async () => {
  const pending = deferred();
  const h = harness({ request: () => pending.promise });
  const first = h.dismiss("server-item-1");
  await flush();
  assert.deepEqual(h.snapshot().pendingIds, ["server-item-1"]);
  assert.deepEqual(h.snapshot().hiddenIds, []);
  assert.equal(await h.dismiss("server-item-1"), false);
  assert.equal(h.calls.length, 1);
  pending.resolve({ ok: true });
  assert.equal(await first, true);
  assert.deepEqual(h.snapshot().hiddenIds, ["server-item-1"]);
  assert.deepEqual(h.snapshot().pendingIds, []);
});

await test("rejected and disabled server responses leave the item visible and allow retry", async () => {
  for (const response of [{ ok: false }, { ok: true, enabled: false }]) {
    const h = harness({ request: () => response });
    await assert.rejects(h.dismiss("server-item-1"));
    assert.deepEqual(h.snapshot().hiddenIds, []);
    assert.deepEqual(h.snapshot().pendingIds, []);
    assert.equal(h.memory.size, 0);
  }
});

await test("a network failure does not produce a hidden item or false success", async () => {
  const h = harness({
    request: () => {
      throw new Error("offline fixture");
    },
  });
  await assert.rejects(h.dismiss("server-item-1"), /offline fixture/);
  assert.deepEqual(h.snapshot().hiddenIds, []);
  assert.deepEqual(h.snapshot().pendingIds, []);
});

await test("curated items persist across screen and app reopening without calling a fake API ID", async () => {
  const h = harness();
  assert.equal(await h.dismiss("curated-1"), true);
  assert.equal(h.calls.length, 0);
  const reopened = h.reopen();
  await reopened.getState().hydrate("account-a");
  assert.deepEqual(reopened.getState().users["account-a"].hiddenIds, [
    "curated-1",
  ]);
  await reopened.getState().hydrate("account-b");
  assert.deepEqual(reopened.getState().users["account-b"].hiddenIds, []);
});

await test("dismissing the last server item persists the decision to keep the feed empty", async () => {
  const h = harness();
  await h.dismiss("server-item-1");
  const reopened = h.reopen();
  await reopened.getState().hydrate("account-a");
  assert.equal(
    reopened.getState().users["account-a"].hasDismissedServerItem,
    true,
  );
  assert.deepEqual(reopened.getState().users["account-a"].hiddenIds, [
    "server-item-1",
  ]);
  assert.equal(await h.dismiss("server-item-1"), false);
  assert.equal(h.calls.length, 1);
});

await test("failed local persistence leaves a curated item visible and retry works", async () => {
  let failed = true;
  const h = harness({
    write: () => {
      if (failed) throw new Error("storage fixture");
    },
  });
  await assert.rejects(h.dismiss("curated-1"), /storage fixture/);
  assert.deepEqual(h.snapshot().hiddenIds, []);
  failed = false;
  assert.equal(await h.dismiss("curated-1"), true);
});

await test("a confirmed server dismissal remains successful when its local cache is unavailable", async () => {
  const h = harness({
    write: () => {
      throw new Error("storage fixture");
    },
  });
  assert.equal(await h.dismiss("server-item-1"), true);
  assert.deepEqual(h.snapshot().hiddenIds, ["server-item-1"]);
  assert.equal(h.snapshot().hasDismissedServerItem, true);
});

await test("hiding two different articles concurrently preserves both after reopening", async () => {
  const firstWrite = deferred();
  let writes = 0;
  const h = harness({
    write: () => (++writes === 1 ? firstWrite.promise : undefined),
  });
  const first = h.dismiss("curated-1");
  const second = h.dismiss("curated-2");
  await flush();
  firstWrite.resolve();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  const reopened = h.reopen();
  await reopened.getState().hydrate("account-a");
  assert.deepEqual(reopened.getState().users["account-a"].hiddenIds.sort(), [
    "curated-1",
    "curated-2",
  ]);
});

await test("account switching while the cache loads cannot send a stale authenticated request", async () => {
  const read = deferred();
  const h = harness({ read: () => read.promise });
  const work = h.dismiss("server-item-1");
  h.auth.userId = "account-b";
  h.auth.token = "fixture-session-b";
  read.resolve(null);
  assert.equal(await work, false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.memory.size, 0);
});

await test("a late successful response belongs only to its original account and cannot show a new-session success", async () => {
  const pending = deferred();
  const h = harness({ request: () => pending.promise });
  const work = h.dismiss("server-item-1");
  await flush();
  h.auth.userId = "account-b";
  h.auth.token = "fixture-session-b";
  pending.resolve({ ok: true });
  assert.equal(await work, false);
  assert.deepEqual(h.store.getState().users["account-a"].hiddenIds, [
    "server-item-1",
  ]);
  assert.equal(h.snapshot(), undefined);
  assert.equal(
    [...h.memory.keys()].some((key) => key.endsWith("account-b")),
    false,
  );
});

await test("a failed stale response cannot show an error for another account", async () => {
  const pending = deferred();
  const h = harness({ request: () => pending.promise });
  const work = h.dismiss("server-item-1");
  await flush();
  h.auth.token = "fixture-new-session";
  pending.reject(new Error("old-session fixture"));
  assert.equal(await work, false);
  assert.deepEqual(h.snapshot().hiddenIds, []);
});

await test("the cache contains only IDs and preference flags, never credentials or article text", async () => {
  const h = harness();
  await h.dismiss("curated-1");
  for (const value of h.memory.values()) {
    const saved = JSON.parse(value);
    assert.deepEqual(Object.keys(saved).sort(), [
      "hasDismissedServerItem",
      "hiddenIds",
      "version",
    ]);
    assert.equal(value.includes(h.auth.token), false);
  }
  h.auth.token = null;
  assert.equal(await h.dismiss("server-item-1"), false);
  assert.equal(h.calls.length, 0);
});

function screenHarness(options = {}) {
  const h = harness(options);
  const catalog = JSON.parse(
    fs.readFileSync("src/i18n/locales/vi/common.json", "utf8"),
  );
  const t = (key) => {
    assert.equal(typeof catalog[key], "string", key);
    return catalog[key];
  };
  const routes = [],
    toasts = [],
    slots = [];
  let cursor = 0,
    effects = [];
  const memo = (work, deps) => {
    const index = cursor++;
    if (
      !slots[index] ||
      deps.some((value, i) => !Object.is(value, slots[index].deps[i]))
    )
      slots[index] = { deps, value: work() };
    return slots[index].value;
  };
  const effect = (work) => {
    const index = cursor++;
    if (slots[index]?.work !== work) {
      const old = slots[index];
      slots[index] = { work };
      effects.push(() => {
        old?.cleanup?.();
        slots[index].cleanup = work();
      });
    }
  };
  const react = {
    useMemo: memo,
    useCallback: (work, deps) => memo(() => work, deps),
    useRef: (initial) => {
      const index = cursor++;
      slots[index] ||= { value: { current: initial } };
      return slots[index].value;
    },
    useState: (initial) => {
      const index = cursor++;
      slots[index] ||= { value: initial };
      return [
        slots[index].value,
        (value) => {
          slots[index].value =
            typeof value === "function" ? value(slots[index].value) : value;
        },
      ];
    },
  };
  const authState = () => ({
    profile: { id: h.auth.userId },
    token: h.auth.token,
  });
  const useAuthStore = Object.assign((select) => select(authState()), {
    getState: authState,
  });
  const palette = {
    background: "#f3fbf9",
    textPrimary: "#172033",
    textSecondary: "#656565",
    border: "#dcece8",
  };
  const readArticle = {
    id: "feed-one",
    content_id: "article-one",
    title: "Article one",
    message: "Fixture summary",
    feed_type: "advice",
  };
  const requests = [];
  const dependencies = {
    react: { __esModule: true, default: react, ...react },
    "react/jsx-runtime": {
      jsx: (type, props, key) => ({ type, props, key }),
      jsxs: (type, props, key) => ({ type, props, key }),
    },
    "react-native": {
      ...Object.fromEntries(
        [
          "View",
          "Image",
          "Pressable",
          "ScrollView",
          "RefreshControl",
          "ActivityIndicator",
        ].map((name) => [name, name]),
      ),
      StyleSheet: { create: (value) => value, hairlineWidth: 1 },
    },
    "react-i18next": { useTranslation: () => ({ t }) },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 59, bottom: 34 }),
    },
    "expo-router": { useFocusEffect: effect },
    "../../src/components/Screen": { Screen: "Screen" },
    "../../src/components/ScaledText": { ScaledText: "Text" },
    "../../src/components/ScreenHeaderButton": { ScreenBackButton: "Back" },
    "../../src/styles": { spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } },
    "../../src/hooks/useThemeColors": {
      useThemeColors: () => ({ isDark: false, colors: palette }),
    },
    "@/hooks/useGuardedRouter": {
      useGuardedRouter: () => ({
        push: (route) => routes.push(route),
        back: () => {},
      }),
    },
    "../../src/features/health-feed/HealthFeedThumbnail": {
      HealthFeedThumbnail: "Thumbnail",
    },
    "../../src/features/auth/auth.store": { useAuthStore },
    "../../src/stores/toast.store": {
      showToast: (...args) => toasts.push(args),
    },
    "../../src/lib/apiClient": {
      apiClient: async (path, config) => {
        requests.push({ path, method: config?.method });
        if (path === "/api/health-feed/feed")
          return {
            ok: true,
            enabled: true,
            feed: options.curated ? [] : [readArticle],
          };
        if (path === "/api/health-feed/saved")
          return {
            ok: true,
            saved: [
              {
                id: "article-one",
                title: "Article one",
                summary: "Saved fixture",
              },
            ],
          };
        return { ok: true };
      },
    },
    "../../src/features/health-feed/useHealthFeedDismissals": {
      useHealthFeedDismissals: () => {
        void h.store.getState().hydrate(String(h.auth.userId));
        const value = h.snapshot() || module.exports.EMPTY_FEED_DISMISSALS;
        return {
          dismiss: h.dismiss,
          hiddenIds: new Set(value.hiddenIds),
          pendingIds: value.pendingIds,
          hydrated: value.loaded,
          canShowCurated: value.loaded && !value.hasDismissedServerItem,
        };
      },
    },
  };
  const output = ts.transpileModule(
    fs.readFileSync("app/feed/index.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const target = { exports: {} };
  // Execute the real screen with controlled React Native dependencies.
  // eslint-disable-next-line no-new-func
  new Function("require", "module", "exports", output)(
    (id) => {
      if (id.endsWith(".png")) return id;
      assert.ok(id in dependencies, `Missing feed screen dependency: ${id}`);
      return dependencies[id];
    },
    target,
    target.exports,
  );
  let tree;
  const nodes = (value) =>
    !value || typeof value !== "object"
      ? []
      : Array.isArray(value)
        ? value.flatMap(nodes)
        : [value, ...nodes(value.props?.children)];
  const all = () => nodes(tree);
  return {
    ...h,
    routes,
    toasts,
    requests,
    catalog,
    all,
    async settle() {
      for (let i = 0; i < 6; i++) {
        cursor = 0;
        tree = target.exports.default();
        const pending = effects;
        effects = [];
        pending.forEach((work) => work());
        await flush();
      }
      return tree;
    },
    hideButtons: () =>
      all().filter(
        (node) => node.props?.accessibilityLabel === catalog.hideFeed,
      ),
    async refresh() {
      await all()
        .find((node) => node.type === "ScrollView")
        .props.refreshControl.props.onRefresh();
    },
    unmount() {
      slots.forEach((slot) => slot.cleanup?.());
    },
  };
}

await test("articles open for reading without any hide action", async () => {
  const h = screenHarness();
  await h.settle();
  assert.equal(h.hideButtons().length, 0);
  const article = h.all().find(node => node.props?.accessibilityLabel === "Article one");
  assert.ok(article);
  await article.props.onPress();
  await h.settle();
  assert.deepEqual(h.routes, ["/feed/article-one"]);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.toasts, []);
  await h.refresh();
  await h.settle();
  assert.ok(h.all().some(node => node.props?.accessibilityLabel === "Article one"));
  assert.equal(h.hideButtons().length, 0);
  h.unmount();
});

await test("saved articles remain readable without a hide action", async () => {
  const h = screenHarness();
  await h.settle();
  const tabs = h
    .all()
    .filter((node) => node.props?.accessibilityRole === "tab");
  tabs[1].props.onPress();
  await h.settle();
  assert.ok(
    h.all().some((node) => node.props?.accessibilityLabel === "Article one"),
  );
  assert.equal(h.hideButtons().length, 0);
  assert.deepEqual(h.calls, []);
  h.unmount();
});

await test("all five curated articles stay available after refresh and reopening with no X button", async () => {
  const h = screenHarness({ curated: true });
  await h.settle();
  const articleCount = screen => screen.all().filter(node => node.type === "Pressable" && node.props.accessibilityHint === screen.catalog.feedReadDetails).length;
  assert.equal(h.hideButtons().length, 0);
  assert.equal(articleCount(h), 5);
  assert.equal(h.calls.length, 0);
  await h.refresh();
  await h.settle();
  assert.equal(h.hideButtons().length, 0);
  assert.equal(articleCount(h), 5);
  h.unmount();
  const reopened = screenHarness({ curated: true, memory: h.memory });
  await reopened.settle();
  assert.equal(reopened.hideButtons().length, 0);
  assert.equal(articleCount(reopened), 5);
  reopened.unmount();
});

console.log(`Health Feed dismissals: ${checks} runtime checks passed.`);
