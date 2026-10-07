// Fixed, offline onboarding recordings, using the configured Asinu Tuấn Anh v4 voice.
// Usage: node scripts/generate-guidance-voice.mjs ../backend.asinu/.env
// Valid existing clips are reused without another synthesis request.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const envPath = resolve(process.argv[2] || '../backend.asinu/.env');
const env = parseEnv(await readFile(envPath, 'utf8'));
const voice = env.VIENEU_VOICE?.trim();
const expectedVoice = 'clone_b935a451-7d65-4b73-a083-d46e56c47d4f';
if (voice !== expectedVoice) throw new Error('Configure the established Asinu Tuấn Anh v4 voice before generating guidance.');
if (!env.VIENEU_API_KEY) throw new Error('VIENEU_API_KEY is required; credentials are never stored with assets.');
const { synthesizeSpeech } = createRequire(import.meta.url)(join(dirname(envPath), 'src/services/voice/vieneu.service.js'));
const directory = new URL('../assets/sounds/guidance/', import.meta.url);
const speed = 0.92;
const hash = value => createHash('sha256').update(value).digest('hex');
const steps = ['home.fine', 'home.unwell', 'checkin.choices', 'checkin.other', 'home.suggestions',
  'circle.add', 'circle.phone', 'circle.relationship', 'circle.send', 'circle.member',
  'checkin.practice', 'checkin.status', 'checkin.location', 'checkin.voice', 'checkin.location_confirm', 'checkin.multiple', 'checkin.single',
  'checkin.confirm', 'checkin.result_status', 'checkin.result_symptoms', 'checkin.result_advice',
  'checkin.result_replay', 'checkin.result_doctor', 'checkin.result_emergency', 'checkin.result_family',
  'checkin.result_variants', 'checkin.result_close'];
const run = args => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error('Guidance audio processing failed; ffmpeg must be installed.');
  return result.stderr;
};
run(['-version']);
const target = 'loudnorm=I=-16:TP=-1.5:LRA=7';
const analyze = filename => {
  const output = run(['-i', filename, '-af', target + ':print_format=json', '-f', 'null', '-']);
  const json = output.match(/\{[\s\S]*?\}/g)?.at(-1);
  if (!json) throw new Error('Missing guidance audio measurements.');
  const measured = JSON.parse(json);
  for (const key of ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset']) {
    if (!Number.isFinite(Number(measured[key]))) throw new Error('Invalid guidance audio measurements.');
  }
  return measured;
};
const manifestFile = new URL('manifest.json', directory);
const sourceCache = new URL('../.expo/guidance-voice-cache/', import.meta.url);
let previous = {};
try { previous = JSON.parse(await readFile(manifestFile, 'utf8')); } catch { /* First generation. */ }
const manifest = { schema: 1, voice, voiceLabel: 'Asinu Tuan Anh v4', engine: 'v4', speed, clips: {} };
await mkdir(directory, { recursive: true });
await mkdir(sourceCache, { recursive: true });
const clips = [];
for (const language of ['vi', 'en']) {
  const { guidance } = JSON.parse(await readFile(new URL(`../src/i18n/locales/${language}/onboarding.json`, import.meta.url), 'utf8'));
  for (const id of ['welcome', 'practice_result', ...steps]) {
    // Personal names remain visible in the UI, never uploaded to the voice provider.
    const text = id === 'welcome' ? `${guidance.welcomeTitle}. ${guidance.welcomeBody}`
      : id === 'practice_result' ? guidance.practiceResultAudio
      : id === 'circle.member' ? guidance.circleMemberAudio : guidance.steps[id.replace('.', '_')];
    if (typeof text !== 'string' || !text.trim() || text.includes('{{')) throw new Error(`Missing fixed guidance text: ${language}/${id}`);
    const file = `${language}_${id.replace('.', '_')}.mp3`;
    const old = previous.clips?.[language]?.[id];
    let valid = false;
    if (previous.voice === voice && previous.speed === speed && old?.text === text) {
      try { valid = old.audioSha256 === hash(await readFile(new URL(file, directory))); } catch {}
    }
    clips.push({ language, id, text, file, old: valid ? old : null });
  }
}

