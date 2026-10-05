// Regenerate only when the localized native handoff prompt changes.
// Usage: node scripts/generate-checkin-handoff-voice.mjs ../backend.asinu/.env
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';

const env = process.argv[2] ? parseEnv(await readFile(resolve(process.argv[2]), 'utf8')) : process.env;
if (!env.VIENEU_API_KEY) throw new Error('VIENEU_API_KEY is required; credentials are never written to the asset.');
const translations = JSON.parse(await readFile(new URL('../locales/vi.json', import.meta.url), 'utf8'));
const text = translations.ios['Localizable.strings'].checkin_call_open_app_prompt;
const voice = 'Ngọc Lan';
if (!text) throw new Error('Missing Vietnamese handoff localization');
const response = await fetch('https://api.vieneu.io/api/v1/audio/speech', {
  method: 'POST',
  headers: { Authorization: `Bearer ${env.VIENEU_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: text, voice, response_format: 'mp3' }),
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`Speech synthesis failed (HTTP ${response.status})`);
const data = Buffer.from(await response.arrayBuffer());
if (data.length < 1000 || data.length > 2_000_000) throw new Error('Invalid speech asset size');
const directory = new URL('../assets/sounds/', import.meta.url);
await mkdir(directory, { recursive: true });
const file = 'asinu_checkin_open_app_vi.mp3';
await writeFile(new URL(file, directory), data);
await writeFile(new URL('asinu_checkin_open_app_vi.json', directory), JSON.stringify({
  file, language: 'vi', voice, text,
  textSha256: createHash('sha256').update(text).digest('hex'),
  audioSha256: createHash('sha256').update(data).digest('hex'),
}, null, 2) + '\n');
console.log(`Generated ${file}: ${voice}, ${data.length} bytes (no credentials stored)`);
