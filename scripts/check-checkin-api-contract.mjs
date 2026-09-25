import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadApi(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: relativePath,
  }).outputText;
  const calls = [];
  const apiClient = (requestPath, options = {}) => {
    calls.push({ path: requestPath, options });
    return Promise.resolve({ ok: true });
  };
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id.endsWith('/lib/apiClient') || id.endsWith('lib/apiClient')) return { apiClient };
    throw new Error(`Unexpected dependency in ${relativePath}: ${id}`);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return { exports: module.exports, calls };
}

function expectCall(calls, expected) {
  const actual = calls.shift();
  assert.ok(actual, `Missing request for ${expected.path}`);
  assert.equal(actual.path, expected.path);
  assert.equal(actual.options.method || 'GET', expected.method || 'GET');
  assert.deepEqual(actual.options.body, expected.body);
  assert.equal(actual.options.timeoutMs, expected.timeoutMs);
}

const health = loadApi('src/features/checkin/checkin.api.ts');
const checkinApi = health.exports.checkinApi;

checkinApi.getToday();
expectCall(health.calls, { path: '/api/mobile/checkin/today' });

checkinApi.start('fine');
expectCall(health.calls, {
  path: '/api/mobile/checkin/start',
  method: 'POST',
  body: { status: 'fine', body_locations: null, body_location_other: null },
});

checkinApi.start('tired', ['head', 'chest'], 'đau nhẹ');
expectCall(health.calls, {
  path: '/api/mobile/checkin/start',
  method: 'POST',
  body: {
    status: 'tired',
    body_locations: ['head', 'chest'],
    body_location_other: 'đau nhẹ',
  },
});

checkinApi.followUp(123, 'fine');
expectCall(health.calls, {
  path: '/api/mobile/checkin/followup',
  method: 'POST',
  body: { checkin_id: 123, status: 'fine' },
});

checkinApi.triage(123, [{ question: 'Mức độ?', answer: 'Nhẹ' }]);
expectCall(health.calls, {
  path: '/api/mobile/checkin/triage',
  method: 'POST',
  body: { checkin_id: 123, previous_answers: [{ question: 'Mức độ?', answer: 'Nhẹ' }] },
  timeoutMs: 30000,
});

checkinApi.emergency({ lat: 10.7769, lng: 106.7009, accuracy: 12 });
expectCall(health.calls, {
  path: '/api/mobile/checkin/emergency',
  method: 'POST',
  body: { location: { lat: 10.7769, lng: 106.7009, accuracy: 12 } },
});

checkinApi.confirmAlert(456, 'on_my_way');
expectCall(health.calls, {
  path: '/api/mobile/checkin/confirm-alert',
  method: 'POST',
  body: { alert_id: 456, action: 'on_my_way' },
});

checkinApi.getPendingAlerts();
expectCall(health.calls, { path: '/api/mobile/checkin/pending-alerts' });

checkinApi.getReport('month');
expectCall(health.calls, { path: '/api/mobile/checkin/report?period=month' });

checkinApi.getHealthScore();
expectCall(health.calls, { path: '/api/mobile/health-score' });
assert.equal(health.calls.length, 0);

const call = loadApi('src/features/checkin-call/checkin-call.api.ts');
const checkinCallApi = call.exports.checkinCallApi;
const settings = {
  enabled: true,
  checkin_time: '08:00',
  timezone: 'Asia/Ho_Chi_Minh',
  grace_hours: 2,
  user_timeout_seconds: 60,
  family_ring_seconds: 60,
  family_confirm_minutes: 10,
  max_rounds: 1,
};

checkinCallApi.settings();
expectCall(call.calls, { path: '/api/mobile/checkin-call/settings' });
checkinCallApi.saveSettings(settings);
expectCall(call.calls, {
  path: '/api/mobile/checkin-call/settings',
  method: 'PUT',
  body: settings,
});
checkinCallApi.active();
expectCall(call.calls, { path: '/api/mobile/checkin-call/active' });
checkinCallApi.testCall();
expectCall(call.calls, { path: '/api/mobile/checkin-call/test-call', method: 'POST' });
checkinCallApi.episode('episode-1');
expectCall(call.calls, { path: '/api/mobile/checkin-call/episodes/episode-1' });
checkinCallApi.attempt('attempt-1');
expectCall(call.calls, { path: '/api/mobile/checkin-call/attempts/attempt-1' });
checkinCallApi.answer('episode-1', 3);
expectCall(call.calls, {
  path: '/api/mobile/checkin-call/episodes/episode-1/answer',
  method: 'POST',
  body: { choice: 3 },
});
checkinCallApi.seen('attempt-1');
expectCall(call.calls, {
  path: '/api/mobile/checkin-call/attempts/attempt-1/seen',
  method: 'POST',
});
checkinCallApi.accept('attempt-1');
expectCall(call.calls, {
  path: '/api/mobile/checkin-call/attempts/attempt-1/accept',
  method: 'POST',
});
checkinCallApi.confirmFamily('episode-1', 'CALLED_USER');
expectCall(call.calls, {
  path: '/api/mobile/checkin-call/episodes/episode-1/family-confirm',
  method: 'POST',
  body: { action: 'CALLED_USER' },
});
checkinCallApi.token('attempt-1');
expectCall(call.calls, { path: '/api/mobile/checkin-call/attempts/attempt-1/token' });
checkinCallApi.audio('user_prompt');
expectCall(call.calls, {
  path: '/api/mobile/checkin-call/audio/user_prompt',
  timeoutMs: 30000,
});
assert.equal(call.calls.length, 0);

console.log('Check-in API contract passed: 22 frontend requests match the server contract.');
