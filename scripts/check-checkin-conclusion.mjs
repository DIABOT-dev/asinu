import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const jsx = (type, props) => ({ type, props });
const nodes = (tree) =>
  !tree || typeof tree !== 'object'
    ? []
    : Array.isArray(tree)
    ? tree.flatMap(nodes)
    : [tree, ...nodes(tree.props?.children)];
const text = (tree) =>
  typeof tree === 'string'
    ? tree
    : Array.isArray(tree)
    ? tree.map(text).join('')
    : tree && typeof tree === 'object'
    ? text(tree.props?.children)
    : '';
const flattenStyle = (style) =>
  Array.isArray(style)
    ? Object.assign({}, ...style.map(flattenStyle))
    : style || {};
const luminance = (color) => {
  const parts = color
    .replace('#', '')
    .match(/.{2}/g)
    .map((part) => parseInt(part, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722;
};
const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
};
function evaluate(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func -- Isolated test harness for checked-in source.
  new Function('module', 'exports', 'require', code)(
    module,
    module.exports,
    (id) => {
      if (id === 'react/jsx-runtime') {
        return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      }
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  );
  return module.exports;
}
const helper = evaluate('src/features/checkin/checkin-conclusion.ts', {});
let count = 0;
function test(label, fn) {
  fn();
  count++;
  console.log('PASS ' + label);
}
test('the light check-in header can override its arrow color without changing other screen defaults', () => {
  const { ScreenBackButton } = evaluate(
    'src/components/ScreenHeaderButton.tsx',
    {
      '@expo/vector-icons': { Ionicons: 'Icon' },
      'react-native': {
        ActivityIndicator: 'Spinner',
        Image: 'Image',
        Pressable: 'Button',
        StyleSheet: { create: (styles) => styles },
      },
      'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
      '../styles': { colors: { textPrimary: '#F0F0F5' } },
      './ScaledText': { ScaledText: 'Text' },
      '../../assets/asinu_chat_sticker.png': 'existing-sticker',
    },
  );
  const original = ScreenBackButton({ onPress() {} });
  const checkin = ScreenBackButton({ onPress() {}, iconColor: '#0F172A' });
  assert.equal(
    nodes(original).find((node) => node.type === 'Icon').props.color,
    '#F0F0F5',
  );
  assert.equal(
    nodes(checkin).find((node) => node.type === 'Icon').props.color,
    '#0F172A',
  );
  assert.ok(
    fs
      .readFileSync('app/checkin/index.tsx', 'utf8')
      .includes('iconColor="#0F172A"'),
  );
});
for (const lang of ['vi', 'en']) {
  const home = JSON.parse(
    fs.readFileSync(`src/i18n/locales/${lang}/home.json`),
  );
  const backend = JSON.parse(
    fs.readFileSync(`../backend.asinu/src/i18n/locales/${lang}.json`),
  );
  const result = {
    summary: 'LEGACY SUMMARY',
    recommendation: 'LEGACY ADVICE',
    severity: 'medium',
    needsDoctor: true,
    conclusionVersion: 2,
    personalMessage: 'MESSAGE',
    explanation: 'EXPLANATION',
    todo: ['ACTIVITY ONE', 'ACTIVITY TWO'],
    seeDoctorWhen: ['WARNING ONE', 'WARNING TWO'],
    disclaimer: backend['checkin.conclusion.disclaimer'],
    closeMessage: 'FOLLOW UP AFTER 3 HOURS',
  };
  const { CheckinConclusion } = evaluate(
    'src/features/checkin/CheckinConclusion.tsx',
    {
      react: {},
      'react-native': {
        View: 'View',
        Pressable: 'Button',
        StyleSheet: { create: (value) => value },
      },
      'react-i18next': {
        useTranslation: () => ({
          t: (key) => {
            assert.ok(home[key], key);
            return home[key];
          },
        }),
      },
      '../../components/ScaledText': { ScaledText: 'Text' },
      '../../hooks/useThemeColors': {
        useThemeColors: () => ({
          colors: {
            primary: '#08766c',
            textPrimary: '#173831',
            textSecondary: '#526c66',
            surface: '#f5f9f7',
            border: '#dbe9e4',
          },
          isDark: false,
        }),
      },
    },
  );
  test(`${lang}: structured result shows six blocks in order without duplicating legacy content`, () => {
    const tree = CheckinConclusion({
      result,
      onConnectExpert() {},
      expertAvailable: true,
    });
    const rendered = text(tree);
    let previous = -1;
    for (const value of [
      'MESSAGE',
      'EXPLANATION',
      'ACTIVITY ONE',
      'WARNING ONE',
      result.disclaimer,
      'FOLLOW UP AFTER 3 HOURS',
    ]) {
      const index = rendered.indexOf(value);
      assert.ok(index > previous, value);
      previous = index;
    }
    assert.ok(!rendered.includes('LEGACY'));
    assert.equal(rendered.split(result.closeMessage).length - 1, 1);
    assert.ok(
      nodes(tree).some(
        (n) => n.props?.testID === 'checkin-conclusion-disclaimer',
      ),
    );
    const disclaimer = nodes(tree).find(
      (n) => n.props?.testID === 'checkin-conclusion-disclaimer',
    );
    assert.ok(
      disclaimer.props.style.some(
        (style) => style?.backgroundColor === '#F2F5F4',
      ),
    );
    assert.equal(
      nodes(disclaimer).filter((n) => n.type === 'Button').length,
      0,
    );
  });
  test(`${lang}: speech contains only blocks 1, 4 and 6`, () => {
    assert.equal(
      helper.structuredCheckinSpeech(result),
      'MESSAGE WARNING ONE WARNING TWO FOLLOW UP AFTER 3 HOURS',
    );
    assert.ok(helper.hasStructuredCheckinConclusion(result));
  });
  test(`${lang}: result text remains readable on DoneScreen's white card, including small disclaimer and button`, () => {
    const tree = CheckinConclusion({
      result,
      onConnectExpert() {},
      expertAvailable: true,
    });
    const disclaimer = nodes(tree).find(
      (node) => node.props?.testID === 'checkin-conclusion-disclaimer',
    );
    const button = nodes(tree).find((node) => node.type === 'Button');
    const disclaimerNodes = new Set(nodes(disclaimer));
    const buttonNodes = new Set(nodes(button));
    const disclaimerBackground = flattenStyle(
      disclaimer.props.style,
    ).backgroundColor;
    const buttonBackground = flattenStyle(
      button.props.style({ pressed: false }),
    ).backgroundColor;
    for (const node of nodes(tree).filter(
      (entry) => entry.type === 'Text' && entry.props.accessible !== false,
    )) {
      const color = flattenStyle(node.props.style).color;
      if (!color) {
        continue;
      }
      const background = buttonNodes.has(node)
        ? buttonBackground
        : disclaimerNodes.has(node)
        ? disclaimerBackground
        : '#FFFFFF';
      assert.ok(
        contrast(color, background) >= 4.5,
        `Unclear result text: ${color} on ${background}`,
      );
    }
    assert.ok(
      flattenStyle(button.props.style({ pressed: false })).minHeight >= 56,
    );
  });
  test(`${lang}: expert link opens the existing flow; separate button requires needsDoctor`, () => {
    let opened = 0;
    const tree = CheckinConclusion({
      result,
      onConnectExpert: () => opened++,
      expertAvailable: true,
    });
    const link = nodes(tree).find((n) => n.props?.accessibilityRole === 'link');
    assert.ok(link);
    link.props.onPress();
    assert.equal(opened, 1);
    assert.equal(nodes(tree).filter((n) => n.type === 'Button').length, 1);
    assert.equal(
      nodes(
        CheckinConclusion({
          result: { ...result, needsDoctor: false },
          onConnectExpert() {},
          expertAvailable: true,
        }),
      ).filter((n) => n.type === 'Button').length,
      0,
    );
  });
  test(`${lang}: read-only preview and disabled expert feature cannot navigate`, () => {
    for (const options of [
      { readOnly: true, expertAvailable: true },
      { readOnly: false, expertAvailable: false },
    ]) {
      const tree = CheckinConclusion({
        result,
        onConnectExpert: () => assert.fail('unexpected navigation'),
        ...options,
      });
      const link = nodes(tree).find(
        (n) => n.props?.accessibilityRole === 'link',
      );
      assert.ok(!link?.props?.onPress);
      for (const button of nodes(tree).filter((n) => n.type === 'Button')) {
        assert.equal(button.props.disabled, true);
      }
    }
  });
  test(`${lang}: emergencies omit new blocks and disclaimer`, () => {
    const emergency = { ...result, severity: 'emergency' };
    assert.equal(helper.hasStructuredCheckinConclusion(emergency), false);
    assert.equal(
      CheckinConclusion({
        result: emergency,
        onConnectExpert() {},
        expertAvailable: true,
      }),
      null,
    );
  });
  test(`${lang}: old, incomplete and malformed responses remain on legacy UI`, () => {
    for (const value of [
      null,
      { ...result, conclusionVersion: undefined },
      { ...result, todo: [] },
      { ...result, personalMessage: '' },
      { ...result, seeDoctorWhen: [null] },
    ]) {
      assert.equal(helper.hasStructuredCheckinConclusion(value), false);
    }
  });
  test(`${lang}: submitted answers render the localized analyzing message`, () => {
    const source = fs.readFileSync('app/checkin/index.tsx', 'utf8');
    const ast = ts.createSourceFile(
      'checkin.tsx',
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const fragment =
      ast.statements
        .find(
          (n) => ts.isFunctionDeclaration(n) && n.name?.text === 'TriageScreen',
        )
        .getText(ast) + '\nmodule.exports=TriageScreen;';
    const animation = {
      duration() {
        return this;
      },
    };
    const globals = {
      useTranslation: () => ({ t: (key) => home[key] || key }),
      useGuideAcknowledgement: () => () => {},
      useState: (initial) => [initial, () => {}],
      useRef: (current) => ({ current }),
      useEffect: () => {},
      useLanguageStore: () => ({ language: lang }),
      MAX_TRIAGE_QUESTIONS: 8,
      View: 'View',
      Text: 'Text',
      Image: 'Image',
      Animated: { View: 'Animated' },
      FadeIn: animation,
      FadeInLeft: animation,
      asinuChatSticker: 'synthetic-sticker',
    };
    const code = ts.transpileModule(fragment, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const module = { exports: {} };
    // eslint-disable-next-line no-new-func -- Render the checked-in loading branch without invoking native APIs.
    new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
      module,
      module.exports,
      () => ({ jsx, jsxs: jsx }),
      ...Object.values(globals),
    );
    const tree = module.exports({
      styles: {},
      question: '',
      options: [],
      multiSelect: false,
      answers: [],
      loading: true,
      onAnswer: () => assert.fail('unexpected answer'),
    });
    assert.ok(text(tree).includes(home.checkinTriageAnalyzing));
    assert.ok(
      nodes(tree).some((n) => n.props?.accessibilityLiveRegion === 'polite'),
    );
  });
  test(`${lang}: actual result screen renders immediately while voice loads and speaks only 1+4+6`, () => {
    const source = fs.readFileSync('app/checkin/index.tsx', 'utf8');
    const ast = ts.createSourceFile(
      'checkin.tsx',
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const fragment =
      ['stripEmojis', 'extractRecordedSymptoms', 'DoneScreen']
        .map((name) =>
          ast.statements
            .find((n) => ts.isFunctionDeclaration(n) && n.name?.text === name)
            .getText(ast),
        )
        .join('\n') + '\nmodule.exports=DoneScreen;';
    const effects = [],
      calls = [],
      navigation = [],
      slots = [];
    let cursor = 0;
    const play = (...args) => {
      calls.push(args);
      return Promise.resolve();
    };
    const stopAudio = async () => {};
    const hooks = {
      useState(initial) {
        const index = cursor++;
        slots[index] ??= { value: initial };
        return [
          slots[index].value,
          (value) => {
            slots[index].value =
              typeof value === 'function' ? value(slots[index].value) : value;
          },
        ];
      },
      useRef(initial) {
        const index = cursor++;
        slots[index] ??= { current: initial };
        return slots[index];
      },
      useEffect(fn, deps) {
        const index = cursor++,
          old = slots[index];
        if (!old || deps.some((v, i) => !Object.is(v, old.deps[i]))) {
          slots[index] = { deps };
          effects.push(() => {
            old?.cleanup?.();
            slots[index].cleanup = fn();
          });
        }
      },
    };
    const animation = {
      duration() {
        return this;
      },
      delay() {
        return this;
      },
    };
    const globals = {
      ...hooks,
      useTranslation: () => ({
        t: (key) => home[key] || key,
        i18n: { resolvedLanguage: lang },
      }),
      useRouter: () => ({ push: (route) => navigation.push(route) }),
      useCheckinCallAudio: () => ({
        audio: { phase: 'loading' },
        play,
        stopAudio,
      }),
      ...helper,
      CheckinConclusion,
      View: 'View',
      Text: 'Text',
      Pressable: 'Button',
      Ionicons: 'Icon',
      Svg: 'Svg',
      Path: 'Path',
      GuideTarget: 'Guide',
      CheckinHeroBadge: 'Badge',
      CheckinGiftCloseButton: 'CloseButton',
      Animated: { View: 'Animated' },
      FadeIn: animation,
      FadeInDown: animation,
      isDoctorFeaturesEnabled: false,
      isExpertConsultationEnabled: true,
      colors: { textSecondary: '#526c66' },
      Linking: { openURL: () => assert.fail('unexpected call') },
      guidanceAudio: { stop: async () => {} },
      showToast() {},
    };
    const compiled = ts.transpileModule(fragment, {
      fileName: 'checkin.tsx',
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const module = { exports: {} };
    // eslint-disable-next-line no-new-func -- Isolated test harness for checked-in source.
    new Function(
      'module',
      'exports',
      'require',
      ...Object.keys(globals),
      compiled,
    )(
      module,
      module.exports,
      () => ({ jsx, jsxs: jsx }),
      ...Object.values(globals),
    );
    const props = {
      styles: {},
      session: {
        id: 12,
        current_status: 'tired',
        initial_status: 'tired',
        triage_messages: [],
      },
      triageSummary: result,
      isFollowUp: false,
      onClose() {},
    };
    const render = (screenProps) => {
      cursor = 0;
      effects.length = 0;
      const tree = module.exports(screenProps);
      for (const effect of effects) {
        effect();
      }
      return tree;
    };
    const tree = render(props);
    assert.ok(nodes(tree).some((n) => n.type === CheckinConclusion));
    assert.ok(!text(tree).includes(home.checkinSeeDoctor));
    assert.deepEqual(calls, [
      ['conclusion', helper.structuredCheckinSpeech(result)],
    ]);
    nodes(tree)
      .find((n) => n.type === CheckinConclusion)
      .props.onConnectExpert();
    assert.deepEqual(navigation, ['/doctor-consultation']);
    try {
      render(props);
      assert.equal(
        calls.length,
        1,
        'An unchanged result never repeats narration',
      );
      const next = {
        ...props,
        session: { ...props.session, id: 13 },
        triageSummary: { ...result, personalMessage: 'NEXT RESULT' },
      };
      render(next);
      assert.equal(
        calls.length,
        2,
        'A different result on the mounted screen must get its own narration',
      );
      assert.equal(
        calls[1][1],
        helper.structuredCheckinSpeech(next.triageSummary),
      );
      const preview = render({ ...next, readOnly: true });
      nodes(preview)
        .find((n) => n.type === CheckinConclusion)
        .props.onConnectExpert();
      assert.deepEqual(navigation, ['/doctor-consultation']);
      assert.equal(
        calls.length,
        2,
        'A read-only result must not synthesize speech',
      );
    } finally {
      for (const slot of slots) {
        slot?.cleanup?.();
      }
    }
  });
}
console.log(`Check-in conclusion: ${count} runtime regressions passed.`);
