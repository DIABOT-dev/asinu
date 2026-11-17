import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (file) => fs.readFileSync(file, "utf8");
function evaluate(source, imports = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const jsx = (type, props) => ({ type, props });
  new Function("module", "exports", "require", output)(
    module,
    module.exports,
    (name) => {
      if (name === "react/jsx-runtime")
        return { jsx, jsxs: jsx, Fragment: "Fragment" };
      assert.ok(name in imports, `Missing field-sheet adapter ${name}`);
      return imports[name];
    }
  );
  return module.exports;
}
const theme = evaluate(read("src/styles/theme.ts"));
const administrative = evaluate(
  read("src/features/profile/administrative-units.ts"),
  {
    "./data/vietnam-administrative-units.json": JSON.parse(
      read("src/features/profile/data/vietnam-administrative-units.json")
    ),
  }
);
const fields = evaluate(read("src/features/profile/profile-fields.ts"), {
  "./administrative-units": administrative,
});
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (tree?.type === "FlatList")
    return [
      tree,
      ...nodes(
        tree.props.data.map((item, index) =>
          tree.props.renderItem({ item, index })
        )
      ),
    ];
  return tree && typeof tree === "object"
    ? [tree, ...nodes(tree.props?.children)]
    : [];
}
const text = (tree) =>
  Array.isArray(tree)
    ? tree.map(text).join(" ")
    : tree && typeof tree === "object"
    ? text(tree.props?.children)
    : String(tree ?? "");
