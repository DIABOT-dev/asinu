// Regenerate when the backend voice or localized native handoff prompt changes. Requires ffmpeg.
// Usage: node scripts/generate-checkin-handoff-voice.mjs ../backend.asinu/.env --lang vi
// Normalize the existing recording without contacting TTS:
// node scripts/generate-checkin-handoff-voice.mjs --normalize-existing
// Export an audition of the current generic check-in reminder (not bundled):
// node scripts/generate-checkin-handoff-voice.mjs ../backend.asinu/.env --sample --lang vi
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const normalizeExisting = args.includes('--normalize-existing');
const sample = args.includes('--sample');
const langIndex = args.indexOf('--lang');
const language = langIndex === -1 ? 'vi' : args[langIndex + 1];
if (!['vi', 'en'].includes(language)) {throw new Error('--lang must be vi or en');}
const envPath = args.find((arg, index) => !arg.startsWith('--') && (langIndex === -1 || index !== langIndex + 1));
const directory = new URL(sample ? '../artifacts/voice/' : '../assets/sounds/', import.meta.url);
const basename = sample ? `asinu_tuan_anh_checkin_${language}` : `asinu_checkin_open_app_${language}`;
const file = `${basename}.mp3`;
const manifestFile = `${basename}.json`;
const translations = JSON.parse(await readFile(new URL(`../locales/${language}.json`, import.meta.url), 'utf8'));
const previous = normalizeExisting
  ? JSON.parse(await readFile(new URL(manifestFile, directory), 'utf8'))
  : null;
const env = normalizeExisting ? {} : (envPath
  ? parseEnv(await readFile(resolve(envPath), 'utf8'))
  : process.env);
const backendDirectory = envPath ? dirname(resolve(envPath)) : resolve('../backend.asinu');
const backendTranslations = sample
  ? JSON.parse(await readFile(join(backendDirectory, `src/i18n/locales/${language}.json`), 'utf8')) : null;
// Generic production wording only: no user identity or invented health data.
const text = sample
  ? ['checkinCall.voice.greeting', 'checkinCall.voice.general_question', 'checkinCall.voice.choices']
    .map(key => {
      const phrase = backendTranslations[key];
      if (typeof phrase !== 'string') {throw new Error('Missing sample localization');}
      return phrase.replace(/\{\{recipient\}\}/g, backendTranslations['checkinCall.voice.address_bac'] || 'you');
    }).join(' ')
  : translations.ios['Localizable.strings'].checkin_call_open_app_prompt;
const voice = normalizeExisting ? previous.voice : (env.VIENEU_VOICE?.trim() || 'clone_b935a451-7d65-4b73-a083-d46e56c47d4f');
if (typeof voice !== 'string' || !voice.trim()) {throw new Error('Missing Asinu voice');}
if (!text) {throw new Error('Missing handoff localization');}
const tool = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
if (tool.error || tool.status !== 0) {throw new Error('ffmpeg is required to normalize speech loudness before bundling.');}

let raw;
if (normalizeExisting) {
  raw = await readFile(new URL(file, directory));
  if (previous.voice !== voice || previous.text !== text ||
      previous.audioSha256 !== createHash('sha256').update(raw).digest('hex')) {
    throw new Error('Existing speech asset does not match its voice, localization, or checksum; regenerate it.');
  }
} else {
  if (!env.VIENEU_API_KEY) {throw new Error('VIENEU_API_KEY is required; credentials are never written to the asset.');}
  const { synthesizeSpeech } = createRequire(import.meta.url)(join(backendDirectory, 'src/services/voice/vieneu.service.js'));
  const recording = await synthesizeSpeech({ text, voice, apiKey: env.VIENEU_API_KEY, timeoutMs: 60000 });
  raw = recording.audio_data;
}
if (raw.length < 1000 || raw.length > 2_000_000) {throw new Error('Invalid speech asset size');}

// One consistent speech level, with peak headroom instead of unchecked gain.
// This changes the recording only; never alter the user's system/call volume.
const target = 'loudnorm=I=-16:TP=-1.5:LRA=7';
const temporary = await mkdtemp(join(tmpdir(), 'asinu-handoff-loudness-'));
let data;
let loudness;
const ffmpeg = ffmpegArgs => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...ffmpegArgs], {
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
  const input = join(temporary, 'source.audio');
  const output = join(temporary, 'normalized.mp3');
  await writeFile(input, raw);
  const measured = analyze(input);
  let normalization = 'ebu-r128-two-pass';
  const filter = target + `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
    `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
    `:offset=${measured.target_offset}:linear=true`;
  ffmpeg(['-i', input, '-af', filter, '-ar', '48000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '128k', output]);
  let verified = analyze(output);
  if (Math.abs(Number(verified.input_i) + 16) > 0.5 || Number(verified.input_tp) > -1) {
    normalization = 'ebu-r128-dynamic-verified';
    // Nonstationary/short speech may not satisfy loudnorm's linear-mode
    // assumptions. Reprocess the same source in dynamic mode, not another
    // paid TTS request, and still verify the final encoded MP3.
    ffmpeg(['-y', '-i', input, '-af', target + ':linear=false', '-ar', '48000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '128k', output]);
    verified = analyze(output);
  }
  for (let pass = 0; pass < 2 && Math.abs(Number(verified.input_i) + 16) > 0.5; pass++) {
    // The MP3 encoder can shift integrated loudness of brief speech. Apply
    // the measured encoding offset to the original source, not to re-encoded
    // audio; leave extra true-peak headroom and verify every final file.
    const offset = -16 - Number(verified.input_i);
    const adjusted = `loudnorm=I=${-16 + offset}:TP=-2:LRA=7:linear=false`;
    ffmpeg(['-y', '-i', input, '-af', adjusted, '-ar', '48000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '128k', output]);
    verified = analyze(output);
  }
  if (Math.abs(Number(verified.input_i) + 16) > 0.5 || Number(verified.input_tp) > -1) {
    throw new Error(`Normalized speech failed safety checks (${verified.input_i} LUFS, ${verified.input_tp} dBTP).`);
  }
  data = await readFile(output);
  loudness = {
    normalization,
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
await writeFile(new URL(manifestFile, directory), JSON.stringify({
  file, language, voice, text,
  textSha256: createHash('sha256').update(text).digest('hex'),
  audioSha256: createHash('sha256').update(data).digest('hex'),
  loudness,
}, null, 2) + '\n');
console.log(`Generated ${file}: ${voice}, ${data.length} bytes, ${loudness.integratedLufs} LUFS, ${loudness.truePeakDbtp} dBTP (no credentials stored)`);
