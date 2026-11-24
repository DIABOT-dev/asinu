const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function evaluate(file, dependencies = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('module', 'exports', 'require', source)(module, module.exports, id => {
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
    return dependencies[id];
  });
  return module.exports;
}
const formatting = evaluate('src/features/app-assistant/assistant-message-format.ts');
const { parseAssistantMessage, assistantTextSpans } = formatting;

test('daily task replies separate task names and exact server progress without inferring status', () => {
  assert.deepEqual(parseAssistantMessage('Check-in hằng ngày: 0/1\nĐo huyết áp: 1/2\nĐo đường huyết: 0/2\nUống nước: 4/4 (đã hoàn thành)'), [{
    kind: 'details', items: [
      { label: 'Check-in hằng ngày', value: '0/1' },
      { label: 'Đo huyết áp', value: '1/2' },
      { label: 'Đo đường huyết', value: '0/2' },
      { label: 'Uống nước', value: '4/4 (đã hoàn thành)' },
    ],
  }]);
});

test('health readings retain their exact values, units, dates and times', () => {
  const blocks = parseAssistantMessage('**Số đo hôm nay**\r\nHuyết áp: 120/80 mmHg\r\nĐường huyết: 95 mg/dL\r\nGiờ đo: 16/11/2026 07:30');
  assert.deepEqual(blocks, [
    { kind: 'heading', text: 'Số đo hôm nay' },
    { kind: 'details', items: [
      { label: 'Huyết áp', value: '120/80 mmHg' },
      { label: 'Đường huyết', value: '95 mg/dL' },
      { label: 'Giờ đo', value: '16/11/2026 07:30' },
    ] },
  ]);
});

test('headings, bullets and numbered steps read as structured content with all wording retained', () => {
  assert.deepEqual(parseAssistantMessage('Nhiệm vụ hôm nay:\n- **Uống nước** theo nhu cầu\n- Ghi lại huyết áp\n  khi đã đo xong\n\n### Các bước\n1. Mở lịch thuốc\n2) Kiểm tra giờ'), [
    { kind: 'heading', text: 'Nhiệm vụ hôm nay' },
    { kind: 'list', items: [
      { marker: '•', text: '**Uống nước** theo nhu cầu' },
      { marker: '•', text: 'Ghi lại huyết áp\nkhi đã đo xong' },
    ] },
    { kind: 'heading', text: 'Các bước' },
    { kind: 'list', items: [{ marker: '1.', text: 'Mở lịch thuốc' }, { marker: '2)', text: 'Kiểm tra giờ' }] },
  ]);
  assert.deepEqual(assistantTextSpans('Đã ghi **200 ml** nước; __chưa đổi giờ__. **giữ nguyên'), [
    { text: 'Đã ghi ', strong: false }, { text: '200 ml', strong: true },
    { text: ' nước; ', strong: false }, { text: 'chưa đổi giờ', strong: true },
    { text: '. **giữ nguyên', strong: false },
  ]);
});

test('ordinary replies, links and unmeasured statuses remain readable text without invented task progress', () => {
  assert.deepEqual(parseAssistantMessage('Bạn vẫn có thể nói thêm nhé.\nMình đang nghe.\n---\nhttps://example.com/path: info\nhttps://example.com/help: more'), [
    { kind: 'paragraph', text: 'Bạn vẫn có thể nói thêm nhé.\nMình đang nghe.' },
    { kind: 'paragraph', text: 'https://example.com/path: info\nhttps://example.com/help: more' },
  ]);
  assert.deepEqual(parseAssistantMessage('Đường huyết: Chưa đo'), [{ kind: 'paragraph', text: 'Đường huyết: Chưa đo' }]);
});

test('the message renderer exposes headings and selectable, untruncated content through the app scaled text', () => {
  const element = (type, props) => ({ type, props });
  const { AssistantMessageContent } = evaluate('src/features/app-assistant/AssistantMessageContent.tsx', {
    react: { useMemo: work => work() },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': { View: 'View', StyleSheet: { create: value => value, hairlineWidth: 1 } },
    '../../components/ScaledText': { ScaledText: 'ScaledText' },
    '../../hooks/useThemeColors': { useThemeColors: () => ({ colors: { textPrimary: '#111', primaryText: '#165', border: '#ddd' } }) },
    './assistant-message-format': formatting,
  });
  const longText = 'Nội dung kết luận được giữ nguyên. '.repeat(150);
  const tree = AssistantMessageContent({ text: `## Nhiệm vụ hôm nay\nĐo đường huyết: 0/2\nUống nước: 0/4\n\n- **Tiếp tục** khi sẵn sàng\n\n${longText}` });
  const all = [];
  const walk = value => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object') return;
    all.push(value); walk(value.props?.children);
  };
  walk(tree);
  const text = all.filter(node => node.type === 'ScaledText');
  assert.ok(text.some(node => node.props.accessibilityRole === 'header'));
  assert.ok(text.some(node => node.props.children.includes?.(longText.trim())));
  assert.ok(text.every(node => node.props.numberOfLines === undefined));
  assert.ok(text.filter(node => node.props.selectable).length >= 7);
});