const flush = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};
class ApiError extends Error {
  constructor(statusCode) {
    super("fixture");
    this.statusCode = statusCode;
  }
}
function harness(
  field,
  {
    language = "vi",
    isDark = false,
    profile: patch = {},
    update,
    local = false,
    birthYearOnly,
    allowEmptyPhone = false,
  } = {}
) {
  const profile = {
    id: "7",
    name: "Nguyễn Minh An",
    phone: "0912345678",
    gender: "Nam",
    dateOfBirth: "1986-04-23",
    heightCm: 170,
    weightKg: 70,
    bloodType: "A+",
    chronicDiseases: ["Hen suyễn"],
    address: null,
    ...patch,
  };
  let authProfile = profile,
    cursor = 0,
    pending = [],
    closed = 0,
    changed = false;
  const slots = [],
    cleanups = [],
    calls = { updates: [], writes: [], toasts: [], confirmations: [] };
  const translate = (namespace) => {
    const catalog = JSON.parse(
      read(`src/i18n/locales/${language}/${namespace}.json`)
    );
    return (key) => catalog[key] ?? key;
  };
  const hooks = {
    useState(initial) {
      const position = cursor++;
      if (!(position in slots))
        slots[position] = typeof initial === "function" ? initial() : initial;
      return [
        slots[position],
        (value) => {
          const next =
            typeof value === "function" ? value(slots[position]) : value;
          if (!Object.is(slots[position], next)) {
            slots[position] = next;
            changed = true;
          }
        },
      ];
    },
    useRef(initial) {
      const position = cursor++;
      return (slots[position] ??= { current: initial });
    },
    useMemo: (fn) => fn(),
    useEffect(effect, dependencies) {
      const position = cursor++;
      if (
        !slots[position] ||
        dependencies.some(
          (value, index) => !Object.is(value, slots[position][index])
        )
      ) {
        slots[position] = dependencies;
        pending.push(effect);
      }
    },
  };
  const useAuthStore = {
    getState: () => ({ profile: authProfile }),
    setState: (value) => {
      authProfile = value.profile;
      calls.writes.push(value.profile);
    },
  };
  const imports = {
    react: hooks,
    "react-native": {
      ...Object.fromEntries(
        [
          "ActivityIndicator",
          "FlatList",
          "KeyboardAvoidingView",
          "Modal",
          "Pressable",
          "ScrollView",
          "View",
        ].map((name) => [name, name])
      ),
      Platform: { OS: "ios" },
      Linking: { openURL: async () => {} },
      StyleSheet: { create: (value) => value, hairlineWidth: 1 / 3 },
    },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "@quidone/react-native-wheel-picker": {
      __esModule: true,
      default: "WheelPicker",
    },
    "react-i18next": { useTranslation: (ns) => ({ t: translate(ns) }) },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ bottom: 34 }),
    },
    "../../components/ScaledText": { ScaledText: "Text" },
    "../../components/ScaledTextInput": { ScaledTextInput: "TextInput" },
    "../../components/GlobalToastHost": { ModalToastHost: "ModalToastHost" },
    "../../hooks/useThemeColors": {
      useThemeColors: () => ({
        isDark,
        colors: isDark ? theme.darkColors : theme.lightColors,
      }),
    },
    "../../hooks/useScaledTypography": {
      useScaledTypography: () => ({ scaledSize: { lg: 20 } }),
    },
    "../auth/auth.api": {
      authApi: {
        updateProfile: async (payload) => {
          calls.updates.push(payload);
          return update ? update(payload) : { ...authProfile, ...payload };
        },
      },
    },
    "../auth/auth.store": { useAuthStore },
    "../../lib/apiClient": {
      ApiError,
      getApiErrorMessage: (_error, t, key) => t(key),
    },
    "../../stores/toast.store": {
      showToast: (...args) => calls.toasts.push(args),
    },
    "./profile-fields": fields,
    "./administrative-units": administrative,
    "./MeasurementRuler": { MeasurementRuler: "MeasurementRuler" },
  };
  const { ProfileFieldSheet } = evaluate(
    read("src/features/profile/ProfileFieldSheet.tsx"),
    imports
  );
  const render = () => {
    let tree,
      count = 0;
    do {
      changed = false;
      cursor = 0;
      tree = ProfileFieldSheet({
        field,
        profile,
        onClose: () => {
          closed++;
        },
        onConfirm: local
          ? (update) => calls.confirmations.push(update)
          : undefined,
        birthYearOnly,
        allowEmptyPhone,
      });
      const effects = pending;
      pending = [];
      for (const effect of effects) {
        const cleanup = effect();
        if (typeof cleanup === "function") cleanups.push(cleanup);
      }
      assert.ok(++count < 10);
    } while (changed);
    return tree;
  };
  const button = (label) =>
    nodes(render()).find(
      (node) =>
        node.type === "Pressable" && node.props.accessibilityLabel === label
    );
  const saveButton = () => button(translate("common")("save"));
  const input = (label) =>
    nodes(render()).find(
      (node) =>
        node.type === "TextInput" &&
        (!label || node.props.accessibilityLabel === label)
    );
  return {
    render,
    calls,
    input,
    button,
    saveButton,
    t: translate("profile"),
    tc: translate("common"),
    change: (value) => {
      const control = input();
      if (control) control.props.onChangeText(value);
      else
        nodes(render())
          .find((node) => node.type === "MeasurementRuler")
          .props.onChange(Number(value));
    },
    measurement: () =>
      nodes(render()).find((node) => node.type === "MeasurementRuler"),
    choose: (label) =>
      nodes(render())
        .find(
          (node) =>
            ["radio", "checkbox"].includes(node.props.accessibilityRole) &&
            node.props.accessibilityLabel === label
        )
        .props.onPress(),
    wheel: (part) =>
      nodes(render()).find(
        (node) => node.props.testID === `profile-date-${part}`
      ),
    save: async () => {
      saveButton().props.onPress();
      await flush();
    },
    close: () => button(translate("common")("close")).props.onPress(),
    owner: (value) => {
      authProfile = { ...authProfile, id: value };
    },
    unmount: () => {
      cleanups.forEach((cleanup) => cleanup());
    },
    get closed() {
      return closed;
    },
  };
}
let checks = 0;
async function test(label, run) {
  await run();
  checks++;
  console.log(`PASS ${label}`);
}

