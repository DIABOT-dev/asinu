import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const jsx = (type, props, key) => ({ type, props, key });
const nodes = (tree) =>
  !tree || typeof tree !== 'object'
    ? []
    : Array.isArray(tree)
      ? tree.flatMap(nodes)
      : [tree, ...nodes(tree.props?.children)];
const text = (tree) =>
  typeof tree === 'string' || typeof tree === 'number'
    ? String(tree)
    : Array.isArray(tree)
      ? tree.map(text).join('')
      : tree
        ? text(tree.props?.children)
        : '';
const flatten = (style) =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};
const luminance = (color) => {
  const rgb = color
    .slice(1)
    .match(/../g)
    .map((value) => parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

function evaluate(file, imports, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  // eslint-disable-next-line no-new-func -- Run the actual component with controlled native events and time.
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
    module,
    module.exports,
    (id) => {
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      assert.ok(Object.hasOwn(imports, id), `Unexpected dependency: ${id}`);
      return imports[id];
    },
    ...Object.values(globals),
  );
  return module.exports;
}

function harness({ language = 'vi', first = false, active = true } = {}) {
  const slots = [],
    effects = [],
    timers = new Map(),
    listeners = new Map(),
    queries = [],
    repeats = [],
    cancelled = [];
  let index = 0,
    now = 0,
    nextTimer = 0,
    focused = true;
  const hooks = {
    useState(initial) {
      const key = index++;
      slots[key] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [
        slots[key].value,
        (value) => {
          slots[key].value = typeof value === 'function' ? value(slots[key].value) : value;
        },
      ];
    },
    useRef(initial) {
      const key = index++;
      return (slots[key] ??= { current: initial });
    },
    useEffect(work, deps) {
      const key = index++,
        previous = slots[key];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        slots[key] = { deps };
        effects.push(() => {
          previous?.cleanup?.();
          slots[key].cleanup = work();
        });
      }
    },
  };
  const listen = (name, callback) => {
    listeners.set(name, callback);
    return { remove: () => listeners.delete(name) };
  };
  const catalog = JSON.parse(fs.readFileSync(`src/i18n/locales/${language}/home.json`, 'utf8'));
  const theme = evaluate('src/styles/theme.ts', {});
  const component = evaluate(
    'src/features/checkin/CheckinQuestionLoading.tsx',
    {
      react: hooks,
      'react-native': {
        View: 'View',
        Image: 'Image',
        StyleSheet: { create: (value) => value },
        AppState: {
          currentState: 'active',
          addEventListener: (event, callback) => listen(`app:${event}`, callback),
        },
        AccessibilityInfo: {
          addEventListener: listen,
          isReduceMotionEnabled: () => ({
            then: (callback) => {
              queries.push(callback);
              return { catch() {} };
            },
          }),
        },
      },
      'expo-router': { useIsFocused: () => focused },
      'react-i18next': {
        useTranslation: () => ({
          t: (key, values = {}) => {
            assert.ok(catalog[key], `${language}: ${key}`);
            return catalog[key].replace('{{percent}}', values.percent);
          },
        }),
      },
      'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle' },
      'react-native-reanimated': {
        __esModule: true,
        default: { View: 'AnimatedView', createAnimatedComponent: () => 'AnimatedCircle' },
        useSharedValue(initial) {
          return hooks.useRef({ value: initial }).current;
        },
        useAnimatedProps: (work) => work(),
        useAnimatedStyle: (work) => work(),
        Easing: { inOut: (value) => value, out: (value) => value, quad: 'quad', cubic: 'cubic' },
        withTiming: (value) => value,
        withSequence: (...values) => ({ sequence: values }),
        withRepeat: (...values) => {
          repeats.push(values);
          return values[0];
        },
        cancelAnimation: (value) => cancelled.push(value),
      },
      '../../styles/theme': theme,
      '../../components/ScaledText': { ScaledText: 'Text' },
      '../../../assets/asinu_chat_sticker.png': 'existing-asinu-mascot',
    },
    {
      Date: { now: () => now },
      setInterval: (callback, delay) => {
        const key = ++nextTimer;
        timers.set(key, { callback, delay });
        return key;
      },
      clearInterval: (key) => timers.delete(key),
    },
  );
  const settle = () => {
    let tree;
    for (let i = 0; i < 3; i++) {
      index = 0;
      tree = component.CheckinQuestionLoading({ first, active });
      effects.splice(0).forEach((work) => work());
    }
    return tree;
  };
  return {
    ...component,
    settle,
    timers,
    listeners,
    queries,
    repeats,
    cancelled,
    theme,
    advance(ms) {
      now += ms;
      [...timers.values()].forEach((timer) => timer.callback());
      return settle();
    },
    motion(value) {
      listeners.get('reduceMotionChanged')(value);
      return settle();
    },
    app(value) {
      listeners.get('app:change')(value);
      return settle();
    },
    focus(value) {
      focused = value;
      return settle();
    },
    cleanup() {
      slots.forEach((slot) => slot?.cleanup?.());
    },
  };
}

