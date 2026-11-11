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
  typeof tree === 'string' || typeof tree === 'number'
    ? String(tree)
    : Array.isArray(tree)
    ? tree.map(text).join('')
    : tree && typeof tree === 'object'
    ? text(tree.props?.children)
    : '';
const assertAiNotice = (tree, expected) => {
  const cards = nodes(tree).filter(node => node.props?.testID === 'checkin-ai-notice');
  assert.equal(cards.length, 1, 'Show the AI notice once');
  const normalize = value => value.toLowerCase().replace(/[\p{P}\s]/gu, '');
  assert.equal(normalize(text(cards[0])), normalize(expected), 'Keep every word when separating the headline and explanation');
  assert.equal(normalize(cards[0].props.accessibilityLabel), normalize(expected), 'Screen readers receive the complete notice');
};
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
function evaluate(file, dependencies, globals = {}) {
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
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
    module,
    module.exports,
    (id) => {
      if (id === 'react/jsx-runtime') {
        return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      }
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency ${id}`);
      return dependencies[id];
    },
    ...Object.values(globals),
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
test('recorded symptoms exclude timing and negative warning-sign choices from the reported preview case', () => {
  const answers = [
    { step: 'symptoms', question: 'Bạn thấy khó chịu như thế nào?', answer: 'Đầy hơi, Khó tiêu' },
    { step: 'onset', question: 'Bạn bắt đầu thấy khó chịu khi nào?', answer: 'Từ 1 đến dưới 3 ngày' },
    { step: 'progression', question: 'Bạn thấy triệu chứng thay đổi thế nào?', answer: 'Vẫn như cũ' },
    { step: 'red_flags', question: 'Bạn có triệu chứng nào sau đây?', answer: 'Không có' },
  ];
  assert.equal(helper.recordedCheckinSymptoms({ session: null, answers }), 'Đầy hơi, Khó tiêu');
  assert.equal(helper.recordedCheckinSymptoms({ session: { triage_messages: answers } }), 'Đầy hơi, Khó tiêu');
  assert.equal(helper.recordedCheckinSymptoms({ session: null, answers: answers.map(({ step, ...rest }) => rest) }), 'Đầy hơi, Khó tiêu');
});
test('authoritative symptoms take precedence over stale client answers and preserve inability symptoms', () => {
  const recordedSymptoms = ['Không thở được', 'Không đứng được', 'Đau bụng', 'đau bụng', 'Không có', 'Không rõ'];
  assert.equal(helper.recordedCheckinSymptoms({ session: null, recordedSymptoms,
    answers: [{ step: 'symptoms', question: '', answer: 'Stale answer' }] }), 'Không thở được, Không đứng được, Đau bụng');
  const translate = key => key;
  assert.equal(helper.recordedCheckinSymptoms({ session: { current_status: 'tired', triage_messages: [{ step: 'symptoms', answer: 'Stale answer' }] },
    recordedSymptoms: [], translate }), 'checkinSymptomsTired');
});
test('legacy questions and detailed answers cannot classify duration, severity or relief as symptoms', () => {
  for (const answers of [
    [
      { question: 'What symptoms are you having?', answer: 'Headache; Nausea' },
      { question: 'When did the symptoms start?', answer: 'Yesterday' },
      { question: 'Are the symptoms better or worse?', answer: 'Worse' },
      { question: 'Any other symptoms?', answer: 'None' },
    ],
    [
      { step: 'symptoms', question: '', answer: 'Headache' },
      { step: 'detail_head_associated', question: '', answer: 'Nausea' },
      { step: 'detail_head_severity', question: '', answer: 'Severe' },
      { step: 'detail_head_relieving', question: '', answer: 'Lying down' },
      { step: 'adaptive_test_onset', question: '', answer: 'Yesterday' },
    ],
  ]) assert.equal(helper.recordedCheckinSymptoms({ session: null, answers }), 'Headache, Nausea');
});
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
  const route = ts.createSourceFile('checkin.tsx', fs.readFileSync('app/checkin/index.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let arrow;
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(route) === 'ScreenBackButton') {
      arrow ??= node.attributes.properties.find(prop => prop.name?.getText(route) === 'iconColor');
    }
    ts.forEachChild(node, visit);
  };
  visit(route);
  assert.ok(arrow?.initializer?.expression, 'Check-in header must set its arrow color');
  // eslint-disable-next-line no-new-func -- Evaluate the checked-in color expression with controlled theme values.
  const resolveColor = new Function('screen', 'colors', `return (${arrow.initializer.expression.getText(route)})`);
  for (const primaryText of ['#0f766e', '#5eead4']) {
    assert.equal(resolveColor('status', { primaryText }), primaryText, 'Status arrow follows the tinted back control');
    assert.equal(resolveColor('triage', { primaryText }), primaryText, 'Triage arrow follows the same back control palette');
  }
});
for (const lang of ['vi', 'en']) {
  const home = JSON.parse(
    fs.readFileSync(`src/i18n/locales/${lang}/home.json`),
  );
  const backend = JSON.parse(
    fs.readFileSync(`${process.env.ASINU_BACKEND_DIR || '../backend.asinu'}/src/i18n/locales/${lang}.json`),
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
    aiNotice: backend['checkin.conclusion.ai_notice'],
    closeMessage: 'FOLLOW UP AFTER 3 HOURS',
  };
  const { CheckinConclusion } = evaluate(
    'src/features/checkin/CheckinConclusion.tsx',
    {
      './checkin-conclusion': helper,
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
      '../guidance/GuidanceProvider': { GuideTarget: 'GuideTarget' },
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
  test(`${lang}: the practice guide highlights the real narrative explanation, advice and expert button`, () => {
    const sample = { ...result, conclusionFormat: 'narrative', narrative: 'Example explanation.\n\n- Example next step.\n\nExample monitoring paragraph.' };
    const tree = CheckinConclusion({ result: sample, onConnectExpert() {}, expertAvailable: true, practice: true });
    const targets = nodes(tree).filter(node => node.type === 'GuideTarget');
    assert.deepEqual(targets.map(node => node.props.step), ['checkin.result_symptoms', 'checkin.result_advice', 'checkin.result_doctor']);
    assert.ok(text(targets[0]).includes('Example explanation'));
    assert.ok(text(targets[1]).includes('Example next step'));
    assert.ok(nodes(tree).some(node => node.props?.testID === 'checkin-narrative-conclusion'));
  });
  test(`${lang}: speech contains every visible conclusion block and advice followed by the fixed AI notice`, () => {
    assert.equal(
      helper.structuredCheckinSpeech(result),
      [result.personalMessage, result.explanation, ...result.todo, ...result.seeDoctorWhen, result.disclaimer, result.closeMessage, result.aiNotice].join(' '),
    );
    assert.ok(helper.hasStructuredCheckinConclusion(result));
  });
  test(`${lang}: a free narrative uses paragraphs and bullets without the old fixed section titles`, () => {
    const value = { ...result, conclusionFormat: 'narrative', narrative: 'A caring personal paragraph.\n\n- First useful action.\n- Second useful action.\n  A wrapped continuation.\n\nA final personal paragraph.',
      speechText: `A caring personal paragraph. ${result.closeMessage} ${result.aiNotice}` };
    assert.ok(helper.hasNarrativeCheckinConclusion(value));
    assert.ok(helper.hasDisplayCheckinConclusion(value));
    const parts = helper.parseCheckinNarrative(value.narrative);
    assert.deepEqual(parts.map(p => p.type), ['paragraph', 'bullet', 'bullet', 'paragraph']);
    assert.equal(parts[2].text, 'Second useful action. A wrapped continuation.');
    const tree = CheckinConclusion({ result: value, onConnectExpert() {}, expertAvailable: true });
    const rendered = text(tree);
    for (const part of parts) assert.ok(rendered.includes(part.text));
    for (const key of ['checkinConclusionMessage','checkinConclusionExplanation','checkinConclusionTodo','checkinConclusionWarning','checkinConclusionFollowup']) assert.ok(!rendered.includes(home[key]));
    assert.ok(rendered.includes(result.disclaimer));
    assert.ok(rendered.includes(result.closeMessage));
    assert.ok(nodes(tree).some(n => n.props?.testID === 'checkin-narrative-conclusion'));
    for (const part of parts) assert.ok(helper.checkinConclusionSpeech(value).includes(part.text));
    assert.notEqual(helper.checkinConclusionSpeech(value), value.speechText, 'Old abbreviated transcripts cannot drop visible advice');
    assert.ok(!helper.hasNarrativeCheckinConclusion({ ...value, severity: 'emergency' }));
  });
  test(`${lang}: a long narrative reads every paragraph and advice item with the notice at the end`, () => {
    const value = { ...result, conclusionFormat: 'narrative', narrative: 'A warm first paragraph.\n\n- Please see a health expert if symptoms worsen.\n\n' + Array.from({ length: 150 }, (_, index) => `Some additional explanation ${index}.`).join(' ') };
    const speech = helper.checkinConclusionSpeech(value);
    assert.ok(speech.includes('A warm first paragraph.'));
    assert.ok(speech.includes('health expert'));
    assert.ok(speech.endsWith(result.aiNotice));
    assert.ok(speech.length > 1600);
    assert.ok(speech.includes('Some additional explanation 149.'));
    assert.ok(speech.includes(result.disclaimer));
  });
  test(`${lang}: V3 prose and every activity render fully under the existing API schema`, () => {
    const v3 = {
      ...result,
      conclusionPromptVersion: 'v3',
      conclusionRenderVersion: 1,
      conclusionSource: 'ai',
      personalMessage: 'V3 MESSAGE ' + 'warm everyday words '.repeat(15),
      explanation: 'V3 EXPLANATION ' + 'an honest helpful explanation '.repeat(25),
      todo: ['V3 ACTION ONE', 'V3 ACTION TWO', 'V3 ACTION THREE', 'V3 ACTION FOUR'],
      seeDoctorWhen: ['V3 WARNING ONE', 'V3 WARNING TWO', 'V3 WARNING THREE', 'V3 WARNING FOUR'],
    };
    assert.ok(helper.hasStructuredCheckinConclusion(v3));
    const tree = CheckinConclusion({ result: v3, onConnectExpert() {}, expertAvailable: true });
    const rendered = text(tree);
    for (const value of [v3.personalMessage, v3.explanation, ...v3.todo, ...v3.seeDoctorWhen]) {
      assert.ok(rendered.includes(value), value);
      const line = nodes(tree).find(n => n.type === 'Text' && text(n) === value);
      assert.ok(line);
      assert.equal(line.props.numberOfLines, undefined, 'V3 prose must not be truncated');
    }
    assert.ok(!rendered.includes('LEGACY'));
    assert.equal(rendered.split(v3.closeMessage).length - 1, 1);
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
      CheckinQuestionLoading: 'QuestionLoading',
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
    const loadingState = nodes(tree).find(n => n.type === 'QuestionLoading');
    assert.ok(loadingState);
    assert.equal(loadingState.props.first, true);
    assert.equal(loadingState.props.active, true);
  });
  function resultHarness() {
    const source = fs.readFileSync('app/checkin/index.tsx', 'utf8');
    const ast = ts.createSourceFile('checkin.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const fragment = ['stripEmojis', 'extractRecordedSymptoms', 'DoneScreen'].map(name =>
      ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(ast),
    ).join('\n') + '\nmodule.exports=DoneScreen;';
    const effects = [], calls = [], navigation = [], slots = [], timers = new Map();
    let cursor = 0, now = 0, timerId = 0, stopCalls = 0;
    let locale = lang;
    let audio = { phase: 'idle', prompt: null, fallback: false };
    const play = (...args) => {
      calls.push(args);
      audio = { phase: 'loading', prompt: { key: args[0], text: args[1], language: locale }, fallback: false };
      return Promise.resolve();
    };
    const stopAudio = async () => { stopCalls++; audio = { phase: 'idle', prompt: null, fallback: false }; };
    const hooks = {
      useState(initial) {
        const index = cursor++;
        slots[index] ??= { value: initial };
        return [slots[index].value, value => {
          slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
        }];
      },
      useRef(initial) {
        const index = cursor++;
        slots[index] ??= { current: initial };
        return slots[index];
      },
      useEffect(fn, deps) {
        const index = cursor++, old = slots[index];
        if (!old || deps.some((v, i) => !Object.is(v, old.deps[i]))) {
          slots[index] = { deps, setup: fn };
          effects.push(() => { old?.cleanup?.(); slots[index].cleanup = fn(); });
        }
      },
    };
    const animation = { duration() { return this; }, delay() { return this; } };
    const globals = {
      ...hooks, ...helper,
      useTranslation: () => ({ t: key => home[key] || key, i18n: { resolvedLanguage: locale } }),
      useRouter: () => ({ push: route => navigation.push(route) }),
      useCheckinCallAudio: () => ({ audio, play, stopAudio }),
      CheckinConclusion, ConclusionLoadingView: 'Loading', View: 'View', Text: 'Text',
      Pressable: 'Button', Ionicons: 'Icon', Svg: 'Svg', Path: 'Path', GuideTarget: 'Guide',
      CheckinHeroBadge: 'Badge', CheckinGiftCloseButton: 'CloseButton',
      Animated: { View: 'Animated' }, FadeIn: animation, FadeInDown: animation,
      isDoctorFeaturesEnabled: false, isExpertConsultationEnabled: true,
      guideColors: { ink: '#0F2942' }, colors: { textSecondary: '#526c66' },
      Linking: { openURL: () => assert.fail('unexpected call') },
      guidanceAudio: { stop: async () => {} }, showToast() {},
      setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, due: now + delay }); return id; },
      clearTimeout: id => timers.delete(id),
    };
    const compiled = ts.transpileModule(fragment, { fileName: 'checkin.tsx', compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    const module = { exports: {} };
    // eslint-disable-next-line no-new-func -- Run the real result screen with controlled audio/timers.
    new Function('module', 'exports', 'require', ...Object.keys(globals), compiled)(
      module, module.exports, () => ({ jsx, jsxs: jsx }), ...Object.values(globals),
    );
    let props = { styles: {}, session: { id: 12, current_status: 'tired', initial_status: 'tired', triage_messages: [] },
      triageSummary: result, isFollowUp: false, onClose() {} };
    const render = (next = props) => {
      props = next; cursor = 0; effects.length = 0;
      const tree = module.exports(props);
      for (const effect of effects) effect();
      return tree;
    };
    const settle = (next = props) => { render(next); render(); return render(); };
    return {
      calls, navigation, timers, render, settle, get props() { return props; }, get stopCalls() { return stopCalls; },
      phase: (phase, prompt) => { audio = { ...audio, phase, ...(prompt ? { prompt } : {}) }; },
      language: next => { locale = next; },
      advance(ms) {
        now += ms;
        for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.fn(); }
        return settle();
      },
      strictReplay() {
        const active = slots.filter(slot => slot?.setup);
        for (const slot of active) slot.cleanup?.();
        for (const slot of active) slot.cleanup = slot.setup();
      },
      cleanup() { for (const slot of slots) slot?.cleanup?.(); },
    };
  }
  const loading = tree => nodes(tree).some(n => n.type === 'Loading');
  const hasResult = tree => nodes(tree).some(n => n.type === CheckinConclusion);
  test(`${lang}: legacy results show the saved summary and only actual symptoms`, () => {
    const h = resultHarness();
    try {
      const summary = 'Saved assessment with the reported symptoms and their course.';
      const tree = h.settle({ ...h.props, readOnly: true,
        triageSummary: { severity: 'medium', summary, recommendation: 'Saved advice', needsDoctor: false,
          recordedSymptoms: ['Đầy hơi', 'Khó tiêu'] },
        answers: [{ step: 'onset', question: 'Khi nào?', answer: 'Từ 1 đến dưới 3 ngày' }] });
      const assessment = nodes(tree).find(n => n.props?.testID === 'checkin-legacy-summary');
      assert.ok(assessment); assert.ok(text(assessment).includes(summary));
      assert.ok(text(tree).includes('Đầy hơi, Khó tiêu'));
      assert.ok(!text(tree).includes('Từ 1 đến dưới 3 ngày'));
    } finally { h.cleanup(); }
  });
  test(`${lang}: DoneScreen waits for the narrative recording and passes the free message to its renderer`, () => {
    const h = resultHarness();
    const value = { ...result, conclusionFormat: 'narrative', narrative: 'A personal message.\n\n- A useful action.', speechText: `A personal message. ${result.closeMessage} ${result.aiNotice}` };
    try {
      const next = { ...h.props, triageSummary: value };
      assert.ok(loading(h.settle(next)));
      assert.deepEqual(h.calls, [['conclusion', helper.checkinConclusionSpeech(value)]]);
      h.phase('playing');
      const tree = h.settle();
      const rendered = nodes(tree).find(n => n.type === CheckinConclusion);
      assert.ok(rendered);
      assert.equal(rendered.props.result.narrative, value.narrative);
      assert.ok(!text(tree).includes(home.checkinSeeDoctor));
    } finally { h.cleanup(); }
  });
  test(`${lang}: structured conclusion waits for its recording, not the old 4.5-second timer`, () => {
    const h = resultHarness();
    try {
      assert.ok(loading(h.settle()));
      assert.deepEqual(h.calls, [['conclusion', helper.structuredCheckinSpeech(result)]]);
      assert.ok(loading(h.advance(4500)));
      assert.ok(loading(h.advance(15000)), 'Slow synthesis must keep the runner visible');
      assert.equal(h.calls.length, 1, 'Loading rerenders cannot synthesize twice');
      h.phase('playing');
      const tree = h.settle();
      assert.ok(hasResult(tree)); assert.ok(!loading(tree));
      assert.equal(nodes(tree).filter(n => n.props?.testID === 'checkin-ai-notice').length, 1);
      assertAiNotice(tree, result.aiNotice);
      assert.ok(!text(tree).includes(home.checkinSeeDoctor));
      assert.equal(h.timers.size, 0, 'Ready audio clears the watchdog');
      nodes(tree).find(n => n.type === CheckinConclusion).props.onConnectExpert();
      assert.deepEqual(h.navigation, ['/doctor-consultation']);
      h.phase('finished'); assert.ok(hasResult(h.settle()));
      assert.equal(h.calls.length, 1);
    } finally { h.cleanup(); }
  });
  test(`${lang}: a new result cannot reuse an old ready state or a stale recording`, () => {
    const h = resultHarness();
    try {
      h.settle(); h.phase('finished'); assert.ok(hasResult(h.settle()));
      const next = { ...h.props, session: { ...h.props.session, id: 13 } };
      assert.ok(loading(h.render(next)), 'Even an identical transcript from another session waits');
      assert.ok(loading(h.settle()));
      h.phase('playing', { key: 'conclusion', text: 'STALE RESULT', language: lang });
      assert.ok(loading(h.settle()));
      h.phase('playing', { key: 'conclusion', text: helper.structuredCheckinSpeech(result), language: lang });
      assert.ok(hasResult(h.settle()));
      const changed = { ...h.props, triageSummary: { ...result, personalMessage: 'NEXT RESULT' } };
      assert.ok(loading(h.settle(changed)));
      assert.equal(h.calls.length, 3);
      h.phase('finished'); assert.ok(hasResult(h.settle()), 'A cached/very short recording can already have finished');
      const original = { ...h.props, session: { ...h.props.session, id: 12 }, triageSummary: result };
      assert.ok(loading(h.settle(original)));
      assert.ok(loading(h.settle(changed)), 'Returning to a previously ready result must wait after its audio was stopped');
    } finally { h.cleanup(); }
  });
  test(`${lang}: replay keeps the conclusion visible and development effect replay restarts only stopped speech`, () => {
    const h = resultHarness();
    try {
      h.settle(); h.strictReplay(); h.settle();
      assert.equal(h.calls.length, 2); assert.ok(h.stopCalls > 0);
      h.phase('playing'); let tree = h.settle(); assert.ok(hasResult(tree));
      nodes(tree).find(n => n.props?.accessibilityLabel === home.checkinReplaySound).props.onPress();
      tree = h.settle(); assert.ok(hasResult(tree)); assert.ok(!loading(tree));
      assert.equal(h.calls.length, 3);
      h.settle(); assert.equal(h.calls.length, 3);
      assert.equal(h.timers.size, 0, 'Replay must not schedule a new result gate');
    } finally { h.cleanup(); }
  });
  test(`${lang}: failed synthesis reveals readable result and Replay immediately`, () => {
    const h = resultHarness();
    try {
      h.settle(); h.phase('error'); const tree = h.settle();
      assert.ok(hasResult(tree)); assert.ok(text(tree).includes(home.checkinSpeechUnavailable));
      assert.ok(nodes(tree).some(n => n.props?.accessibilityLabel === home.checkinReplaySound));
      assert.equal(h.timers.size, 0);
    } finally { h.cleanup(); }
  });
  test(`${lang}: a stuck player has one bounded deadline and cannot keep the result hidden`, () => {
    const h = resultHarness();
    try {
      h.settle(); assert.ok(loading(h.advance(159000)));
      h.phase('loading'); h.settle();
      assert.ok(loading(h.advance(999)));
      const tree = h.advance(1);
      assert.ok(hasResult(tree)); assert.ok(text(tree).includes(home.checkinSpeechUnavailable));
      assert.equal(h.stopCalls, 1, 'Stop invalidates any late recording before showing text');
      h.phase('playing'); assert.ok(!text(h.settle()).includes(home.checkinSpeechUnavailable));
    } finally { h.cleanup(); assert.equal(h.timers.size, 0); }
  });
  test(`${lang}: emergency, preview and practice results bypass the audio gate`, () => {
    for (const variant of [{ triageSummary: { ...result, severity: 'emergency' } }, { readOnly: true }, { practice: true }]) {
      const h = resultHarness();
      try {
        const tree = h.settle({ ...h.props, ...variant });
        assert.ok(!loading(tree)); assert.equal(h.timers.size, 0);
        assertAiNotice(tree, result.aiNotice);
        if (variant.readOnly || variant.practice) assert.equal(h.calls.length, 0);
        if (variant.triageSummary) {
          assert.ok(!nodes(tree).some(n => n.type === 'Pressable' && nodes(n).some(child => child.type === 'Text' && child.props.children === home.checkinCallEmergency)));
          assert.ok(text(tree).includes(home.checkinEmergencyAdvice), 'Emergency advice remains visible without a call CTA');
        }
      } finally { h.cleanup(); }
    }
  });
  test(`${lang}: legacy/fine conclusions use the same audio gate and unmount clears its deadline`, () => {
    const h = resultHarness();
    try {
      assert.ok(loading(h.settle({ ...h.props, session: { ...h.props.session, initial_status: 'fine', current_status: 'fine' }, triageSummary: null })));
      assert.equal(h.calls.length, 1);
      h.phase('playing'); const tree = h.settle();
      assert.ok(!loading(tree)); assert.ok(text(tree).includes(home.checkinDoneNoted));
      assertAiNotice(tree, home.checkinAiNotice);
    } finally { h.cleanup(); assert.equal(h.timers.size, 0); }
    const pending = resultHarness(); pending.settle(); assert.equal(pending.timers.size, 1);
    pending.cleanup(); assert.equal(pending.timers.size, 0); assert.equal(pending.stopCalls, 1);
  });
  test(`${lang}: changing language waits for the matching new audio instead of exposing the previous language`, () => {
    const h = resultHarness();
    try {
      h.settle(); h.phase('playing'); assert.ok(hasResult(h.settle()));
      const nextLanguage = lang === 'vi' ? 'en' : 'vi';
      h.language(nextLanguage); assert.ok(loading(h.settle()));
      h.phase('playing', { key: 'conclusion', text: helper.structuredCheckinSpeech(result), language: lang });
      assert.ok(loading(h.settle()));
      h.phase('playing', { key: 'conclusion', text: helper.structuredCheckinSpeech(result), language: nextLanguage });
      assert.ok(hasResult(h.settle()));
    } finally { h.cleanup(); }
  });
}

function loadingHarness(language = 'vi', height = 852) {
  const slots = [], effects = [], timers = new Map(), listeners = new Map();
  let cursor = 0, now = 0, nextTimer = 0, query;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [slots[index].value, value => {
        slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
      }];
    },
    useEffect(fn, deps) {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        slots[index] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[index].cleanup = fn(); });
      }
    },
  };
  const addListener = (name, fn) => { listeners.set(name, fn); return { remove: () => listeners.delete(name) }; };
  const home = JSON.parse(fs.readFileSync(`src/i18n/locales/${language}/home.json`));
  const component = evaluate('src/features/checkin/CheckinConclusionLoading.tsx', {
    react: hooks,
    'react-native': {
      View: 'View', Image: 'Image', StyleSheet: { create: value => value },
      useWindowDimensions: () => ({ width: 320, height }),
      AppState: { currentState: 'active', addEventListener: (name, fn) => addListener('app:' + name, fn) },
      AccessibilityInfo: {
        addEventListener: addListener,
        isReduceMotionEnabled: () => ({ then: fn => { query = fn; return { catch() {} }; } }),
      },
    },
    'react-i18next': { useTranslation: () => ({ t: (key, args = {}) => home[key].replace('{{percent}}', args.percent) }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) },
    '../../components/ScaledText': { ScaledText: 'Text' },
    '../../../assets/images/medication/asinu-running-sprite-v1.png': 'actual-running-sprite',
  }, { Date: { now: () => now }, setInterval: (fn, delay) => {
    const id = ++nextTimer; timers.set(id, { fn, delay }); return id;
  }, clearInterval: id => timers.delete(id) });
  const render = () => {
    cursor = 0; effects.length = 0;
    const tree = component.CheckinConclusionLoading();
    for (const work of effects) work();
    return tree;
  };
  const settle = () => { render(); return render(); };
  return {
    ...component, timers, listeners, settle, query: enabled => query(enabled),
    advance(ms) { now += ms; for (const { fn } of [...timers.values()]) fn(); return settle(); },
    cleanup() { for (const slot of slots) slot?.cleanup?.(); },
  };
}
test('estimated audio progress is monotonic, clearly estimated and never completes before audio', () => {
  const h = loadingHarness();
  const values = [-1, 0, 500, 3000, 10000, 60000, 3600000].map(h.estimatedConclusionAudioProgress);
  assert.equal(values[0], 8); assert.equal(values.at(-1), 94);
  assert.ok(values.every((value, i) => value >= 8 && value < 100 && (!i || value >= values[i - 1])));
});
for (const language of ['vi', 'en']) for (const height of [568, 852]) {
  test(`${language}/${height}: actual loading UI has the running asset, estimated percent and a bounded sprite viewport`, () => {
    const h = loadingHarness(language, height);
    try {
      let tree = h.settle();
      const image = nodes(tree).find(n => n.props?.testID === 'checkin-conclusion-runner');
      assert.equal(image.props.source, 'actual-running-sprite');
      assert.equal(image.props.style.width, (height < 650 ? 160 : 196) * 2);
      assert.ok(text(tree).includes('8%'));
      let bar = nodes(tree).find(n => n.props?.accessibilityRole === 'progressbar');
      assert.equal(bar.props.accessibilityValue.now, 8);
      assert.match(bar.props.accessibilityValue.text, language === 'vi' ? /Khoảng/ : /About/);
      tree = h.advance(16000);
      assert.ok(text(tree).includes(language === 'vi' ? 'đợi thêm' : 'little longer'));
      bar = nodes(tree).find(n => n.props?.accessibilityRole === 'progressbar');
      assert.ok(bar.props.accessibilityValue.now > 8 && bar.props.accessibilityValue.now < 100);
    } finally { h.cleanup(); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0); }
  });
}
test('running animation respects Reduce Motion, pauses in background and releases every timer/listener', () => {
  const h = loadingHarness();
  const image = tree => nodes(tree).find(n => n.props?.testID === 'checkin-conclusion-runner');
  try {
    h.settle(); assert.equal(h.timers.size, 1, 'Only the progress estimate runs before accessibility settings resolve');
    h.query(false); h.settle(); assert.equal(h.timers.size, 2);
    assert.notEqual(image(h.advance(150)).props.style.transform[0].translateX, 0, 'Actual sprite changes running pose');
    h.listeners.get('app:change')('background'); h.settle(); assert.equal(h.timers.size, 1);
    h.listeners.get('app:change')('active'); h.settle(); assert.equal(h.timers.size, 2);
    h.listeners.get('reduceMotionChanged')(true); h.settle(); assert.equal(h.timers.size, 1);
    assert.equal(Math.abs(image(h.advance(150)).props.style.transform[0].translateX), 0);
    h.query(false); h.settle(); assert.equal(h.timers.size, 1, 'An old settings query cannot undo the user preference');
  } finally { h.cleanup(); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0); }
  h.query(false); assert.equal(h.timers.size, 0, 'Late accessibility queries cannot restart an unmounted animation');
});
console.log(`Check-in conclusion: ${count} runtime regressions passed.`);