async function generate({ language, id, text, file, old }) {
  if (old) { console.log(`Reused ${file}`); return old; }
  const sourceFile = new URL(hash(`${voice}:v4:${text}`) + '.audio', sourceCache);
  let recording;
  try { recording = await readFile(sourceFile); } catch {
    recording = (await synthesizeSpeech({ text, voice, apiKey: env.VIENEU_API_KEY, timeoutMs: 60000 })).audio_data;
    if (recording.length < 1000) throw new Error('Empty guidance recording.');
    await writeFile(sourceFile, recording);
  }
  const temporary = await mkdtemp(join(tmpdir(), 'asinu-guidance-voice-'));
  let data, loudness;
  try {
    const raw = join(temporary, 'source.audio');
    const input = join(temporary, 'slow.wav');
    const output = join(temporary, 'normalized.mp3');
    await writeFile(raw, recording);
    run(['-i', raw, '-af', `atempo=${speed}`, '-ar', '48000', '-ac', '1', input]);
    const measured = analyze(input);
    const filter = target + `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
      `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
      `:offset=${measured.target_offset}:linear=true`;
    const encode = filterValue => run(['-y', '-i', input, '-af', filterValue,
      '-ar', '48000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '128k', output]);
    encode(filter);
    let verified = analyze(output);
    if (Math.abs(Number(verified.input_i) + 16) > 0.5 || Number(verified.input_tp) > -1) {
      encode(target + ':linear=false'); verified = analyze(output);
    }
    for (let pass = 0; pass < 4 && Math.abs(Number(verified.input_i) + 16) > 0.5; pass++) {
      const offset = -16 - Number(verified.input_i);
      encode(`loudnorm=I=${-16 + offset}:TP=-2:LRA=7:linear=false`); verified = analyze(output);
    }
    if (Math.abs(Number(verified.input_i) + 16) > 0.5 || Number(verified.input_tp) > -1) {
      // Brief phrases can defeat loudnorm's dynamic gating. Gain-limit the
      // original slowed PCM, with peak headroom, then verify the encoded MP3.
      let gain = -16 - Number(measured.input_i);
      for (let pass = 0; pass < 5; pass++) {
        encode(`volume=${gain}dB,alimiter=limit=0.79:level=false`);
        verified = analyze(output);
        if (Math.abs(Number(verified.input_i) + 16) <= 0.5 && Number(verified.input_tp) <= -1) break;
        gain += -16 - Number(verified.input_i);
      }
    }
    if (Math.abs(Number(verified.input_i) + 16) > 0.5 || Number(verified.input_tp) > -1) {
      throw new Error(`Guidance loudness out of bounds: ${file} (${verified.input_i} LUFS, ${verified.input_tp} dBTP)`);
    }
    data = await readFile(output);
    loudness = { integratedLufs: Number(verified.input_i), truePeakDbtp: Number(verified.input_tp) };
  } finally { await rm(temporary, { recursive: true, force: true }); }
  if (data.length > 2_000_000) throw new Error('Guidance recording exceeds asset size limit.');
  await writeFile(new URL(file, directory), data);
  const entry = { file, text, textSha256: hash(text), audioSha256: hash(data), bytes: data.length, ...loudness };
  console.log(`Generated ${file}: ${data.length} bytes, ${loudness.integratedLufs} LUFS`);
  return entry;
}

// Two bounded workers, never retry synthesis submissions or duplicate a job.
let position = 0;
let manifestWrite = Promise.resolve();
const failures = [];
await Promise.all(Array.from({ length: 2 }, async () => {
  while (position < clips.length) {
    const clip = clips[position++];
    let entry;
    try { entry = await generate(clip); } catch (error) {
      failures.push(`${clip.file}: ${error.message}`);
      console.error(`Not bundled: ${clip.file}: ${error.message}`);
      continue;
    }
    manifest.clips[clip.language] ||= {};
    manifest.clips[clip.language][clip.id] = entry;
    // Save verified progress after each clip so interruptions reuse paid jobs.
    const snapshot = JSON.stringify(manifest, null, 2) + '\n';
    manifestWrite = manifestWrite.then(() => writeFile(manifestFile, snapshot));
    await manifestWrite;
  }
}));
if (failures.length) throw new Error(`Guidance generation incomplete: ${failures.join('; ')}`);
console.log(`Bundled ${clips.length} fixed Asinu Tuấn Anh v4 recordings; no credentials or personal names stored.`);
