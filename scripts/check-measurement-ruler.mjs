import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function evaluate(file, imports = {}, timers = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const jsx = (type, props) => ({ type, props });
  new Function(
    "module",
    "exports",
    "require",
    "setTimeout",
    "clearTimeout",
    output
  )(
    module,
    module.exports,
    (name) => {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      assert.ok(name in imports, `Missing ruler adapter ${name}`);
      return imports[name];
    },
    timers.setTimeout,
    timers.clearTimeout
  );
  return module.exports;
}
const math = evaluate("src/features/profile/measurement-ruler.ts");
const nodes = (tree) =>
  Array.isArray(tree)
    ? tree.flatMap(nodes)
    : tree && typeof tree === "object"
    ? [tree, ...nodes(tree.props?.children)]
    : [];
const theme = evaluate("src/styles/theme.ts");
const catalog = JSON.parse(fs.readFileSync("src/i18n/locales/vi/profile.json"));
function harness(kind, initial, initiallyDisabled = false) {
  let cursor = 0,
    dirty = false,
    value = initial,
    disabled = initiallyDisabled,
    nextTimer = 0;
  const slots = [],
    effects = [],
    timers = new Map(),
    changes = [],
    interactions = [],
    offsets = [];
  const depsChanged = (previous, next) =>
    !previous || next.some((item, index) => !Object.is(item, previous[index]));
  const hooks = {
    useRef(initialValue) {
      const i = cursor++;
      return (slots[i] ??= { current: initialValue });
    },
    useState(initialValue) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initialValue;
      return [
        slots[i],
        (next) => {
          if (!Object.is(next, slots[i])) {
            slots[i] = next;
            dirty = true;
          }
        },
      ];
    },
    useMemo(factory, dependencies) {
      const i = cursor++;
      if (depsChanged(slots[i]?.deps, dependencies))
        slots[i] = { deps: dependencies, value: factory() };
      return slots[i].value;
    },
    useEffect(effect, dependencies) {
      const i = cursor++;
      if (depsChanged(slots[i]?.deps, dependencies))
        effects.push(() => {
          slots[i]?.cleanup?.();
          slots[i] = { deps: dependencies, cleanup: effect() };
        });
    },
  };
  class AnimatedValue {
    constructor(value) {
      this.value = value;
    }
    interpolate(config) {
      return { value: this.value, ...config };
    }
  }
  const timersAdapter = {
    setTimeout: (callback) => {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const { MeasurementRuler } = evaluate(
    "src/features/profile/MeasurementRuler.tsx",
    {
      react: hooks,
      "react-native": {
        View: "View",
        Pressable: "Pressable",
        FlatList: "FlatList",
        StyleSheet: { create: (value) => value },
        useWindowDimensions: () => ({ width: 390, height: 844 }),
        Animated: {
          Value: AnimatedValue,
          Image: "AnimatedImage",
          timing: (animated, { toValue }) => ({
            start: () => {
              animated.value = toValue;
            },
            stop: () => {},
          }),
        },
      },
      "react-i18next": {
        useTranslation: () => ({ t: (key) => catalog[key] ?? key }),
      },
      "../../components/ScaledText": { ScaledText: "Text" },
      "../../hooks/useThemeColors": {
        useThemeColors: () => ({ colors: theme.lightColors, isDark: false }),
      },
      "./measurement-ruler": math,
      "../../../assets/images/profile/measurement-person.png": {
        uri: "measurement-person.png",
      },
    },
    timersAdapter
  );
  const render = () => {
    let tree,
      count = 0;
    do {
      dirty = false;
      cursor = 0;
      tree = MeasurementRuler({
        kind,
        value,
        disabled,
        onChange: (next) => {
          changes.push(next);
          value = String(next);
          dirty = true;
        },
        onInteractionChange: (moving) => interactions.push(moving),
      });
      const list = nodes(tree).find((node) => node.type === "FlatList");
      if (list)
        list.props.ref.current = {
          scrollToOffset: (options) => offsets.push(options.offset),
        };
      for (const effect of effects.splice(0)) effect();
      assert.ok(++count < 10);
    } while (dirty);
    return tree;
  };
  const list = () => nodes(render()).find((node) => node.type === "FlatList");
  const adjustable = () =>
    nodes(render()).find(
      (node) => node.props.accessibilityRole === "adjustable"
    );
  const event = (x) => ({ nativeEvent: { contentOffset: { x } } });
  const layout = () =>
    nodes(render())
      .find((node) => node.props.onLayout)
      .props.onLayout({ nativeEvent: { layout: { width: 350 } } });
  layout();
  render();
  return {
    render,
    list,
    adjustable,
    event,
    changes,
    interactions,
    offsets,
    advanceTimers: () => {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
    setDisabled: (next) => {
      disabled = next;
      render();
    },
    scale: () =>
      nodes(render()).find((node) => node.type === "AnimatedImage").props.style
        .transform[1].scale.value,
    widthScale: () =>
      nodes(render()).find((node) => node.type === "AnimatedImage").props.style
        .transform.find((transform) => "scaleX" in transform).scaleX,
    unmount: () => {
      slots.forEach((slot) => slot?.cleanup?.());
    },
    get value() {
      return Number(value);
    },
  };
}
let checks = 0;
function test(label, run) {
  run();
  checks++;
  console.log(`PASS ${label}`);
}
test("ruler math preserves decimal steps, clamps overscroll and round trips every selectable value", () => {
  for (const kind of ["height", "weight"]) {
    const range = math.measurementRange(kind, "");
    for (
      let i = 0;
      i <= Math.round((range.max - range.min) / range.step);
      i++
    ) {
      const value = Number((range.min + i * range.step).toFixed(1));
      assert.equal(
        math.rulerValueAtOffset(math.rulerOffsetForValue(value, range), range),
        value
      );
    }
    assert.equal(math.rulerValueAtOffset(-50, range), range.min);
    assert.equal(math.rulerValueAtOffset(1e9, range), range.max);
  }
  assert.ok(math.measurementRange("weight", "0.5").min > 0);
  assert.equal(math.measurementRange("weight", "350").initial, 350);
  assert.equal(math.measurementRange("weight", "350").max, 350);
});
for (const [kind, initial, step] of [
  ["height", "170", 1],
  ["weight", "70.5", 0.1],
]) {
  test(`${kind}: mounting and programmatic scroll events cannot change a saved measurement`, () => {
    const h = harness(kind, initial),
      offset = h.offsets.at(-1);
    assert.equal(h.list().props.horizontal, true);
    assert.equal(h.list().props.snapToInterval, 10);
    h.list().props.onScroll(h.event(offset + 100));
    h.list().props.onMomentumScrollBegin();
    h.list().props.onMomentumScrollEnd(h.event(offset + 100));
    assert.deepEqual(h.changes, []);
    assert.deepEqual(h.interactions, []);
    assert.equal(h.value, Number(initial));
  });
  test(`${kind}: a horizontal drag updates the preview and stays busy until it settles`, () => {
    const h = harness(kind, initial),
      offset = h.offsets.at(-1),
      before = h.scale(),
      widthBefore = h.widthScale();
    h.list().props.onScrollBeginDrag();
    h.list().props.onScroll(h.event(offset + 10));
    assert.equal(h.value, Number((Number(initial) + step).toFixed(1)));
    assert.equal(h.interactions.at(-1), true);
    assert.ok(kind === "height" ? h.scale() > before : h.scale() === before);
    assert.ok(kind === "weight" ? h.widthScale() > widthBefore : h.widthScale() === widthBefore);
    h.list().props.onScrollEndDrag(h.event(offset + 12));
    assert.equal(h.interactions.at(-1), true);
    h.advanceTimers();
    assert.equal(h.interactions.at(-1), false);
    assert.equal(h.offsets.at(-1), offset + 10);
  });
  test(`${kind}: momentum cannot release Save between a drag and its final snap`, () => {
    const h = harness(kind, initial),
      offset = h.offsets.at(-1);
    h.list().props.onScrollBeginDrag();
    h.list().props.onScrollEndDrag(h.event(offset + 12));
    h.list().props.onMomentumScrollBegin();
    h.advanceTimers();
    assert.ok(!h.interactions.includes(false));
    h.list().props.onScroll(h.event(offset + 33));
    h.list().props.onMomentumScrollEnd(h.event(offset + 33));
    assert.equal(h.value, Number((Number(initial) + step * 3).toFixed(1)));
    assert.equal(h.interactions.at(-1), false);
    assert.equal(h.offsets.at(-1), offset + 30);
  });
  test(`${kind}: accessibility adjustment and tapping a tick choose the same numeric steps`, () => {
    const h = harness(kind, initial);
    h.adjustable().props.onAccessibilityAction({
      nativeEvent: { actionName: "increment" },
    });
    assert.equal(h.value, Number((Number(initial) + step).toFixed(1)));
    h.adjustable().props.onAccessibilityAction({
      nativeEvent: { actionName: "decrement" },
    });
    assert.equal(h.value, Number(initial));
    const list = h.list(),
      item = list.props.data.at(-1);
    list.props.renderItem({ item }).props.onPress();
    assert.equal(h.value, item);
    h.adjustable().props.onAccessibilityAction({
      nativeEvent: { actionName: "increment" },
    });
    assert.equal(h.value, item);
  });
  test(`${kind}: disabled and unmounted controls cannot write queued gestures`, () => {
    const h = harness(kind, initial, true),
      offset = h.offsets.at(-1);
    h.list().props.onScrollBeginDrag();
    h.list().props.onScroll(h.event(offset + 100));
    h.adjustable().props.onAccessibilityAction({
      nativeEvent: { actionName: "increment" },
    });
    assert.deepEqual(h.changes, []);
    h.setDisabled(false);
    h.list().props.onScrollBeginDrag();
    h.list().props.onScrollEndDrag(h.event(offset + 20));
    const before = h.changes.length;
    h.unmount();
    h.advanceTimers();
    assert.equal(h.changes.length, before);
  });
}
test("weight: the figure visibly widens around 65 kg and keeps responding near the maximum", () => {
  const h = harness("weight", "65");
  const range = math.measurementRange("weight", "65");
  const referenceWidth = h.widthScale();
  const referenceHeight = h.scale();
  const dragTo = (weight) => {
    const offset = math.rulerOffsetForValue(weight, range);
    h.list().props.onScroll(h.event(offset));
    assert.equal(h.value, weight);
    assert.equal(h.scale(), referenceHeight);
    return h.widthScale();
  };

  h.list().props.onScrollBeginDrag();
  assert.ok(dragTo(75) >= referenceWidth * 1.2);
  assert.ok(dragTo(55) <= referenceWidth * 0.85);
  const highWidth = dragTo(250);
  const maxWidth = dragTo(300);
  assert.ok(maxWidth > highWidth && maxWidth < referenceWidth * 2);
});
test("an unknown value previews a default without writing until the user chooses", () => {
  const h = harness("height", "");
  assert.deepEqual(h.changes, []);
  assert.equal(h.adjustable().props.accessibilityValue.now, 170);
  h.list().props.onScrollBeginDrag();
  h.list().props.onScrollEndDrag(h.event(h.offsets.at(-1)));
  h.advanceTimers();
  assert.equal(h.value, 170);
});
test("opening a legacy decimal value never silently rounds it", () => {
  const h = harness("weight", "70.25");
  assert.equal(h.adjustable().props.accessibilityValue.now, 70.25);
  assert.deepEqual(h.changes, []);
});
console.log(`Measurement rulers: ${checks} runtime checks passed.`);
