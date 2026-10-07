import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import React from "react";

const read = (file) => fs.readFileSync(file, "utf8");
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
const defaults = {
  enabled: false,
  checkin_time: "23:30:00",
  timezone: "Asia/Ho_Chi_Minh",
  grace_hours: 6,
  user_timeout_seconds: 60,
  family_ring_seconds: 60,
  family_confirm_minutes: 10,
  max_rounds: 1,
};
function evaluate(source, imports) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", output)(
    module,
    module.exports,
    (id) => {
      if (id === "react/jsx-runtime")
        return {
          jsx: (type, props, key) => React.createElement(type, { ...props, key }),
          jsxs: (type, props, key) => React.createElement(type, { ...props, key }),
          Fragment: React.Fragment,
        };
      assert.ok(id in imports, `Missing Home toggle adapter: ${id}`);
      return imports[id];
    }
  );
  return module.exports;
}
let checks = 0;
async function test(label, run) {
  await run();
  checks++;
  console.log(`PASS ${label}`);
}

function harness({
  language = "vi",
  enabled = false,
  status,
  contacts = [{ id: 8, name: "Relative" }],
  save,
  load,
  fontSize = 15,
} = {}) {
  let cursor = 0;
  let focused = true;
  let pending = [];
  const slots = [];
  const listeners = new Set();
  const auth = { profile: { id: "7" }, token: "session-A" };
  const server = {
    settings: { ...defaults, enabled },
    status: status ?? { callCenterEnabled: true, isAnTam: true },
    contacts,
  };
  const calls = { loads: 0, saves: [], pushes: [], stateWrites: 0, toasts: [] };
  const memo = (fn, deps) => {
    const index = cursor++;
    if (
      !slots[index] ||
      deps.some((value, i) => !Object.is(value, slots[index].deps[i]))
    )
      slots[index] = { deps, value: fn() };
    return slots[index].value;
  };
  const hooks = {
    createElement: React.createElement,
    Fragment: React.Fragment,
    useMemo: memo,
    useCallback: (fn, deps) => memo(() => fn, deps),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = {
          value: typeof initial === "function" ? initial() : initial,
        };
      return [
        slots[index].value,
        (value) => {
          calls.stateWrites++;
          slots[index].value =
            typeof value === "function" ? value(slots[index].value) : value;
        },
      ];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: { current: initial } };
      return slots[index].value;
    },
    useEffect: (fn, deps) => {
      const index = cursor++;
      if (
        !slots[index] ||
        deps.some((value, i) => !Object.is(value, slots[index].deps[i]))
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
    ["checkinCall", "common"].map((ns) => {
      const catalog = JSON.parse(
        read(`src/i18n/locales/${language}/${ns}.json`)
      );
      return [
        ns,
        (key, values = {}) => {
          const value = key
            .split(".")
            .reduce((item, part) => item?.[part], catalog);
          assert.equal(typeof value, "string", `${language}:${ns}:${key}`);
          return value.replace(/\{\{(\w+)\}\}/g, (_, name) =>
            String(values[name] ?? "")
          );
        },
      ];
    })
  );
  const useAuthStore = (selector) => selector(auth);
  useAuthStore.getState = () => auth;
  const typography = { size: { sm: fontSize, md: fontSize + 3, lg: fontSize + 7 } };
  const native = { Pressable: "Button", ScrollView: "ScrollView", View: "View", StyleSheet: { create: value => value } };
  const styles = { colors: {}, iconColors: {}, radius: { xl: 20, md: 12 }, spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 } };
  const { AppAlertModal } = evaluate(read("src/components/AppAlertModal.tsx"), {
    react: { __esModule: true, default: hooks, ...hooks }, "react-native": native,
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) },
    "@expo/vector-icons": { MaterialCommunityIcons: "Icon" },
    "./ScaledText": { ScaledText: "Text" }, "./QueuedModal": { QueuedModal: "AppModal" },
    "../hooks/useScaledTypography": { useScaledTypography: () => typography },
    "../hooks/useThemeColors": { useThemeColors: () => ({ isDark: false }) },
    "react-i18next": { useTranslation: () => ({ t: translations.common }) }, "../styles": styles,
  });
  const { HomeCheckinCallControl } = evaluate(
    read("src/components/HomeCheckinCallControl.tsx"),
    {
      react: { __esModule: true, default: hooks, ...hooks },
      "react-native": {
        ActivityIndicator: "Spinner",
        Pressable: "Button",
        ScrollView: "ScrollView",
        Switch: "Switch",
        View: "View",
        StyleSheet: { create: (value) => value },
        AppState: {
          addEventListener: (_name, listener) => {
            listeners.add(listener);
            return { remove: () => listeners.delete(listener) };
          },
        },
      },
      "expo-router": {
        useFocusEffect: (callback) => {
          const index = cursor++;
          const previous = slots[index];
          if (!previous || previous.callback !== callback) {
            slots[index] = { kind: "focus", callback };
            pending.push(() => {
              previous?.cleanup?.();
              if (focused) slots[index].cleanup = callback();
            });
          }
        },
      },
      "@expo/vector-icons": { Ionicons: "Icon" },
      "react-i18next": { useTranslation: (ns) => ({ t: translations[ns] }) },
      "react-native-safe-area-context": {
        useSafeAreaInsets: () => ({ top: 59, bottom: 34 }),
      },
      "../hooks/useGuardedRouter": {
        useGuardedRouter: () => ({ push: (route) => calls.pushes.push(route) }),
      },
      "../hooks/useScaledTypography": {
        useScaledTypography: () => typography,
      },
      "../hooks/useThemeColors": { useThemeColors: () => ({ isDark: false }) },
      "../features/auth/auth.store": { useAuthStore },
      "../features/checkin-call/checkin-call.api": {
        checkinCallApi: {
          settings: async () => {
            const count = ++calls.loads;
            if (load) return load(server, count);
            return {
              ok: true,
              settings: { ...server.settings },
              contacts: server.contacts,
            };
          },
          setEnabled: async (value) => {
            calls.saves.push(value);
            if (save) {
              const result = await save(value, server);
              if (result.ok) server.settings = result.settings;
              return result;
            }
            server.settings = { ...server.settings, enabled: value };
            return { ok: true, settings: { ...server.settings } };
          },
        },
      },
      "../lib/apiClient": {
        apiClient: async (path) => {
          assert.equal(path, "/api/subscriptions/status");
          if (server.status instanceof Error) throw server.status;
          return server.status;
        },
        getApiErrorMessage: (error) => error.message,
      },
      "../styles": {
        colors: {},
        radius: { xl: 20, lg: 16 },
        spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
      },
      "./AppAlertModal": { AppAlertModal },
      "../stores/toast.store": { showToast: (...args) => calls.toasts.push(args) },
      "./ScaledText": { ScaledText: "Text" },
      "../features/checkin-call/AndroidCallAccessCard": { AndroidCallAccessCard: 'AndroidAccessCard' },
    }
  );
  const render = () => {
    cursor = 0;
    const nodes = [];
    const visit = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (node.type === AppAlertModal) return visit(node.type(node.props));
      nodes.push(node);
      visit(node.props?.children);
    };
    visit(HomeCheckinCallControl({ userId: "7" }));
    return nodes;
  };
  const effects = () => {
    const next = pending;
    pending = [];
    next.forEach((fn) => fn());
  };
  const text = (node) => {
    if (node === null || node === undefined || typeof node === "boolean")
      return "";
    if (Array.isArray(node)) return node.map(text).join(" ");
    return typeof node === "object" ? text(node.props?.children) : String(node);
  };
  const h = {
    render,
    calls,
    server,
    auth,
    t: translations.checkinCall,
    tc: translations.common,
    toggle: () => render().find((node) => node.type === "Switch"),
    modal: () => render().find((node) => node.type === "AppModal"),
    text: () => text(h.modal()),
    button: (key, common = false) => {
      const label = (common ? h.tc : h.t)(key);
      const button = render()
        .filter((node) => node.type === "Button" && text(node).trim().replace(/\s*→$/, "") === label)
        .at(-1);
      assert.ok(button, `Missing button ${key}`);
      return button;
    },
    settle: async () => {
      render();
      effects();
      await flush();
      return render();
    },
    resume: async () => {
      listeners.forEach((listener) => listener("active"));
      return h.settle();
    },
    blur: () => {
      focused = false;
      slots
        .filter((slot) => slot.kind === "focus")
        .forEach((slot) => {
          slot.cleanup?.();
          slot.cleanup = null;
        });
    },
    focus: async () => {
      focused = true;
      slots
        .filter((slot) => slot.kind === "focus")
        .forEach((slot) => {
          slot.cleanup = slot.callback();
        });
      return h.settle();
    },
    unmount: () => {
      focused = false;
      slots.forEach((slot) => slot.cleanup?.());
    },
  };
  return h;
}