for (const language of ["vi", "en"])
  for (const isDark of [false, true]) {
    for (const field of Object.keys(fields.PROFILE_FIELD_LABELS)) {
      await test(`${language}/${
        isDark ? "dark" : "light"
      }/${field}: a fresh sheet cannot save or expose another field`, async () => {
        const h = harness(field, { language, isDark });
        assert.equal(h.saveButton().props.disabled, true);
        assert.equal(
          nodes(h.render()).find(
            (node) => node.props.accessibilityRole === "header"
          ).props.children,
          h.t(fields.PROFILE_FIELD_LABELS[field])
        );
        const inputs = nodes(h.render()).filter(
          (node) => node.type === "TextInput"
        );
        assert.equal(
          inputs.length,
          [
            "gender",
            "dateOfBirth",
            "bloodType",
            "heightCm",
            "weightKg",
          ].includes(field)
            ? 0
            : 1
        );
        if (
          inputs.length === 1 &&
          !["chronicDiseases", "address"].includes(field)
        )
          assert.equal(
            inputs[0].props.accessibilityLabel,
            h.t(fields.PROFILE_FIELD_LABELS[field])
          );
        await h.save();
        assert.deepEqual(h.calls.updates, []);
      });
    }
    await test(`${language}/${
      isDark ? "dark" : "light"
    }: name save changes only name and preserves the exact birthday`, async () => {
      const h = harness("name", { language, isDark });
      h.change("  Minh Anh  ");
      await h.save();
      assert.deepEqual(h.calls.updates, [{ name: "Minh Anh" }]);
      assert.equal(h.calls.writes[0].dateOfBirth, "1986-04-23");
      assert.equal(h.closed, 1);
    });
    await test(`${language}/${
      isDark ? "dark" : "light"
    }: gender uses canonical values without mutating the saved selection before Save`, async () => {
      const h = harness("gender", { language, isDark });
      h.choose(h.tc("female"));
      assert.deepEqual(h.calls.updates, []);
      await h.save();
      assert.deepEqual(h.calls.updates, [{ gender: "Nữ" }]);
    });
  }
for (const [field, value, key] of [
  ["name", " ", "nameRequired"],
  ["phone", "12", "phoneInvalid"],
  ["heightCm", "0", "heightPositive"],
  ["weightKg", "-1", "weightPositive"],
]) {
  await test(`${field}: invalid values cannot send a write`, async () => {
    const h = harness(field);
    h.change(value);
    await h.save();
    assert.equal(h.saveButton().props.disabled, true);
    assert.deepEqual(h.calls.updates, []);
    assert.ok(text(h.render()).includes(h.t(key)));
  });
}
await test("phone update sends only the phone and retains a conflict for correction", async () => {
  let conflict = true;
  const h = harness("phone", {
    update: async (payload) => {
      if (conflict) throw new ApiError(409);
      return { id: "7", ...payload };
    },
  });
  h.change("0987654321");
  await h.save();
  assert.equal(h.closed, 0);
  assert.ok(text(h.render()).includes(h.t("phoneAlreadyUsed")));
  conflict = false;
  await h.save();
  assert.deepEqual(h.calls.updates, [
    { phone: "0987654321" },
    { phone: "0987654321" },
  ]);
  assert.equal(h.closed, 1);
});
await test("Cancel blocks a queued Save and reopening starts from persisted values", async () => {
  const h = harness("name");
  h.change("Unsaved");
  const stale = h.saveButton().props.onPress;
  h.close();
  stale();
  await flush();
  assert.deepEqual(h.calls.updates, []);
  assert.equal(h.closed, 1);
  assert.equal(harness("name").input().props.value, "Nguyễn Minh An");
});
await test("a double Save sends once and cannot dismiss or change a pending request", async () => {
  let finish;
  const h = harness("name", {
    update: (payload) =>
      new Promise((resolve) => {
        finish = () => resolve({ id: "7", ...payload });
      }),
  });
  h.change("New name");
  const stale = h.saveButton().props.onPress;
  stale();
  stale();
  await flush();
  h.change("Another name");
  h.close();
  assert.equal(h.closed, 0);
  assert.equal(h.calls.updates.length, 1);
  assert.equal(h.input().props.value, "New name");
  assert.equal(h.saveButton().props.accessibilityState.busy, true);
  finish();
  await flush();
  assert.equal(h.closed, 1);
});
for (const outcome of ["unmount", "account-change", "wrong-response"])
  await test(`${outcome}: a late response cannot replace another account`, async () => {
    let finish;
    const h = harness("name", {
      update: (payload) =>
        new Promise((resolve) => {
          finish = () =>
            resolve({
              id: outcome === "wrong-response" ? "8" : "7",
              ...payload,
            });
        }),
    });
    h.change("New name");
    await h.save();
    if (outcome === "unmount") h.unmount();
    if (outcome === "account-change") h.owner("8");
    finish();
    await flush();
    assert.deepEqual(h.calls.writes, []);
    assert.equal(h.closed, 0);
  });
