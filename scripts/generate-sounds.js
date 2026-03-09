/**
 * generate-sounds.js
 * Tạo file .wav cho từng loại thông báo Asinu — không cần thư viện ngoài.
 *
 * Cách chạy: node scripts/generate-sounds.js
 *
 * Output:
 *   assets/sounds/asinu_reminder.wav    — nhắc nhở log hàng ngày (nước, buổi sáng/tối)
 *   assets/sounds/asinu_alert.wav       — cảnh báo sức khoẻ, chỉ số bất thường
 *   assets/sounds/asinu_care.wav        — vòng kết nối: mời / chấp nhận
 *   assets/sounds/asinu_milestone.wav   — streak milestone, weekly recap
 *
 * Sau khi tạo, script tự copy vào android/app/src/main/res/raw/ (Android cần raw/.wav)
 */

const fs   = require('fs');
const path = require('path');

// ─── WAV constants ────────────────────────────────────────────────────────────
const SAMPLE_RATE = 44100;
const CHANNELS    = 1;         // mono
const BIT_DEPTH   = 16;        // 16-bit signed PCM
const MAX_AMP     = 32767;

// ─── Low-level helpers ────────────────────────────────────────────────────────

/** Clamp a number to 16-bit range */
const clamp16 = (v) => Math.max(-32768, Math.min(32767, Math.round(v)));

/**
 * Generate one note with bell-like timbre (chime).
 * Uses fundamental + inharmonic partials → pleasant bell sound.
 */
function note(freq, duration, amplitude = 0.72, decay = 5) {
  const n    = Math.floor(SAMPLE_RATE * duration);
  const buf  = Buffer.alloc(n * 2);
  const atk  = Math.floor(SAMPLE_RATE * 0.003);

  for (let i = 0; i < n; i++) {
    const t   = i / SAMPLE_RATE;
    const env = (i < atk ? i / atk : Math.exp(-decay * (t - atk / SAMPLE_RATE))) * amplitude;
    const s =
      Math.sin(2 * Math.PI * freq * 1.00 * t) * 0.55 +
      Math.sin(2 * Math.PI * freq * 2.76 * t) * 0.25 +
      Math.sin(2 * Math.PI * freq * 5.40 * t) * 0.12 +
      Math.sin(2 * Math.PI * freq * 8.93 * t) * 0.08;
    buf.writeInt16LE(clamp16(s * env * MAX_AMP), i * 2);
  }
  return buf;
}

/**
 * Generate a sharp electronic BEEP — urgent, piercing, no harmonics.
 * Dùng cho cảnh báo: khác hoàn toàn với chime.
 *
 * @param {number} freq       Frequency (Hz) — 800-1100 cho cảm giác khẩn cấp
 * @param {number} duration   Duration (seconds)
 * @param {number} amplitude  0-1
 * @param {number} tremolo    Amplitude modulation rate (Hz) — tạo hiệu ứng rung/pulse (0 = tắt)
 */
function beep(freq, duration, amplitude = 0.82, tremolo = 0) {
  const n   = Math.floor(SAMPLE_RATE * duration);
  const buf = Buffer.alloc(n * 2);
  const atkSamples = Math.floor(SAMPLE_RATE * 0.004); // 4ms attack
  const relSamples = Math.floor(SAMPLE_RATE * 0.015); // 15ms release

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;

    // Sharp attack, sustain, then quick release
    let env;
    if (i < atkSamples) {
      env = i / atkSamples;
    } else if (i > n - relSamples) {
      env = (n - i) / relSamples;
    } else {
      env = 1.0;
    }

    // Optional tremolo (amplitude pulsing) for urgency
    const trem = tremolo > 0 ? (0.7 + 0.3 * Math.sin(2 * Math.PI * tremolo * t)) : 1.0;

    // Pure sine — clean, piercing beep
    const s = Math.sin(2 * Math.PI * freq * t);
    buf.writeInt16LE(clamp16(s * env * trem * amplitude * MAX_AMP), i * 2);
  }
  return buf;
}

/**
 * Silence buffer of given duration (seconds)
 */
function silence(duration) {
  return Buffer.alloc(Math.floor(SAMPLE_RATE * duration) * 2);
}

/**
 * Mix two buffers by summing (for chords).
 */
function mix(a, b) {
  const len = Math.max(a.length, b.length);
  const out = Buffer.alloc(len);
  for (let i = 0; i < len; i += 2) {
    const va = i < a.length ? a.readInt16LE(i) : 0;
    const vb = i < b.length ? b.readInt16LE(i) : 0;
    out.writeInt16LE(clamp16((va + vb) * 0.6), i);
  }
  return out;
}

/**
 * Concatenate PCM buffers (sequential notes)
 */
const seq = (...bufs) => Buffer.concat(bufs);

/**
 * Wrap raw PCM data into a valid WAV file buffer
 */
