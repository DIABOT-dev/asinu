import assert from 'node:assert/strict';
import { test } from 'node:test';
import { progressHarness } from './helpers/checkin-progress-harness.mjs';

const answer = { step: 'symptoms', question: 'Symptoms?', answer: 'Example symptom' };
const session = {
  id: 500,
  user_id: 7,
  initial_status: 'tired',
  current_status: 'tired',
  flow_state: 'monitoring',
  resolved_at: null,
  triage_completed_at: null,
  triage_messages: [answer],
  triage_state: { phase: 'initial', revision: 'r1' },
};
const draft = {
  status: 'tired',
  selected: ['head', 'chest'],
  other: '',
  details: { head: ['forehead'] },
  positionNotes: {},
  detailIndex: 1,
};
const client = (value) => ({ getToday: async () => ({ ok: true, session: value }) });

test('drafts preserve each region, note and question cursor in the OS keystore', async () => {
  const { progress: p, values } = progressHarness();
  await p.saveLocationDraft(7, draft);
  assert.deepEqual(await p.readLocationDraft(7), draft);
  assert.equal(await p.readLocationDraft(8), null);
  assert.deepEqual(await p.loadCheckinEntry(client(null), 7), { kind: 'location', draft });
  assert.ok([...values.keys()].every((k) => /^[A-Za-z0-9_.-]+$/.test(k)));
});
test('phase tokens are stable across question writes and change for a new occurrence', () => {
  const {progress:p}=progressHarness();
  const original={...session,created_at:'2026-11-09T01:00:00.000Z',occurrence_started_at:'2026-11-09T02:00:00.000Z'};
  assert.equal(p.checkinPhaseId(original),'initial:2026-11-09T02:00:00.000Z');
  assert.equal(p.checkinPhaseId({...original,triage_state:{...original.triage_state,revision:'r2'}}),p.checkinPhaseId(original));
  assert.notEqual(p.checkinPhaseId({...original,occurrence_started_at:'2026-11-09T03:00:00.000Z'}),p.checkinPhaseId(original));
  assert.equal(p.checkinPhaseId({...original,triage_state:{phase:'followup',phase_id:'phase-b',revision:'r3'}}),'phase-b');
});
test('an earlier phase response cannot clear a newer phase pending answer', async () => {
  const {progress:p}=progressHarness();
  const old={...session,triage_state:{phase:'followup',phase_id:'phase-a'}};
  const latest={...session,triage_messages:[],triage_state:{phase:'followup',phase_id:'phase-b'}};
  await p.savePendingAnswers(7,old,[answer]);
  const newer={step:'followup_status',question:'Now?',answer:'Same'};
  await p.savePendingAnswers(7,latest,[newer]);
  await p.clearPendingAnswers(7,old,[answer]);
  assert.deepEqual((await p.loadCheckinEntry(client(latest),7)).answers,[newer]);
});
test('acknowledging an older request does not clear a longer unsent answer list', async () => {
  const {progress:p}=progressHarness();
  const extended=[answer,{step:'onset',question:'When?',answer:'Today'}];
  await p.savePendingAnswers(7,session,[answer]);
  await p.savePendingAnswers(7,session,extended);
  await p.clearPendingAnswers(7,session,[answer]);
  assert.deepEqual((await p.loadCheckinEntry(client(session),7)).answers,extended);
});
test('a new save racing an old acknowledgement remains recoverable', async () => {
  const { progress: p } = progressHarness();
  const extended = [answer, { step: 'onset', question: 'When?', answer: 'Today' }];
  await p.savePendingAnswers(7, session, [answer]);
  await Promise.all([
    p.clearPendingAnswers(7, session, [answer]),
    p.savePendingAnswers(7, session, extended),
  ]);
  assert.deepEqual((await p.loadCheckinEntry(client(session), 7)).answers, extended);
});
test('installed legacy drafts resume and an old phase cannot delete a newer legacy draft', async () => {
  const { progress: p, storage, values } = progressHarness();
  const key = storage.triageDraftKey(7, `manual-pending-${session.id}-followup`);
  const old = { ...session, triage_state: { phase: 'followup', phase_id: 'phase-a' } };
  const latest = { ...session, triage_state: { phase: 'followup', phase_id: 'phase-b' } };
  const extended = [answer, { step: 'onset', question: 'When?', answer: 'Today' }];
  values.set(key, JSON.stringify({
    expiresAt: Date.now() + 60000,
    scope: JSON.stringify([String(session.id), 'followup', 'phase-b']),
    answers: extended,
  }));
  await p.clearPendingAnswers(7, old, extended);
  assert.deepEqual((await p.loadCheckinEntry(client(latest), 7)).answers, extended);
  await p.clearPendingAnswers(7, latest, extended);
  assert.equal(values.has(key), false);
});
test('expired and malformed drafts cannot restore a stale cursor', async () => {
  const { progress: p, values } = progressHarness();
  const key = p.locationDraftKey(7);
  for (const raw of [
    'invalid',
    JSON.stringify({ expiresAt: Date.now() - 1, draft }),
    JSON.stringify({ expiresAt: Date.now() + 10000, draft: { ...draft, detailIndex: 6 } }),
    JSON.stringify({
      expiresAt: Date.now() + 10000,
      draft: { ...draft, details: { head: ['not-a-position'] } },
    }),
  ]) {
    values.set(key, raw);
    assert.equal(await p.readLocationDraft(7), null);
    assert.equal(values.has(key), false);
  }
});
test('queued saving cannot resurrect a draft after successful submission clears it', async () => {
  const { progress: p } = progressHarness();
  await Promise.all([p.saveLocationDraft(7, draft), p.clearLocationDraft(7)]);
  assert.equal(await p.readLocationDraft(7), null);
});
test('all entry modes prefer an unfinished server session over an older local draft', async () => {
  const { progress: p } = progressHarness();
  await p.saveLocationDraft(7, draft);
  for (const mode of ['daily', 'random', 'resume', 'followup']) {
    const entry = await p.loadCheckinEntry(client(session), 7, mode, 500);
    assert.equal(entry.kind, 'resume');
    assert.deepEqual(entry.answers, [answer]);
  }
});
test('new follow-up resumes its own answers while an old completion timestamp exists', async () => {
  const { progress: p } = progressHarness();
  const active = {
    ...session,
    initial_status: 'fine',
    triage_completed_at: '2026-11-08T01:00:00Z',
    triage_messages: [],
    triage_state: { phase: 'followup', revision: 'r2' },
  };
  assert.equal(p.isUnfinishedCheckin(active), true);
  assert.deepEqual((await p.loadCheckinEntry(client(active), 7)).answers, []);
  assert.equal(p.isUnfinishedCheckin({ ...active, current_status: 'fine' }), false);
  assert.equal(
    p.isUnfinishedCheckin({ ...active, triage_state: { completed: { finalized: true } } }),
    false,
  );
  assert.equal(
    p.isUnfinishedCheckin({ ...active, triage_state: { completed: { finalized: false } } }),
    true,
  );
});
test('account mismatch, stale session links and HTTP logical failures never restart a check-in', async () => {
  const { progress: p } = progressHarness();
  await assert.rejects(p.loadCheckinEntry(client(session), 8), /ACCOUNT_CHANGED/);
  await assert.rejects(p.loadCheckinEntry(client(session), 7, 'resume', 501), /UNAVAILABLE/);
  await assert.rejects(p.loadCheckinEntry(client(null), 7, 'resume', 500), /UNAVAILABLE/);
  await assert.rejects(
    p.loadCheckinEntry({ getToday: async () => ({ ok: false }) }, 7),
    /LOAD_FAILED/,
  );
});
test('PostgreSQL bigint session IDs resume through numeric route params without losing saved answers', async () => {
  const { progress: p } = progressHarness();
  const stored = { ...session, id: String(session.id), user_id: String(session.user_id) };
  const result = await p.loadCheckinEntry(client(stored), 7, 'resume', 500);
  assert.equal(result.kind, 'resume');
  assert.equal(result.session.id, '500');
  assert.deepEqual(result.answers, stored.triage_messages);
  await assert.rejects(p.loadCheckinEntry(client(stored), 7, 'resume', 501), /UNAVAILABLE/);
});
test('a last submitted answer survives losing the response or restarting the app', async () => {
  const { progress: p } = progressHarness();
  const pending = [
    ...session.triage_messages,
    { step: 'red_flags', question: 'Warning signs?', answer: 'None' },
  ];
  await p.savePendingAnswers(7, session, pending);
  assert.deepEqual((await p.loadCheckinEntry(client(session), 7)).answers, pending);
  assert.deepEqual(
    (await p.loadCheckinEntry(client({ ...session, triage_messages: pending }), 7)).answers,
    pending,
  );
  await p.clearPendingAnswers(7, session);
  assert.deepEqual((await p.loadCheckinEntry(client(session), 7)).answers, [answer]);
});
test('newer server progress, a changed answer or a new occurrence wins over stale pending answers', async () => {
  const { progress: p } = progressHarness();
  await p.savePendingAnswers(7, session, [answer]);
  const newer = { ...session, triage_messages: [answer, { question: 'Next?', answer: 'Example' }] };
  assert.deepEqual((await p.loadCheckinEntry(client(newer), 7)).answers, newer.triage_messages);
  const changed = { ...session, triage_messages: [{ ...answer, answer: 'Changed' }] };
  assert.deepEqual((await p.loadCheckinEntry(client(changed), 7)).answers, changed.triage_messages);
  const phase = {
    ...session,
    triage_messages: [],
    triage_state: { phase: 'initial', phase_id: 'another-interview', revision: 'r2' },
  };
  assert.deepEqual((await p.loadCheckinEntry(client(phase), 7)).answers, []);
});
test('initial session responses without a revision can recover the first pending answer', async () => {
  const { progress: p } = progressHarness();
  await p.savePendingAnswers(7, { ...session, triage_state: {} }, [answer]);
  assert.deepEqual(
    (await p.loadCheckinEntry(client({ ...session, triage_messages: [] }), 7)).answers,
    [answer],
  );
});
test('completed and resolved sessions follow their correct destinations', async () => {
  const { progress: p } = progressHarness();
  const completed = {
    ...session,
    triage_completed_at: '2026-11-08T01:00:00Z',
    triage_state: { completed: { finalized: true } },
  };
  assert.equal((await p.loadCheckinEntry(client(completed), 7)).kind, 'followup');
  assert.equal((await p.loadCheckinEntry(client(completed), 7, 'resume', 500)).kind, 'home');
  assert.equal((await p.loadCheckinEntry(client(completed), 7, 'random')).kind, 'new');
  assert.equal(
    (await p.loadCheckinEntry(client({ ...completed, flow_state: 'resolved' }), 7)).kind,
    'home',
  );
});
test('None and Unknown cannot accompany typed or spoken symptoms', () => {
  const { selection: s } = progressHarness(),
    exclusive = ['None', 'Unknown'];
  assert.deepEqual([...s.toggleTriageOption(new Set(['Pain']), 'None', exclusive)], ['None']);
  assert.deepEqual([...s.toggleTriageOption(new Set(['None']), 'Pain', exclusive)], ['Pain']);
  assert.deepEqual(
    [...s.withoutExclusiveAnswers(new Set(['Unknown', 'Pain']), exclusive)],
    ['Pain'],
  );
  assert.equal(
    s.composeTriageAnswer(new Set(['None']), 'Example symptom', exclusive),
    'Example symptom',
  );
  assert.equal(s.composeTriageAnswer(new Set(['Pain']), ' pain ', exclusive), 'Pain');
});

