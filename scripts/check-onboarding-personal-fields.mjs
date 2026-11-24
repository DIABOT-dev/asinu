import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync("app/onboarding/index.tsx", "utf8");
const ast = ts.createSourceFile(
  "onboarding.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
const step = ast.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "Step1"
);
assert.ok(step);
const output = ts.transpileModule(step.getText(ast) + "\nexport { Step1 };", {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
const nodes = (tree) =>
  Array.isArray(tree)
    ? tree.flatMap(nodes)
    : tree && typeof tree === "object"
    ? [tree, ...nodes(tree.props?.children)]
    : [];
function harness(apple = false) {
  let selected = null;
  const calls = [];
  const state = {
    fullName: "Minh An",
    birthYear: "1986",
    gender: "Nam",
    height: "170",
    weight: "70.5",
    phone: "",
    bloodType: "A+",
    consentAccepted: true,
  };
  const catalog = JSON.parse(
    fs.readFileSync("src/i18n/locales/vi/onboarding.json")
  );
  const globals = {
    useTranslation: () => ({ t: (key) => catalog[key] ?? key }),
    useState: () => [
      selected,
      (next) => {
        selected = next;
      },
    ],
    CURRENT_YEAR: new Date().getFullYear(),
    SectionLabel: "SectionLabel",
    ProfileFieldSheet: "ProfileFieldSheet",
    View: "View",
    Pressable: "Pressable",
    Text: "Text",
    Ionicons: "Icon",
    stepStyles: {},
    Linking: { openURL() {} },
    TERMS_URL: "https://asinu.vn/terms",
    PRIVACY_URL: "https://asinu.vn/privacy",
  };
  const module = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  new Function("module", "exports", "require", ...Object.keys(globals), output)(
    module,
    module.exports,
    () => ({ jsx, jsxs: jsx }),
    ...Object.values(globals)
  );
  const props = {
    isAppleSignIn: apple,
    birthYearError: "",
    heightError: "",
    weightError: "",
    phoneError: "",
  };
  for (const key of Object.keys(state))
    props["set" + key[0].toUpperCase() + key.slice(1)] = (value) => {
      state[key] = value;
      calls.push({ [key]: value });
    };
  const render = () => module.exports.Step1({ ...props, ...state });
  return {
    render,
    state,
    calls,
    t: (key) => catalog[key] ?? key,
    button: (label) =>
      nodes(render()).find((node) => node.props.accessibilityLabel === label),
    sheet: () =>
      nodes(render()).find((node) => node.type === "ProfileFieldSheet"),
  };
}
let checks = 0;
function test(label, run) {
  run();
  checks++;
  console.log(`PASS ${label}`);
}
for (const [field, label, key, value] of [
  ["name", "fullName", "fullName", "Minh Anh"],
  ["dateOfBirth", "birthYear", "birthYear", "1990"],
  ["gender", "gender", "gender", "Nữ"],
  ["heightCm", "heightCm", "height", "171"],
  ["weightKg", "weightKg", "weight", "70.6"],
  ["phone", "phone", "phone", "0987654321"],
  ["bloodType", "bloodType", "bloodType", "O+"],
]) {
  test(`${field}: onboarding opens the shared one-field sheet and only confirms that draft`, () => {
    const h = harness();
    h.button(h.t(label)).props.onPress();
    const sheet = h.sheet();
    assert.equal(sheet.props.field, field);
    assert.deepEqual(h.calls, []);
    const payload =
      field === "dateOfBirth"
        ? { dateOfBirth: "1990-01-01" }
        : {
            [field]: ["heightCm", "weightKg"].includes(field)
              ? Number(value)
              : value,
          };
    sheet.props.onConfirm(payload);
    sheet.props.onClose();
    assert.equal(h.state[key], value);
    assert.deepEqual(h.calls, [{ [key]: value }]);
    assert.equal(h.sheet(), undefined);
    if (field === "dateOfBirth")
      assert.deepEqual(sheet.props.birthYearOnly, {
        min: 1920,
        max: new Date().getFullYear() - 10,
      });
  });
}
test("closing a field sheet cannot change any questionnaire answer", () => {
  const h = harness(),
    before = { ...h.state };
  h.button(h.t("weightKg")).props.onPress();
  h.sheet().props.onClose();
  assert.deepEqual(h.state, before);
  assert.deepEqual(h.calls, []);
});
test("Apple name stays read only while other profile fields remain editable", () => {
  const h = harness(true),
    name = h.button(h.t("fullName"));
  assert.equal(name.props.disabled, true);
  name.props.onPress();
  assert.equal(h.sheet(), undefined);
  h.button(h.t("heightCm")).props.onPress();
  assert.equal(h.sheet().props.field, "heightCm");
});
test("personal selections use rows and keep the existing optional-phone and consent state", () => {
  const h = harness();
  assert.equal(
    nodes(h.render()).filter((node) => node.type === "RNTextInput").length,
    0
  );
  assert.equal(h.state.phone, "");
  assert.equal(h.state.consentAccepted, true);
  assert.ok(source.includes("height_cm: parseFloat(height)"));
  assert.ok(source.includes("weight_kg: parseFloat(weight)"));
  assert.ok(source.includes("birth_year: parseInt(birthYear, 10)"));
});
console.log(`Onboarding personal fields: ${checks} runtime checks passed.`);
