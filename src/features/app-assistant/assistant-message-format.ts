export type AssistantMessageBlock =
  | { kind: 'heading' | 'paragraph'; text: string }
  | { kind: 'list'; items: { marker: string; text: string }[] }
  | { kind: 'details'; items: { label: string; value: string }[] };

const heading = (line: string) => /^(?:#{1,3}\s+(.+)|\*\*(.+)\*\*|__(.+)__)\s*$/.exec(line.trim());
const listItem = (line: string) => /^(\d+[.)]|[-*•])\s+(.+)$/.exec(line.trim());
const divider = (line: string) => /^(?:-{3,}|_{3,}|\*{3,})$/u.test(line.trim());
function detail(line: string) {
  if (/^[a-z][a-z\d+.-]*:\/\//iu.test(line.trim())) return null;
  const match = /^([^:\n]{1,80}):\s+(.{1,140})$/.exec(line.trim());
  return match ? { label: match[1], value: match[2] } : null;
}

/** Presentation only: saved text, values, units and reported statuses stay intact. */
export function parseAssistantMessage(text: string): AssistantMessageBlock[] {
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  const blocks: AssistantMessageBlock[] = [];
  const detailsStart = (index: number) => detail(lines[index] || '') && detail(lines[index + 1] || '');
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line || divider(line)) { index++; continue; }
    const title = heading(line);
    if (title) { blocks.push({ kind: 'heading', text: title[1] || title[2] || title[3] }); index++; continue; }
    if (listItem(line)) {
      const items: { marker: string; text: string }[] = [];
      while (index < lines.length) {
        const item = listItem(lines[index]);
        if (!item) break;
        items.push({ marker: /^\d/u.test(item[1]) ? item[1] : '•', text: item[2] });
        index++;
        while (index < lines.length && /^\s{2,}\S/u.test(lines[index]) && !listItem(lines[index])) {
          items[items.length - 1].text += `\n${lines[index].trim()}`; index++;
        }
      }
      blocks.push({ kind: 'list', items }); continue;
    }
    if (detailsStart(index)) {
      const items: { label: string; value: string }[] = [];
      while (index < lines.length) {
        const item = detail(lines[index]);
        if (!item) break;
        items.push(item); index++;
      }
      blocks.push({ kind: 'details', items }); continue;
    }
    const paragraph = [line]; index++;
    while (index < lines.length && lines[index].trim() && !divider(lines[index]) && !heading(lines[index]) && !listItem(lines[index]) && !detailsStart(index)) {
      paragraph.push(lines[index].trim()); index++;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n') });
  }
  return blocks.map((block, index) => block.kind === 'paragraph' && !block.text.includes('\n') &&
    block.text.length <= 80 && !/[.!?]$/u.test(block.text) &&
    ['details', 'list'].includes(blocks[index + 1]?.kind || '')
    ? { kind: 'heading', text: block.text.replace(/:$/u, '') } : block);
}

export function assistantTextSpans(text: string) {
  const spans: { text: string; strong: boolean }[] = [];
  const pattern = /\*\*([^*\n]+)\*\*|__([^_\n]+)__/gu;
  let previous = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index!;
    if (index > previous) spans.push({ text: text.slice(previous, index), strong: false });
    spans.push({ text: match[1] || match[2], strong: true });
    previous = index + match[0].length;
  }
  if (previous < text.length) spans.push({ text: text.slice(previous), strong: false });
  return spans;
}
