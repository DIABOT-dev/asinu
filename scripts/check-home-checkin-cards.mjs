import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (file) => fs.readFileSync(file, "utf8");
const flatten = (style) =>
  Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean).map(flatten))
    : style ?? {};
const jsx = (type, props) => ({ type, props });

function evaluate(source, dependencies) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  // Exercise the actual JSX, text scaling and button handlers with native adapters.
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", output)(
    module,
    module.exports,
    (id) => {
      assert.ok(id in dependencies, `Missing adapter: ${id}`);
      return dependencies[id];
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
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

function harness({
  language = "vi",
  isDark = false,
  multiplier = 1,
  session = null,
  fail = false,
} = {}) {
  let cursor = 0;
  const slots = [];
  let focus;
  const pushes = [];
  const catalog = JSON.parse(read(`src/i18n/locales/${language}/home.json`));
  const t = (key) => {
    assert.equal(
      typeof catalog[key],
      "string",
      `${language}:${key} must be translated`
    );
    return catalog[key];
  };
  const native = {
    Text: "Text",
    View: "View",
    Pressable: "Pressable",
    Platform: { OS: "ios" },
    StyleSheet: { create: (styles) => styles, flatten },
  };
  const typography = { size: { xs: 13, sm: 15, md: 18, lg: 22, xl: 30 } };
  const colors = {
    surface: isDark ? "#18181b" : "#fefefe",
    border: "#eeeeef",
    primary: "#08b8a2",
    primaryLight: isDark ? "#0f2b28" : "#e6faf8",
    premiumDark: isDark ? "#f59e0b" : "#d97706",
    premiumLight: isDark ? "#3b2e10" : "#fef3c7",
    textPrimary: isDark ? "#f0f0f5" : "#221f1f",
    textSecondary: isDark ? "#b2b2ba" : "#656565",
  };
  const { ScaledText } = evaluate(read("src/components/ScaledText.tsx"), {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": native,
    "../hooks/useScaledTypography": {
      useScaledFontSize: (size) => Math.round(size * multiplier),
    },
  });
  const hooks = {
    memo: (component) => component,
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useState: (initial) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (value) => {
          slots[index] = value;
        },
      ];
    },
  };
  const components = evaluate(read("src/components/DailyCheckinCard.tsx"), {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { __esModule: true, default: hooks, ...hooks },
    "react-native": native,
    "expo-router": {
      useFocusEffect: (callback) => {
        focus = callback;
      },
    },
    "@/hooks/useGuardedRouter": {
      useGuardedRouter: () => ({ push: (value) => pushes.push(value) }),
    },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "react-i18next": { useTranslation: () => ({ t }) },
    "./ScaledText": { ScaledText },
    "../hooks/useScaledTypography": { useScaledTypography: () => typography },
    "../hooks/useThemeColors": { useThemeColors: () => ({ isDark }) },
    "../styles": {
      colors,
      radius: { lg: 16, xl: 20 },
      spacing: { xs: 4, md: 12, lg: 16, xxl: 28 },
    },
    "../features/checkin/checkin.api": {
      checkinApi: {
        getToday: () =>
          fail
            ? Promise.reject(new Error("offline"))
            : Promise.resolve({ session }),
      },
    },
  });
  const render = (name) => {
    cursor = 0;
    const nodes = [];
    const visit = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (typeof node.type === "function") return visit(node.type(node.props));
      nodes.push(node);
      visit(node.props?.children);
    };
    visit(components[name]());
    return nodes;
  };
  return {
    render,
    t,
    pushes,
    colors,
    focus: async () => {
      focus();
      await flush();
    },
  };
}