await test("a network failure retains the field draft and allows a deliberate retry", async () => {
  let fail = true;
  const h = harness("name", {
    update: async (payload) => {
      if (fail) throw new Error("network");
      return { id: "7", ...payload };
    },
  });
  h.change("New name");
  await h.save();
  assert.equal(h.closed, 0);
  assert.equal(h.input().props.value, "New name");
  assert.equal(h.saveButton().props.disabled, false);
  fail = false;
  await h.save();
  assert.equal(h.closed, 1);
});
await test("date wheels preserve the chosen date, clamp leap days and wait for scrolling to finish", async () => {
  const h = harness("dateOfBirth");
  const change = (part, value) =>
    h.wheel(part).props.onValueChanged({ item: { value } });
  change("year", 2000);
  change("month", 2);
  change("day", 29);
  const stale = h.saveButton().props.onPress;
  h.wheel("day").props._onScrollStart();
  stale();
  await flush();
  assert.deepEqual(h.calls.updates, []);
  h.wheel("day").props._onScrollEnd();
  await h.save();
  assert.deepEqual(h.calls.updates, [{ dateOfBirth: "2000-02-29" }]);
  assert.equal(
    fields.changeBirthDate("2000-02-29", "year", 2001),
    "2001-02-28"
  );
  assert.equal(fields.validBirthDate("2025-02-29"), false);
  assert.equal(fields.validBirthDate("3000-01-01"), false);
});
await test("an unknown birthday needs an explicit wheel selection", async () => {
  const h = harness("dateOfBirth", { profile: { dateOfBirth: null } });
  await h.save();
  assert.deepEqual(h.calls.updates, []);
  h.wheel("year").props.onValueChanged({ item: { value: 1980 } });
  await h.save();
  assert.deepEqual(h.calls.updates, [{ dateOfBirth: "1980-01-01" }]);
});
for (const value of ["", ...fields.BLOOD_TYPES])
  await test(`blood type ${
    value || "unknown"
  } saves its canonical value by itself`, async () => {
    const h = harness("bloodType", { profile: { bloodType: "legacy" } });
    h.choose(value || h.t("bloodTypeUnknown"));
    await h.save();
    assert.deepEqual(h.calls.updates, [{ bloodType: value || null }]);
  });