function makeWav(pcm) {
  const dataSize   = pcm.length;
  const byteRate   = SAMPLE_RATE * CHANNELS * (BIT_DEPTH / 8);
  const blockAlign = CHANNELS * (BIT_DEPTH / 8);
  const hdr        = Buffer.alloc(44);

  hdr.write('RIFF', 0);
  hdr.writeUInt32LE(36 + dataSize, 4);
  hdr.write('WAVE', 8);
  hdr.write('fmt ', 12);
  hdr.writeUInt32LE(16,          16); // PCM subchunk size
  hdr.writeUInt16LE(1,           20); // PCM format
  hdr.writeUInt16LE(CHANNELS,    22);
  hdr.writeUInt32LE(SAMPLE_RATE, 24);
  hdr.writeUInt32LE(byteRate,    28);
  hdr.writeUInt16LE(blockAlign,  32);
  hdr.writeUInt16LE(BIT_DEPTH,   34);
  hdr.write('data', 36);
  hdr.writeUInt32LE(dataSize,    40);

  return Buffer.concat([hdr, pcm]);
}

// ─── Sound definitions ────────────────────────────────────────────────────────
//  Frequencies (scientific pitch notation):
//    C4=262  D4=294  E4=330  F4=349  G4=392  A4=440  B4=494
//    C5=523  D5=587  E5=659  G5=784  A5=880  C6=1047

const sounds = {
  /**
   * asinu_reminder — nhắc nhở hàng ngày (log buổi sáng/tối, uống nước, thuốc)
   * Cảm giác: nhẹ nhàng, thân thiện
   * C5 → E5, soft bell decay
   */
  asinu_reminder: seq(
    note(523, 0.55, 0.75, 4.5),   // C5
    silence(0.04),
    note(659, 0.70, 0.65, 4.0),   // E5
  ),

  /**
   * asinu_alert — cảnh báo sức khoẻ (chỉ số bất thường, người thân cần giúp đỡ)
   * Cảm giác: KHẨN CẤP, nghe là biết ngay — hoàn toàn khác chime
   *
   * Pattern: 3 beep ngắn nhanh (như báo động) → dừng → 2 beep dài hơn
   * Dùng beep() thay vì note() → âm thanh sắc, điện tử, không phải chuông
   * Tremolo 18Hz tạo hiệu ứng rung/pulse thêm tính khẩn cấp
   */
  asinu_alert: seq(
    // Burst 1: 3 beep nhanh — 960Hz (cao, sắc, dễ nghe qua tiếng ồn)
    beep(960, 0.10, 0.85, 18),
    silence(0.055),
    beep(960, 0.10, 0.85, 18),
    silence(0.055),
    beep(960, 0.10, 0.85, 18),
    silence(0.14),               // khoảng dừng để não nhận ra pattern

    // Burst 2: 2 beep dài hơn, tần số thấp hơn một chút → "xuống giọng" báo hiệu nguy hiểm
    beep(800, 0.22, 0.88, 12),
    silence(0.07),
    beep(800, 0.28, 0.85, 12),
  ),

  /**
   * asinu_care — vòng kết nối (mời kết nối, chấp nhận lời mời)
   * Cảm giác: ấm áp, kết nối, vui
   * E5 + G5 chord → major third
   */
  asinu_care: seq(
    mix(
      note(659, 0.65, 0.55, 4.0),  // E5 \
      note(784, 0.65, 0.45, 4.0),  // G5 / chord
    ),
    silence(0.05),
    note(1047, 0.60, 0.55, 3.5),   // C6 — bright finish
  ),

  /**
   * asinu_milestone — streak milestone, weekly recap, thành tích
   * Cảm giác: vui vẻ, phấn khích
   * C5-E5-G5-C6 ascending arpeggio
   */
  asinu_milestone: seq(
    note(523,  0.20, 0.65, 6.0),   // C5
    note(659,  0.20, 0.68, 5.5),   // E5
    note(784,  0.20, 0.70, 5.0),   // G5
    note(1047, 0.60, 0.72, 3.5),   // C6 — ring out
  ),
};

// ─── Write files ──────────────────────────────────────────────────────────────

const SOUNDS_DIR = path.join(__dirname, '..', 'assets', 'sounds');
const ANDROID_RAW = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'raw');

fs.mkdirSync(SOUNDS_DIR,   { recursive: true });
fs.mkdirSync(ANDROID_RAW,  { recursive: true });

for (const [name, pcm] of Object.entries(sounds)) {
  const wav      = makeWav(pcm);
  const filename = `${name}.wav`;

  // assets/sounds/ — for iOS bundle & Expo reference
  fs.writeFileSync(path.join(SOUNDS_DIR,  filename), wav);

  // android/res/raw/ — Android notification channels require files here
  fs.writeFileSync(path.join(ANDROID_RAW, filename), wav);

  const secs = (pcm.length / 2 / SAMPLE_RATE).toFixed(2);
  console.log(`✓ ${filename}  ${(wav.length / 1024).toFixed(1)} KB  ${secs}s`);
}

console.log('\nDone. Files written to:');
console.log(' ', SOUNDS_DIR);
console.log(' ', ANDROID_RAW);
console.log('\niOS: add sound files to Xcode project → Copy Bundle Resources.');