for (const language of ["vi", "en"]) {
  await test(`${language}: no relative shows the base warning and still enables after explicit confirmation`, async () => {
    const h = harness({ language, contacts: [] }); await h.settle();
    h.toggle().props.onValueChange(true);
    assert.ok(h.text().includes(h.t("noContactsWarning.title")));
    assert.ok(h.text().includes(h.t("noContactsWarning.body")));
    assert.equal(h.toggle().props.value, false); assert.deepEqual(h.calls.saves, []);
    h.button("homeControl.turnOn").props.onPress();
    assert.deepEqual(h.calls.saves, [], "Queued warning must dismiss before the backend call");
    h.modal().props.onDismiss(); await h.settle();
    assert.equal(h.toggle().props.value, true); assert.deepEqual(h.calls.saves, [true]);
    assert.deepEqual(h.calls.toasts.at(-1), [h.t("homeControl.savedOnTitle"), "success"]);
    assert.equal(h.modal().props.visible, false); h.unmount();
  });
  await test(`${language}: cancelling the no-relative warning preserves the saved switch and permits retry`, async () => {
    const h = harness({ language, contacts: [] }); await h.settle();
    h.toggle().props.onValueChange(true); h.button("cancel", true).props.onPress();
    h.modal().props.onDismiss(); await h.settle();
    assert.equal(h.toggle().props.value, false); assert.deepEqual(h.calls.saves, []);
    assert.deepEqual(h.calls.toasts, []);
    h.toggle().props.onValueChange(true); assert.ok(h.text().includes(h.t("noContactsWarning.title"))); h.unmount();
  });
  await test(`${language}: turning off without relatives never shows the enabling warning`, async () => {
    const h = harness({ language, enabled: true, contacts: [] }); await h.settle();
    h.toggle().props.onValueChange(false);
    assert.ok(!h.text().includes(h.t("noContactsWarning.body")));
    h.button("homeControl.turnOff").props.onPress(); h.modal().props.onDismiss(); await h.settle();
    assert.equal(h.toggle().props.value, false); assert.deepEqual(h.calls.saves, [false]); h.unmount();
  });
  for (const enabled of [true, false]) {
    await test(`${language}: ${
      enabled ? "enable" : "disable"
    } requires confirmation, persists and shows its own result`, async () => {
      const h = harness({ language, enabled: !enabled });
      await h.settle();
      h.toggle().props.onValueChange(enabled);
      assert.equal(h.toggle().props.value, !enabled);
      assert.equal(h.calls.saves.length, 0);
      assert.equal(h.modal().props.visible, true);
      assert.ok(
        h
          .text()
          .includes(h.t(`homeControl.confirm${enabled ? "On" : "Off"}Title`))
      );
      if (!enabled) assert.ok(h.text().includes(h.t("homeControl.offBody")));
      h.button(
        enabled ? "homeControl.turnOn" : "homeControl.turnOff"
      ).props.onPress();
      assert.deepEqual(h.calls.saves, [], "Wait for actual app-modal dismissal before saving or showing a toast");
      h.modal().props.onDismiss();
      await h.settle();
      assert.deepEqual(h.calls.saves, [enabled]);
      assert.equal(h.toggle().props.value, enabled);
      assert.deepEqual(h.calls.toasts.at(-1), [h.t(`homeControl.saved${enabled ? "On" : "Off"}Title`), "success"]);
      assert.equal(h.modal().props.visible, false);
      assert.equal(h.toggle().props.disabled, false);
      h.unmount();
    });
  }
  await test(`${language}: cancelling leaves the saved switch unchanged`, async () => {
    const h = harness({ language });
    await h.settle();
    h.toggle().props.onValueChange(true);
    h.button("cancel", true).props.onPress();
    assert.equal(h.modal().props.visible, false);
    h.modal().props.onDismiss();
    assert.equal(h.toggle().props.value, false);
    assert.deepEqual(h.calls.saves, []);
    h.toggle().props.onValueChange(true);
    assert.equal(h.modal().props.visible, true);
    h.unmount();
  });
}
await test("both modal layouts wrap text, stack large buttons and use safe-area bounded scrolling", async () => {
  const h = harness();
  await h.settle();
  for (const enabled of [true, false]) {
    h.toggle().props.onValueChange(enabled);
    const nodes = h.render();
    const scroll = nodes.find((node) => node.type === "ScrollView");
    assert.equal(scroll.props.style.flexShrink, 1);
    const modalCard = nodes.find(
      (node) => node.type === "Button" && node.props.accessibilityViewIsModal
    );
    assert.equal(modalCard.props.style[1].maxHeight, "85%");
    assert.equal(modalCard.props.style[0].width, "100%");
    const overlay = h.modal().props.children;
    assert.ok(
      overlay.props.style[1].paddingTop > 59 &&
        overlay.props.style[1].paddingBottom > 34
    );
    const actions = modalCard.props.children.at(-1);
    assert.equal(actions.props.style[1].flexDirection, "column");
    for (const button of nodes.filter(
      (node) => node.type === "Button" && typeof node.props.style === "function"
    )) {
      const style = Object.assign(
        {},
        ...button.props.style({ pressed: false }).filter(Boolean)
      );
      assert.ok(style.minHeight >= 48);
      assert.equal(style.width, "100%");
    }
    assert.ok(
      nodes
        .filter((node) => node.type === "Text")
        .every(
          (node) =>
            !node.props.numberOfLines && !node.props.adjustsFontSizeToFit
        )
    );
    h.button("cancel", true).props.onPress();
    h.modal().props.onDismiss();
  }
  h.unmount();
});
await test("the toggle API only patches enabled and cannot overwrite schedule fields", async () => {
  const requests = [];
  const { checkinCallApi } = evaluate(
    read("src/features/checkin-call/checkin-call.api.ts"),
    {
      "../../lib/apiClient": {
        apiClient: (path, options) => {
          requests.push({ path, options });
          return Promise.resolve({ ok: true });
        },
      },
    }
  );
  await checkinCallApi.setEnabled(true);
  await checkinCallApi.setEnabled(false);
  assert.deepEqual(
    requests,
    [true, false].map((enabled) => ({
      path: "/api/mobile/checkin-call/settings",
      options: { method: "PUT", body: { enabled } },
    }))
  );
});
await test("duplicate confirms send only one request; the switch stays disabled during saving", async () => {
  let complete;
  const h = harness({
    save: (enabled, server) =>
      new Promise((resolve) => {
        complete = () =>
          resolve({ ok: true, settings: { ...server.settings, enabled } });
      }),
  });
  await h.settle();
  h.toggle().props.onValueChange(true);
  const press = h.button("homeControl.turnOn").props.onPress;
  press();
  press();
  assert.deepEqual(h.calls.saves, []);
  h.modal().props.onDismiss();
  assert.deepEqual(h.calls.saves, [true]);
  assert.equal(h.toggle().props.disabled, true);
  assert.equal(h.modal().props.visible, false);
  complete();
  await h.settle();
  assert.equal(h.toggle().props.value, true);
  h.unmount();
});
await test("backend rejection never changes the saved switch or shows fake success, and can retry", async () => {
  let rejected = true;
  const h = harness({
    save: async (enabled, server) => {
      if (rejected)
        throw new Error("Enable notifications to receive calls");
      return { ok: true, settings: { ...server.settings, enabled } };
    },
  });
  await h.settle();
  h.toggle().props.onValueChange(true);
  h.button("homeControl.turnOn").props.onPress();
  h.modal().props.onDismiss();
  await h.settle();
  assert.equal(h.toggle().props.value, false);
  assert.deepEqual(h.calls.toasts.at(-1), ["Enable notifications to receive calls", "error", 5000]);
  assert.ok(!h.text().includes("Enable notifications to receive calls"));
  assert.ok(!h.text().includes(h.t("homeControl.savedOnTitle")));
  rejected = false;
  h.toggle().props.onValueChange(true);
  h.button("homeControl.turnOn").props.onPress();
  h.modal().props.onDismiss();
  await h.settle();
  assert.equal(h.toggle().props.value, true);
  h.unmount();
});
await test("explicitly denied call-center permission cannot fall back to isAnTam and plans open after dismissal", async () => {
  const h = harness({
    status: { callCenterEnabled: false, isAnTam: true },
    enabled: true,
  });
  await h.settle();
  assert.equal(h.toggle().props.value, false);
  h.toggle().props.onValueChange(true);
  assert.ok(h.text().includes(h.t("accessRequiredBody")));
  h.button("viewPlans").props.onPress();
  assert.deepEqual(h.calls.pushes, []);
  h.modal().props.onDismiss();
  assert.deepEqual(h.calls.pushes, ["/subscription"]);
  assert.deepEqual(h.calls.saves, []);
  h.unmount();
});
await test("a failed initial load is disabled with a working retry", async () => {
  const h = harness({ status: new Error("Offline") });
  await h.settle();
  assert.equal(h.toggle().props.disabled, true);
  assert.deepEqual(h.calls.toasts.at(-1), ["Offline", "error", 5000]);
  assert.ok(!h.render().some(node => node.type === "Text" && node.props.accessibilityRole === "alert"));
  h.toggle().props.onValueChange(true);
  assert.equal(h.modal().props.visible, false);
  h.server.status = { callCenterEnabled: true };
  h.button("retry", true).props.onPress();
  await h.settle();
  assert.equal(h.toggle().props.disabled, false);
  h.unmount();
});
await test("missing relatives expose working setup navigation without bypassing the backend", async () => {
  const h = harness({ contacts: [] });
  await h.settle();
  h.toggle().props.onValueChange(true);
  assert.ok(h.text().includes(h.t("noContactsWarning.body")));
  h.button("manageCareCircle").props.onPress();
  assert.deepEqual(h.calls.pushes, []);
  h.modal().props.onDismiss();
  assert.deepEqual(h.calls.pushes, ["/care-circle"]);
  assert.deepEqual(h.calls.saves, []);
  h.unmount();
});
await test("settings changes refresh on return and foreground", async () => {
  const h = harness();
  await h.settle();
  h.blur();
  h.server.settings.enabled = true;
  await h.focus();
  assert.equal(h.toggle().props.value, true);
  h.server.settings.enabled = false;
  await h.resume();
  assert.equal(h.toggle().props.value, false);
  h.unmount();
});
await test("returning while a save is pending cannot strand the control in a loading state", async () => {
  let complete;
  const h = harness({
    save: (enabled, server) =>
      new Promise((resolve) => {
        complete = () =>
          resolve({ ok: true, settings: { ...server.settings, enabled } });
      }),
  });
  await h.settle();
  h.toggle().props.onValueChange(true);
  h.button("homeControl.turnOn").props.onPress();
  h.modal().props.onDismiss();
  h.blur();
  await h.focus();
  complete();
  await h.settle();
  assert.equal(h.toggle().props.value, true);
  assert.equal(h.toggle().props.disabled, false);
  h.unmount();
});
await test("late loads from another account and unmounted saves cannot write UI state", async () => {
  let loaded;
  const h = harness({
    load: (server) =>
      new Promise((resolve) => {
        loaded = () => resolve({ ok: true, settings: server.settings });
      }),
  });
  await h.settle();
  h.auth.profile = { id: "8" };
  const writes = h.calls.stateWrites;
  loaded();
  await flush();
  assert.equal(h.calls.stateWrites, writes);
  h.unmount();
  let complete;
  const h2 = harness({
    save: (enabled, server) =>
      new Promise((resolve) => {
        complete = () =>
          resolve({ ok: true, settings: { ...server.settings, enabled } });
      }),
  });
  await h2.settle();
  h2.toggle().props.onValueChange(true);
  h2.button("homeControl.turnOn").props.onPress();
  h2.modal().props.onDismiss();
  h2.unmount();
  const before = h2.calls.stateWrites;
  complete();
  await flush();
  assert.equal(h2.calls.stateWrites, before);
  assert.deepEqual(h2.calls.toasts, []);
});