await test("condition choices preserve custom values and do not save unconfirmed text", async () => {
  const h = harness("chronicDiseases", {
    profile: { chronicDiseases: ["Hen suyễn", "Viêm khớp"] },
  });
  h.choose(h.t("diseaseDiabetes"));
  h.choose("Viêm khớp");
  h.input().props.onChangeText("Thiếu máu, Thiếu máu");
  h.button(h.t("addCustomDisease")).props.onPress();
  await h.save();
  assert.deepEqual(h.calls.updates, [
    { chronicDiseases: ["Hen suyễn", "Tiểu đường", "Thiếu máu"] },
  ]);
});
await test("equivalent whitespace, numeric formatting and condition ordering cannot enable Save", async () => {
  const name = harness("name");
  name.change("  Nguyễn Minh An ");
  assert.equal(name.saveButton().props.disabled, true);
  const height = harness("heightCm");
  height.change("170.0");
  assert.equal(height.saveButton().props.disabled, true);
  const conditions = harness("chronicDiseases");
  conditions.choose(conditions.t("diseaseAsthma"));
  conditions.choose(conditions.t("diseaseAsthma"));
  assert.equal(conditions.saveButton().props.disabled, true);
});
const selectAddress = (h, provinceCode, wardCode) => {
  const province = administrative.administrativeProvinces.find(
    (item) => item.code === provinceCode
  );
  const ward = province.wards.find((item) => item.code === wardCode);
  h.button(h.t("province")).props.onPress();
  h.button(province.name).props.onPress();
  h.button(h.t("ward")).props.onPress();
  h.button(ward.name).props.onPress();
};
await test("the post-merger catalog has unique codes and a valid parent for every ward", () => {
  const provinces = administrative.administrativeProvinces;
  assert.equal(provinces.length, 34);
  assert.equal(
    provinces.reduce((sum, province) => sum + province.wards.length, 0),
    3321
  );
  assert.equal(
    new Set(
      provinces.flatMap((province) => province.wards.map((ward) => ward.code))
    ).size,
    3321
  );
  assert.ok(
    provinces.every(
      (province) =>
        /^\d{2}$/.test(province.code) &&
        province.wards.every((ward) => /^\d{5}$/.test(ward.code))
    )
  );
});
await test("a complete address round trip sends codes and canonical names in one field", async () => {
  const address = {
    provinceCode: "01",
    province: "Thành phố Hà Nội",
    wardCode: "00004",
    ward: "Phường Ba Đình",
    street: "12 Phố A",
  };
  const h = harness("address");
  selectAddress(h, "01", "00004");
  h.input(h.t("street")).props.onChangeText(address.street);
  await h.save();
  assert.deepEqual(h.calls.updates, [{ address }]);
  assert.deepEqual(h.calls.writes[0].address, address);
  const clear = harness("address", { profile: { address } });
  clear.button(clear.t("clearAddress")).props.onPress();
  await clear.save();
  assert.deepEqual(clear.calls.updates, [{ address: null }]);
});
await test("wards are disabled before province selection and changing province clears the prior ward", async () => {
  const h = harness("address");
  const ward = h.button(h.t("ward"));
  assert.equal(ward.props.disabled, true);
  ward.props.onPress();
  assert.equal(h.button(h.tc("back")), undefined);
  selectAddress(h, "01", "00004");
  h.input(h.t("street")).props.onChangeText("12 Phố A");
  assert.equal(h.saveButton().props.disabled, false);
  h.button(h.t("province")).props.onPress();
  h.button("Thành phố Hồ Chí Minh").props.onPress();
  assert.equal(h.saveButton().props.disabled, true);
  assert.ok(text(h.button(h.t("ward"))).includes(h.t("wardPlaceholder")));
  h.button(h.t("ward")).props.onPress();
  assert.ok(
    !nodes(h.render()).some(
      (node) =>
        node.type === "Pressable" &&
        node.props.accessibilityLabel === "Phường Ba Đình"
    )
  );
});
await test("province search ignores Vietnamese accents and selection stays local until Save", () => {
  const h = harness("address");
  h.button(h.t("province")).props.onPress();
  h.input(h.t("searchAddress")).props.onChangeText("ha noi");
  const options = nodes(h.render()).find((node) => node.type === "FlatList")
    .props.data;
  assert.deepEqual(
    options.map((option) => option.code),
    ["01"]
  );
  assert.deepEqual(h.calls.updates, []);
});
for (const [field, value] of [
  ["heightCm", 171],
  ["weightKg", 70.5],
])
  await test(
    field +
      ": the horizontal ruler changes only its measurement and blocks Save while moving",
    async () => {
      const h = harness(field);
      assert.ok(h.measurement());
      assert.equal(h.input(), undefined);
      h.measurement().props.onChange(value);
      const stale = h.saveButton().props.onPress;
      h.measurement().props.onInteractionChange(true);
      stale();
      await flush();
      assert.deepEqual(h.calls.updates, []);
      h.measurement().props.onInteractionChange(false);
      await h.save();
      assert.deepEqual(h.calls.updates, [{ [field]: value }]);
    }
  );

