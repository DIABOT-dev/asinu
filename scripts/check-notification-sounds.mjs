import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const manifest = require('../src/config/notification-sounds.json');
const { syncIOSSounds, syncAndroidSounds } = require('../plugins/withAsinuNotificationSounds');
const xcode = require('xcode');
let checks = 0;
const test = async (label, run) => { await run(); checks++; console.log(`PASS ${label}`); };
const evaluate = (filename, imports) => {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(module, module.exports, (id) => {
    assert.ok(Object.hasOwn(imports, id), `Missing test adapter: ${id}`);
    return imports[id];
  });
  return module.exports;
};
const sounds = evaluate('src/lib/notification-sounds.ts', { '../config/notification-sounds.json': manifest });
const backendRoot = process.env.ASINU_BACKEND_DIR || '../backend.asinu';
const backendManifestPath = path.join(backendRoot, 'src/config/notification-sounds.json');

await test('mobile/backend audio contract is identical', () => {
  assert.ok(fs.existsSync(backendManifestPath), 'Provide ASINU_BACKEND_DIR for the backend contract');
  assert.deepEqual(manifest, JSON.parse(fs.readFileSync(backendManifestPath, 'utf8')));
});
const backendSounds = require(path.resolve(backendRoot, 'src/services/notification/notification-sound.config.js'));
const fixtures = [
  ...Object.entries(manifest.types).map(([type, group]) => [{ type }, group]),
  [{ type: 'early_signal', severity: 'urgent' }, 'alert'],
  [{ type: 'early_signal', severity: 'URGENT' }, 'alert'],
  [{ type: 'early_signal', severity: 'attention' }, 'reminder'],
  [{ type: 'checkin_call', kind: 'INCOMING_CALL', severity: 'NONE' }, 'incoming'],
  [{ type: 'checkin_call', kind: 'INCOMING_CALL', severity: 'MILD' }, 'incoming'],
  [{ type: 'checkin_call', kind: 'INCOMING_CALL', severity: 'URGENT' }, 'alert'],
  [{ type: 'checkin_call', kind: 'URGENT_REPEAT' }, 'alert'],
  [{ type: 'checkin_call', kind: 'FALLBACK', severity: 'UNKNOWN' }, 'missed'],
  [{ type: 'checkin_call', kind: 'FALLBACK', severity: 'URGENT' }, 'alert'],
  [{ type: 'checkin_call', kind: 'MISSED_CALL' }, 'missed'],
  [{ type: 'checkin_call' }, 'incoming'],
  [{ type: 'unknown' }, 'reminder'],
  [{ type: '__proto__' }, 'reminder'],
  [{ type: 'constructor' }, 'reminder'],
  [{ type: 'unknown', requiresImmediate: true }, 'alert'],
  [{ type: 'unknown', alertType: 'emergency' }, 'alert'],
  [{}, 'reminder'],
];
await test(`${fixtures.length} audio classifications match across FE/BE`, () => {
  for (const [data, group] of fixtures) {
    assert.equal(sounds.notificationSoundGroup(data), group, JSON.stringify(data));
    assert.equal(backendSounds.notificationSoundGroup(data), group);
    const config = manifest.groups[group];
    assert.equal(sounds.notificationSoundConfig(data, 'ios').sound, manifest.sounds[config.sound].ios);
    assert.equal(sounds.notificationSoundConfig(data, 'android').sound, manifest.sounds[config.sound].android);
    assert.deepEqual(backendSounds.notificationSoundConfig(data), sounds.notificationSoundConfig(data, 'ios'));
    assert.notEqual(config.sound, 'ringback', 'Never play outgoing waiting music as a notification');
  }
});

const project = xcode.project('ios/Asinu.xcodeproj/project.pbxproj');
project.parseSync();
const resources = Object.values(project.hash.project.objects.PBXResourcesBuildPhase).filter((entry) => entry.files);
await test('all 5 iOS CAF files are PCM, under 30s and bundled exactly once', () => {
  for (const sound of Object.values(manifest.sounds)) {
    const audio = fs.readFileSync(`assets/sounds/ios/${sound.ios}`);
    assert.equal(audio.toString('ascii', 0, 4), 'caff');
    let offset = 8, rate, bytesPerPacket, framesPerPacket, dataBytes;
    while (offset + 12 <= audio.length) {
      const kind = audio.toString('ascii', offset, offset + 4);
      const size = Number(audio.readBigInt64BE(offset + 4));
      assert.ok(size >= 0 && offset + 12 + size <= audio.length);
      if (kind === 'desc') {
        rate = audio.readDoubleBE(offset + 12);
        assert.equal(audio.toString('ascii', offset + 20, offset + 24), 'lpcm');
        bytesPerPacket = audio.readUInt32BE(offset + 28);
        framesPerPacket = audio.readUInt32BE(offset + 32);
        assert.equal(audio.readUInt32BE(offset + 36), 1, 'Mono');
        assert.equal(audio.readUInt32BE(offset + 40), 16, '16-bit PCM');
      }
      if (kind === 'data') { dataBytes = size - 4; }
      offset += 12 + size;
    }
    assert.equal(rate, 44100);
    const duration = dataBytes / bytesPerPacket * framesPerPacket / rate;
    assert.ok(duration > 0 && duration < 30);
    assert.ok(Math.abs(duration - sound.durationSeconds) < 0.01);
    assert.deepEqual(audio, fs.readFileSync(`ios/Asinu/${sound.ios}`));
    assert.ok(project.hasFile(`Asinu/${sound.ios}`));
    const bundled = resources.flatMap((resource) => resource.files)
      .filter((file) => file.comment === `${sound.ios} in Resources`);
    assert.equal(bundled.length, 1);
  }
});
await test('all 5 Android OGG files are Vorbis with correct durations; raw names are unique', () => {
  const rawDirectory = 'android/app/src/main/res/raw';
  const names = fs.readdirSync(rawDirectory).filter((file) => !file.startsWith('.')).map((file) => path.parse(file).name);
  assert.equal(names.length, new Set(names).size);
  for (const sound of Object.values(manifest.sounds)) {
    const audio = fs.readFileSync(`assets/sounds/android/${sound.android}`);
    assert.equal(audio.toString('ascii', 0, 4), 'OggS');
    const packet = audio.indexOf(Buffer.from('\x01vorbis', 'binary'));
    assert.ok(packet >= 0);
    assert.equal(audio[packet + 11], 1);
    const rate = audio.readUInt32LE(packet + 12);
    assert.equal(rate, 44100);
    let offset = 0, frames = 0;
    while (offset < audio.length) {
      assert.equal(audio.toString('ascii', offset, offset + 4), 'OggS');
      const granule = audio.readBigUInt64LE(offset + 6);
      if (granule !== 0xffffffffffffffffn) { frames = Math.max(frames, Number(granule)); }
      const segments = audio[offset + 26];
      let size = 0;
      for (let i = 0; i < segments; i++) { size += audio[offset + 27 + i]; }
      offset += 27 + segments + size;
    }
    assert.ok(Math.abs(frames / rate - sound.durationSeconds) < 0.01);
    assert.deepEqual(audio, fs.readFileSync(`${rawDirectory}/${sound.android}`));
  }
});