await test("large-font no-relative warnings stay centered, scroll and keep three full-width app buttons", async () => {
  for (const language of ["vi", "en"]) {
    const h = harness({ language, contacts: [], fontSize: 26 }); await h.settle();
    h.toggle().props.onValueChange(true);
    const nodes = h.render(); const overlay = h.modal().props.children;
    assert.equal(overlay.props.style[0].alignItems, "center");
    assert.equal(overlay.props.style[0].justifyContent, "center");
    assert.equal(overlay.props.style[1].paddingTop, 79); assert.equal(overlay.props.style[1].paddingBottom, 54);
    assert.ok(nodes.some(node => node.type === "ScrollView" && node.props.style.flexShrink === 1));
    const actions = nodes.filter(node => node.type === "Button" && typeof node.props.style === "function");
    assert.equal(actions.length, 3);
    for (const action of actions) {
      const style = Object.assign({}, ...action.props.style({ pressed: false }).filter(Boolean));
      assert.equal(style.width, "100%"); assert.ok(style.minHeight >= 48);
      const label = React.Children.toArray(action.props.children).find(node => node.type === "Text");
      assert.ok(label, "Each alert action must retain its text label");
      assert.equal(label.props.numberOfLines, undefined);
      assert.equal(label.props.style[0].fontSize, 26); assert.equal(label.props.style[0].textAlign, "center");
    }
    h.unmount();
  }
});
await test("a queued warning action cannot save or toast for an unmounted account", async () => {
  const h = harness({ contacts: [] }); await h.settle();
  h.toggle().props.onValueChange(true); h.button("homeControl.turnOn").props.onPress();
  const dismiss = h.modal().props.onDismiss; h.auth.profile = { id: "8" }; h.unmount();
  dismiss(); await flush(); assert.deepEqual(h.calls.saves, []); assert.deepEqual(h.calls.toasts, []);
});

assert.match(
  read("app/(tabs)/home/index.tsx"),
  /<HomeCheckinCallControl key=\{profile\.id\} userId=\{String\(profile\.id\)\}/,
  "Home must mount account-scoped call controls"
);
console.log(
  `Home check-in call control: ${checks} runtime regressions passed.`
);