test('a location draft already submitted before a lost response cannot start another interview', async () => {
  const { progress: p } = progressHarness();
  await p.saveLocationDraft(7, draft);
  const completed = {
    ...session,
    triage_completed_at: new Date().toISOString(),
    last_response_at: new Date(Date.now() + 1000).toISOString(),
    triage_state: { completed: { finalized: true } },
  };
  assert.equal(await p.readLocationDraft(7, completed), null);
  assert.equal((await p.loadCheckinEntry(client(completed), 7)).kind, 'followup');
  await p.saveLocationDraft(7, draft);
  await p.loadCheckinEntry(client(session), 7);
  assert.equal(await p.readLocationDraft(7), null);
});

for (const phase of ['initial', 'followup']) {
  test(`${phase}: a pending answer survives resuming and then losing the network after the revision advances`, async () => {
    const { progress: p } = progressHarness();
    const opened = { ...session, triage_state: { phase, phase_id: 'interview-a', revision: 'r1' } };
    const answers = [answer, { step: 'red_flags', question: 'Warning signs?', answer: 'None' }];
    await p.savePendingAnswers(7, opened, answers);
    const server = { ...opened, triage_state: { phase, phase_id: 'interview-a', revision: 'r2' } };
    assert.deepEqual((await p.loadCheckinEntry(client(server), 7)).answers, answers);
  });
}

test('a new follow-up phase never consumes pending answers from the previous phase', async () => {
  const { progress: p } = progressHarness();
  const old = {
    ...session,
    triage_state: { phase: 'followup', phase_id: 'old', revision: 'old-write' },
  };
  await p.savePendingAnswers(7, old, [answer]);
  const fresh = {
    ...old,
    triage_messages: [],
    triage_state: { phase: 'followup', phase_id: 'new', revision: 'new-write' },
  };
  assert.deepEqual((await p.loadCheckinEntry(client(fresh), 7)).answers, []);
});
test('a legacy follow-up adopts its existing revision as the stable phase identity', async () => {
  const { progress: p } = progressHarness();
  const old = { ...session, triage_state: { phase: 'followup', revision: 'first-write' } };
  await p.savePendingAnswers(7, old, [answer]);
  const upgraded = {
    ...old,
    triage_messages: [],
    triage_state: { phase: 'followup', phase_id: 'first-write', revision: 'next-write' },
  };
  assert.deepEqual((await p.loadCheckinEntry(client(upgraded), 7)).answers, [answer]);
});