await test("the province picker is a tall searchable alphabetical sheet and back preserves the address draft", () => {
  const h = harness("address");
  h.input(h.t("street")).props.onChangeText("12 Phố A");
  h.button(h.t("province")).props.onPress();
  assert.equal(
    nodes(h.render()).find((node) => node.props.accessibilityRole === "header")
      .props.children,
    h.t("selectProvinceTitle")
  );
  const list = nodes(h.render()).find((node) => node.type === "FlatList");
  assert.deepEqual(
    list.props.data
      .slice(0, 3)
      .map((item) => administrative.provinceDisplayName(item.name)),
    ["An Giang", "Bắc Ninh", "Cà Mau"]
  );
  assert.equal(h.saveButton(), undefined);
  h.button(h.tc("back")).props.onPress();
  assert.equal(h.input(h.t("street")).props.value, "12 Phố A");
  assert.deepEqual(h.calls.updates, []);
});
await test("onboarding confirms a local measurement without changing the server or signed-in profile", async () => {
  const h = harness("weightKg", { local: true });
  h.owner("another-account");
  h.change("70.5");
  await h.save();
  assert.deepEqual(h.calls.confirmations, [{ weightKg: 70.5 }]);
  assert.deepEqual(h.calls.updates, []);
  assert.deepEqual(h.calls.writes, []);
  assert.deepEqual(h.calls.toasts, []);
  assert.equal(h.closed, 1);
});
await test("onboarding birth year uses one bounded wheel, and cancelling cannot confirm it", async () => {
  const limits = { min: 1920, max: new Date().getFullYear() - 10 };
  const h = harness("dateOfBirth", {
    local: true,
    birthYearOnly: limits,
    profile: { dateOfBirth: null },
  });
  assert.equal(h.wheel("day"), undefined);
  assert.equal(h.wheel("month"), undefined);
  const years = h.wheel("year").props.data;
  assert.equal(years[0].value, limits.max);
  assert.equal(years.at(-1).value, limits.min);
  h.wheel("year").props.onValueChanged({ item: { value: 1990 } });
  await h.save();
  assert.deepEqual(h.calls.confirmations, [{ dateOfBirth: "1990-01-01" }]);
  assert.deepEqual(h.calls.updates, []);
  const cancelled = harness("dateOfBirth", {
    local: true,
    birthYearOnly: limits,
  });
  cancelled.wheel("year").props.onValueChanged({ item: { value: 1991 } });
  const stale = cancelled.saveButton().props.onPress;
  cancelled.close();
  stale();
  await flush();
  assert.deepEqual(cancelled.calls.confirmations, []);
});
await test("onboarding retains the existing Other gender option with the same canonical value", async () => {
  const h = harness("gender", { local: true });
  h.choose(h.t("genderOther"));
  await h.save();
  assert.deepEqual(h.calls.confirmations, [{ gender: "Khác" }]);
  assert.deepEqual(h.calls.updates, []);
});

await test("an optional onboarding phone can be cleared locally while the saved profile phone still validates", async () => {
  const h = harness("phone", { local: true, allowEmptyPhone: true });
  h.change("");
  await h.save();
  assert.deepEqual(h.calls.confirmations, [{ phone: "" }]);
  assert.deepEqual(h.calls.updates, []);
  const saved = harness("phone", { allowEmptyPhone: true });
  saved.change("");
  await saved.save();
  assert.deepEqual(saved.calls.updates, []);
  assert.equal(saved.saveButton().props.disabled, true);
});

console.log(`Personal field sheets: ${checks} runtime checks passed.`);