for (const language of ["vi", "en"]) {
  for (const isDark of [false, true]) {
    for (const multiplier of [1, 1.6]) {
      await test(`${language}, ${
        isDark ? "dark" : "light"
      }, font ${multiplier}: larger wrapping cards keep their actions`, async () => {
        const h = harness({ language, isDark, multiplier });
        assert.deepEqual(h.render("DailyCheckinCard"), []);
        await h.focus();
        for (const [name, label, fontSize, route] of [
          [
            "DailyCheckinCard",
            "checkinFine",
            30,
            { pathname: "/checkin", params: { preset_status: "fine" } },
          ],
          [
            "InstantCheckinCard",
            "checkinInstantTitle",
            26,
            { pathname: "/checkin", params: { mode: "random" } },
          ],
        ]) {
          const nodes = h.render(name);
          const button = nodes.find((node) => node.type === "Pressable");
          assert.equal(button.props.accessibilityRole, "button");
          assert.equal(button.props.accessibilityLabel, h.t(label));
          const style = flatten(button.props.style({ pressed: false }));
          assert.ok(style.minHeight >= 184);
          assert.ok(style.paddingVertical >= 28);
          assert.equal(
            style.height,
            undefined,
            "cards must grow with wrapping content"
          );
          assert.notEqual(style.overflow, "hidden");
          assert.equal(
            flatten(button.props.style({ pressed: true })).opacity,
            0.9
          );
          const column = nodes.find(
            (node) => node.type === "View" && node.props.style?.flex === 1
          );
          assert.equal(column.props.style.minWidth, 0);
          const title = nodes.find(
            (node) => node.type === "Text" && node.props.children === h.t(label)
          );
          assert.ok(title);
          assert.equal(
            flatten(title.props.style).fontSize,
            Math.round(fontSize * multiplier)
          );
          assert.equal(flatten(title.props.style).color, h.colors.textPrimary);
          for (const text of nodes.filter((node) => node.type === "Text")) {
            assert.equal(
              text.props.numberOfLines,
              undefined,
              "never truncate the action or description"
            );
            assert.ok(
              !text.props.adjustsFontSizeToFit,
              "never shrink text to fit"
            );
            assert.ok(
              flatten(text.props.style).lineHeight >=
                flatten(text.props.style).fontSize * 1.49
            );
          }
          assert.ok(
            nodes.some((node) => node.type === "Icon" && node.props.size >= 48)
          );
          button.props.onPress();
          assert.deepEqual(h.pushes.at(-1), route);
        }
      });
    }
  }
}

await test("the new abnormal-symptom wording and onboarding guide agree in both languages", () => {
  for (const [language, expected] of [
    ["vi", "Tôi có dấu hiệu bất thường"],
    ["en", "I'm noticing unusual symptoms"],
  ]) {
    const catalog = JSON.parse(read(`src/i18n/locales/${language}/home.json`));
    assert.equal(catalog.checkinInstantTitle, expected);
    assert.ok(catalog.checkinGuide.slide3Desc.includes(expected));
  }
});

const active = {
  id: "demo-session",
  initial_status: "tired",
  triage_completed_at: "2026-10-01T08:00:00Z",
};
for (const [label, session, visible] of [
  [
    "resolved sessions stay hidden",
    { ...active, resolved_at: "2026-10-01T09:00:00Z" },
    false,
  ],
  [
    "scheduled follow-ups are hidden until due",
    { ...active, next_checkin_at: "2099-01-01T09:00:00Z" },
    false,
  ],
  [
    "overdue follow-ups can still be continued",
    { ...active, next_checkin_at: "2000-01-01T09:00:00Z" },
    true,
  ],
  [
    "incomplete triage can be continued before the next reminder",
    {
      ...active,
      triage_completed_at: null,
      next_checkin_at: "2099-01-01T09:00:00Z",
    },
    true,
  ],
  [
    "high-alert follow-up copy is preserved",
    { ...active, flow_state: "high_alert" },
    true,
  ],
]) {
  await test(label, async () => {
    const h = harness({ session });
    h.render("DailyCheckinCard");
    await h.focus();
    const nodes = h.render("DailyCheckinCard");
    assert.equal(nodes.length > 0, visible);
    if (visible) {
      nodes.find((node) => node.type === "Pressable").props.onPress();
      assert.equal(
        h.pushes.at(-1),
        "/checkin?mode=followup&checkin_id=demo-session"
      );
      const key =
        session.flow_state === "high_alert"
          ? "checkinFollowHighAlert"
          : "checkinFollowDefault";
      assert.ok(
        nodes.some(
          (node) => node.type === "Text" && node.props.children === h.t(key)
        )
      );
    }
    assert.ok(
      h.render("InstantCheckinCard").some((node) => node.type === "Pressable"),
      "immediate entry stays available"
    );
  });
}

await test("a failed session refresh still leaves both check-in entries usable", async () => {
  const h = harness({ fail: true });
  h.render("DailyCheckinCard");
  await h.focus();
  for (const name of ["DailyCheckinCard", "InstantCheckinCard"]) {
    h.render(name)
      .find((node) => node.type === "Pressable")
      .props.onPress();
  }
  assert.equal(h.pushes.length, 2);
});

console.log(`Home check-in cards: ${checks} regressions passed.`);