const calls = { channels: [], scheduled: [], handler: null };
const platform = { OS: 'android' };
const native = {
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
  AndroidNotificationPriority: { HIGH: 1, MAX: 2 },
  setNotificationChannelAsync: async (id, config) => { calls.channels.push({ id, ...config }); },
  setNotificationCategoryAsync: async () => {},
  scheduleNotificationAsync: async (value) => { calls.scheduled.push(value); },
  setNotificationHandler: (value) => { calls.handler = value; },
};
const notifications = evaluate('src/lib/notifications.ts', {
  'expo-constants': {},
  'expo-notifications': native,
  'react-native': { Platform: platform },
  '../i18n': { t: (key) => key },
  '../stores/notification.store': {},
  './notification-sounds': sounds,
  './android-checkin-call': { configureAndroidCheckinCalls: async () => {} },
});
await test('Android creates every new channel without deleting user preferences', async () => {
  await notifications.refreshNotificationLocalization();
  for (const [group, config] of Object.entries(manifest.groups)) {
    const channel = calls.channels.find((entry) => entry.id === config.channelId);
    assert.ok(channel, group);
    assert.equal(channel.sound, manifest.sounds[config.sound].android);
    assert.equal(channel.name, config.label);
  }
  // No deleteNotificationChannelAsync adapter: any accidental deletion fails.
  assert.equal(calls.channels.length, 15, '9 warm + 6 legacy channels');
  assert.ok(!fs.readFileSync('src/lib/notifications.ts', 'utf8').includes('deleteNotificationChannelAsync'));
});
await test('local notification scheduling selects the matching platform sound/channel', async () => {
  for (const osName of ['ios', 'android']) {
    platform.OS = osName;
    for (const data of [{ type: 'morning_checkin' }, { type: 'emergency' }, { type: 'payment_failed' }]) {
      await notifications.scheduleLocalNotification('test', 'test', data);
      const result = calls.scheduled.at(-1);
      const expected = sounds.notificationSoundConfig(data, osName);
      assert.equal(result.content.sound, expected.sound);
      assert.deepEqual(result.trigger, osName === 'android' ? { channelId: expected.channelId } : null);
    }
    await notifications.reNotifyAsLocal('test', 'test', { type: 'emergency', _isLocalReemit: true });
    const result = calls.scheduled.at(-1);
    const expected = sounds.notificationSoundConfig({ type: 'health_alert' }, osName);
    assert.equal(result.content.sound, expected.sound);
    assert.equal(result.content.categoryIdentifier, 'health_alert');
    assert.deepEqual(result.trigger, osName === 'android' ? { channelId: expected.channelId } : null);
  }
});
await test('foreground re-emission never produces a second sound', async () => {
  notifications.setupNotificationHandler();
  const result = await calls.handler.handleNotification({ request: { content: { data: { _isLocalReemit: true } } } });
  assert.equal(result.shouldPlaySound, false);
  assert.equal(result.shouldShowBanner, false);
});
await test('config plugin sync is idempotent and prevents Android resource collisions', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'asinu-notification-sounds-'));
  try {
    fs.cpSync('assets/sounds', path.join(temporary, 'assets/sounds'), { recursive: true });
    fs.cpSync('ios', path.join(temporary, 'ios'), { recursive: true, filter: (source) => !source.includes('/Pods') && !source.includes('/build') });
    const file = path.join(temporary, 'ios/Asinu.xcodeproj/project.pbxproj');
    const copy = xcode.project(file);
    copy.parseSync();
    const before = copy.writeSync();
    syncIOSSounds(temporary, copy, 'Asinu');
    syncIOSSounds(temporary, copy, 'Asinu');
    assert.equal(copy.writeSync(), before);
    syncAndroidSounds(temporary);
    syncAndroidSounds(temporary);
    const raw = path.join(temporary, 'android/app/src/main/res/raw');
    assert.deepEqual(fs.readdirSync(raw).sort(), Object.values(manifest.sounds).map((sound) => sound.android).sort());
    fs.copyFileSync(path.join(temporary, 'assets/sounds/ios/asinu_incoming.caf'), path.join(raw, 'asinu_incoming.caf'));
    assert.throws(() => syncAndroidSounds(temporary), /Duplicate notification resource/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
console.log(`Notification sound regressions passed: ${checks}/${checks}.`);
