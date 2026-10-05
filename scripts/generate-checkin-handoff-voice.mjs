// Regenerate only when the localized native handoff prompt changes. Requires ffmpeg.
// Usage: node scripts/generate-checkin-handoff-voice.mjs ../backend.asinu/.env
// Normalize the existing recording without contacting TTS:
// node scripts/generate-checkin-handoff-voice.mjs --normalize-existing
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { parseEnv } from 'node:util';
import { join, resolve } from 'node:path';

const normalizeExisting = process.argv[2] === '--normalize-existing';
const directory = new URL('../assets/sounds/', import.meta.url);
const file = 'asinu_checkin_open_app_vi.mp3';
const translations = JSON.parse(await readFile(new URL('../locales/vi.json', import.meta.url), 'utf8'));
const text = translations.ios['Localizable.strings'].checkin_call_open_app_prompt;
const voice = 'Ngọc Lan';
if (!text) {throw new Error('Missing Vietnamese handoff localization');}
const tool = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
if (tool.error || tool.status !== 0) {throw new Error('ffmpeg is required to normalize speech loudness before bundling.');}

let raw;
if (normalizeExisting) {
  const previous = JSON.parse(await readFile(new URL('asinu_checkin_open_app_vi.json', directory), 'utf8'));
  raw = await readFile(new URL(file, directory));
  if (previous.voice !== voice || previous.text !== text ||
      previous.audioSha256 !== createHash('sha256').update(raw).digest('hex')) {
    throw new Error('Existing speech asset does not match its voice, localization, or checksum; regenerate it.');
  }
} else {
  const env = process.argv[2] ? parseEnv(await readFile(resolve(process.argv[2]), 'utf8')) : process.env;
  if (!env.VIENEU_API_KEY) {throw new Error('VIENEU_API_KEY is required; credentials are never written to the asset.');}
  const response = await fetch('https://api.vieneu.io/api/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.VIENEU_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text, voice, response_format: 'mp3' }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {throw new Error(`Speech synthesis failed (HTTP ${response.status})`);}
  raw = Buffer.from(await response.arrayBuffer());
}
if (raw.length < 1000 || raw.length > 2_000_000) {throw new Error('Invalid speech asset size');}

// One consistent speech level, with peak headroom instead of unchecked gain.
// This changes the recording only; never alter the user's system/call volume.
const target = 'loudnorm=I=-16:TP=-1.5:LRA=7';
const temporary = await mkdtemp(join(tmpdir(), 'asinu-handoff-loudness-'));
let data;
let loudness;
const ffmpeg = args => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) {throw new Error('Speech loudness normalization failed.');}
  return result.stderr;
};
const analyze = input => {
  const output = ffmpeg(['-i', input, '-af', target + ':print_format=json', '-f', 'null', '-']);
  const json = output.match(/\{[\s\S]*?\}/g)?.at(-1);
  if (!json) {throw new Error('Missing speech loudness measurements.');}
  const measured = JSON.parse(json);
  for (const key of ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset']) {
    if (!Number.isFinite(Number(measured[key]))) {throw new Error('Invalid speech loudness measurements.');}
  }
  return measured;
};
try {
  const input = join(temporary, 'source.mp3');
  const output = join(temporary, 'normalized.mp3');
  await writeFile(input, raw);
  const measured = analyze(input);
  const filter = target + `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
    `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
    `:offset=${measured.target_offset}:linear=true`;
  ffmpeg(['-i', input, '-af', filter, '-ar', '48000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '128k', output]);
  const verified = analyze(output);
  if (Math.abs(Number(verified.input_i) + 16) > 0.5 || Number(verified.input_tp) > -1) {
    throw new Error('Normalized speech failed loudness/peak safety checks.');
  }
  data = await readFile(output);
  loudness = {
    normalization: 'ebu-r128-two-pass',
    targetIntegratedLufs: -16,
    targetTruePeakDbtp: -1.5,
    integratedLufs: Number(verified.input_i),
    truePeakDbtp: Number(verified.input_tp),
  };
} finally {
  await rm(temporary, { recursive: true, force: true });
}
await mkdir(directory, { recursive: true });
await writeFile(new URL(file, directory), data);
await writeFile(new URL('asinu_checkin_open_app_vi.json', directory), JSON.stringify({
  file, language: 'vi', voice, text,
  textSha256: createHash('sha256').update(text).digest('hex'),
  audioSha256: createHash('sha256').update(data).digest('hex'),
  loudness,
}, null, 2) + '\n');
console.log(`Generated ${file}: ${voice}, ${data.length} bytes, ${loudness.integratedLufs} LUFS, ${loudness.truePeakDbtp} dBTP (no credentials stored)`);