test('request progress is an estimate, monotonic and never reaches completion before the response', () => {
  const h = harness();
  const values = [-10, 0, 250, 1000, 5000, 15000, 90000].map(h.estimatedQuestionProgress);
  assert.equal(values[0], 12);
  assert.equal(values.at(-1), 94);
  assert.ok(values.every((value, i) => value < 100 && (!i || value >= values[i - 1])));
  assert.equal(h.estimatedQuestionProgress(NaN), 12);
});

for (const language of ['vi', 'en'])
  for (const first of [true, false]) {
    test(`${language}/${first ? 'first' : 'next'}: real loader renders the mascot, circular progress and honest clear copy`, () => {
      const h = harness({ language, first });
      try {
        let tree = h.settle();
        const progress = nodes(tree).find(
          (node) => node.props?.accessibilityRole === 'progressbar',
        );
        assert.equal(progress.props.accessibilityState.busy, true);
        assert.equal(progress.props.accessibilityValue.now, 12);
        assert.match(
          progress.props.accessibilityValue.text,
          language === 'vi' ? /ước tính/ : /Estimated/,
        );
        assert.ok(
          nodes(tree).some(
            (node) => node.type === 'Image' && node.props.source === 'existing-asinu-mascot',
          ),
        );
        assert.ok(nodes(tree).some((node) => node.type === 'AnimatedCircle'));
        assert.ok(text(tree).includes('12%'));
        assert.ok(!/chẩn đoán|diagnos|đang suy luận|reasoning/i.test(text(tree)));
        const heading = nodes(tree).find((node) => node.props?.accessibilityRole === 'header');
        assert.equal(flatten(heading.props.style).fontSize, 22);
        assert.equal(heading.props.numberOfLines, undefined);
        assert.equal(flatten(heading.props.style).color, h.theme.lightColors.textPrimary);
        assert.ok(contrast(flatten(heading.props.style).color, '#f3fbf8') >= 4.5);
        assert.ok(contrast(h.theme.lightColors.textSecondary, '#f3fbf8') >= 4.5);
        assert.ok(
          contrast(h.theme.lightColors.primaryText, h.theme.lightColors.primaryLight) >= 4.5,
        );
        tree = h.advance(13000);
        assert.match(text(tree), language === 'vi' ? /ước tính/ : /Estimated/);
        assert.match(text(tree), language === 'vi' ? /chờ chút/ : /please wait/);
        assert.ok(
          nodes(tree).find((node) => node.props?.accessibilityRole === 'progressbar').props
            .accessibilityValue.now < 100,
        );
      } finally {
        h.cleanup();
        assert.equal(h.timers.size, 0);
        assert.equal(h.listeners.size, 0);
      }
    });
  }

test('Reduce Motion is honored before its query resolves and changing it stops mascot animation', () => {
  const h = harness();
  try {
    h.settle();
    assert.equal(h.repeats.length, 0);
    h.queries[0](false);
    h.settle();
    assert.equal(h.repeats.length, 1);
    h.motion(true);
    const previous = h.repeats.length;
    h.queries[0](false);
    h.advance(500);
    assert.equal(h.repeats.length, previous);
    assert.ok(h.cancelled.length > 0);
    assert.equal(h.timers.size, 1, 'Only genuine request elapsed time remains');
  } finally {
    h.cleanup();
  }
});

test('background and unfocused screens pause all timers and do not consume simulated progress', () => {
  const h = harness();
  try {
    h.settle();
    const before = h.advance(500);
    const value = (tree) =>
      nodes(tree).find((node) => node.props?.accessibilityRole === 'progressbar').props
        .accessibilityValue.now;
    h.app('background');
    assert.equal(h.timers.size, 0);
    assert.equal(value(h.advance(60000)), value(before));
    h.app('active');
    assert.equal(h.timers.size, 1);
    assert.ok(value(h.advance(500)) > value(before));
    h.focus(false);
    assert.equal(h.timers.size, 0);
    h.focus(true);
    assert.equal(h.timers.size, 1);
  } finally {
    h.cleanup();
    assert.equal(h.timers.size, 0);
    assert.equal(h.listeners.size, 0);
  }
});

test('read-only previews are static and unmounting prevents late native callbacks from starting animation', () => {
  const preview = harness({ active: false });
  preview.settle();
  assert.equal(preview.timers.size, 0);
  assert.equal(preview.queries.length, 0);
  assert.equal(preview.listeners.size, 0);
  preview.cleanup();
  const live = harness();
  live.settle();
  const callback = live.queries[0];
  live.cleanup();
  callback(false);
  assert.equal(live.timers.size, 0);
  assert.equal(live.listeners.size, 0);
  assert.equal(live.repeats.length, 0);
});
