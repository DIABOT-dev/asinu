import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SourceMapConsumer } from 'source-map';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust this list to map additional bundle positions.
const targets = [
  { line: 199960, column: 78 },
];

const mapPath = path.join(
  __dirname,
  '..',
  'dist/_expo/static/js/android/entry-d41d8cd98f00b204e9800998ecf8427e.js.map'
);

const raw = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const consumer = new SourceMapConsumer(raw);

for (const target of targets) {
  const orig = consumer.originalPositionFor({
    line: target.line,
    column: target.column,
    bias: SourceMapConsumer.GREATEST_LOWER_BOUND,
  });

  console.log(`>>> bundle ${target.line}:${target.column}`);
  if (!orig || !orig.source) {
    console.log('  no mapping found');
    continue;
  }

  const notes = [];
  if (orig.source.includes('_archive/')) notes.push('maps to _archive/');
  if (orig.source.includes('legacy/')) notes.push('maps to legacy/');
  if (orig.source.includes('node_modules/')) notes.push('maps to node_modules/');

  console.log(`  source: ${orig.source}`);
  console.log(`  mapped line: ${orig.line}, column: ${orig.column}`);
  if (notes.length) console.log(`  note: ${notes.join('; ')}`);

  const content = consumer.sourceContentFor(orig.source, true);
  const inApp = orig.source.startsWith('app/');
  const inSrc = orig.source.startsWith('src/');
  if (content && (inApp || inSrc)) {
    const lines = content.split(/\r?\n/);
    const start = Math.max(0, orig.line - 3);
    const end = Math.min(lines.length, orig.line + 2);
    for (let i = start; i < end; i++) {
      const marker = i + 1 === orig.line ? '>' : ' ';
      console.log(`${marker} ${String(i + 1).padStart(6)}: ${lines[i]}`);
    }
  }
}

consumer.destroy?.();
