import type { CheckinSession, CheckinStatus, TriageAnswer } from './checkin.api';
import {
  LOCATION_DETAIL_GROUPS,
  type BodyLocation,
  type LocationDetails,
} from './location-details';
import { triageDraftKey, triageDraftStorage } from '../checkin-call/triage-draft.storage';

export type LocationDraft = {
  status: CheckinStatus;
  selected: BodyLocation[];
  other: string;
  details: LocationDetails;
  positionNotes: Partial<Record<BodyLocation, string>>;
  detailIndex: number | null;
};
const regions = ['head', 'chest', 'abdomen', 'limbs', 'skin', 'whole_body', 'mental'];
const day = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
export const locationDraftKey = (account: string | number | undefined) =>
  triageDraftKey(account, `manual-location-${day()}`);

export function validLocationDraft(value: unknown): value is LocationDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const d = value as LocationDraft;
  return (
    ['tired', 'very_tired'].includes(d.status) &&
    Array.isArray(d.selected) &&
    d.selected.length <= 7 &&
    d.selected.every((r) => regions.includes(r)) &&
    typeof d.other === 'string' &&
    d.other.length <= 200 &&
    !!d.details &&
    typeof d.details === 'object' &&
    !Array.isArray(d.details) &&
    Object.entries(d.details).every(
      ([r, values]) =>
        Array.isArray(values) &&
        values.every((v) =>
          LOCATION_DETAIL_GROUPS.find((g) => g.location === r)?.positionKeys.includes(v),
        ),
    ) &&
    !!d.positionNotes &&
    typeof d.positionNotes === 'object' &&
    !Array.isArray(d.positionNotes) &&
    Object.entries(d.positionNotes).every(
      ([r, note]) => regions.includes(r) && typeof note === 'string' && note.length <= 200,
    ) &&
    (d.detailIndex === null ||
      (Number.isInteger(d.detailIndex) &&
        d.detailIndex >= 0 &&
        d.detailIndex <
          LOCATION_DETAIL_GROUPS.filter((g) => d.selected.includes(g.location)).length))
  );
}

export async function readLocationDraft(
  account: string | number | undefined,
  session?: CheckinSession | null,
): Promise<LocationDraft | null> {
  const key = locationDraftKey(account);
  const raw = await triageDraftStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const snapshot = JSON.parse(raw);
    const latestResponse = Date.parse(session?.last_response_at || session?.created_at || '');
    const alreadySubmitted =
      typeof snapshot.savedAt === 'number' && snapshot.savedAt <= latestResponse;
    if (!alreadySubmitted && validLocationDraft(snapshot.draft)) {
      return snapshot.draft;
    }
  } catch {
    /* discard invalid or outdated drafts */
  }
  await triageDraftStorage.removeItem(key);
  return null;
}
export const saveLocationDraft = (account: string | number | undefined, draft: LocationDraft) =>
  triageDraftStorage.setItem(
    locationDraftKey(account),
    JSON.stringify({ expiresAt: Date.now() + 86400000, savedAt: Date.now(), draft }),
  );
export const clearLocationDraft = (account: string | number | undefined) =>
  triageDraftStorage.removeItem(locationDraftKey(account));

const legacyPendingKey = (account: string | number | undefined, session: CheckinSession) =>
  triageDraftKey(
    account,
    `manual-pending-${session.id}-${session.triage_state?.phase || 'initial'}`,
  );
const pendingKey = (account: string | number | undefined, session: CheckinSession) => {
  const phaseId = checkinPhaseId(session);
  return phaseId
    ? triageDraftKey(account, `manual-pending-${session.id}-${session.triage_state?.phase || 'initial'}-${phaseId}`)
    : legacyPendingKey(account, session);
};
// The CAS revision changes on every question. Only a new interview phase or
// occurrence may invalidate an unsynced answer from the same patient.
export function checkinPhaseId(session: CheckinSession) {
  const phase = session.triage_state?.phase || 'initial';
  const started = session.occurrence_started_at || session.created_at;
  const occurrence = started ? new Date(started).toISOString() : String(session.id);
  return session.triage_state?.phase_id ||
    (phase === 'followup' ? session.triage_state?.revision : `initial:${occurrence}`);
}
function pendingScope(session: CheckinSession) {
  const started = session.occurrence_started_at || session.created_at;
  const occurrence = started ? new Date(started).toISOString() : String(session.id);
  return JSON.stringify([occurrence, session.triage_state?.phase || 'initial', checkinPhaseId(session) || null]);
}
export const savePendingAnswers = (
  account: string | number | undefined,
  session: CheckinSession,
  answers: TriageAnswer[],
) =>
  triageDraftStorage.setItem(
    pendingKey(account, session),
    JSON.stringify({
      expiresAt: Date.now() + 86400000,
      scope: pendingScope(session),
      revision: session.triage_state?.revision,
      answers,
    }),
  );
export const clearPendingAnswers = async (
  account: string | number | undefined,
  session: CheckinSession,
  acknowledgedAnswers?: TriageAnswer[],
) => {
  for (const key of new Set([pendingKey(account, session), legacyPendingKey(account, session)])) {
    await triageDraftStorage.removeItemIf(key, raw => {
      try {
        const saved = JSON.parse(raw);
        if (saved.scope && saved.scope !== pendingScope(session)) { return false; }
        if (!saved.scope && saved.revision && saved.revision !== session.triage_state?.revision) { return false; }
        return !acknowledgedAnswers || JSON.stringify(saved.answers) === JSON.stringify(acknowledgedAnswers);
      } catch { return false; }
    });
  }
};
async function resumableAnswers(account: string | number | undefined, session: CheckinSession) {
  const saved = session.triage_messages || [];
  const currentKey = pendingKey(account, session), oldKey = legacyPendingKey(account, session);
  const raw = await triageDraftStorage.getItem(currentKey) ||
    (oldKey !== currentKey ? await triageDraftStorage.getItem(oldKey) : null);
  if (raw) {
    try {
      const pending = JSON.parse(raw);
      const answers = pending.answers;
      if (pending.scope && pending.scope !== pendingScope(session)) return saved;
      // Read older app drafts conservatively until they are rewritten.
      if (
        !pending.scope &&
        pending.revision &&
        session.triage_state?.revision &&
        pending.revision !== session.triage_state.revision
      ) {
        return saved;
      }
      if (
        Array.isArray(answers) &&
        answers.length >= saved.length &&
        answers.length <= 128 &&
        answers.every(
          (a) =>
            a &&
            typeof a.question === 'string' &&
            a.question.length <= 500 &&
            typeof a.answer === 'string' &&
            a.answer.length <= 2000 &&
            (a.step === undefined || typeof a.step === 'string'),
        ) &&
        saved.every(
          (a, i) =>
            a.question === answers[i].question &&
            a.answer === answers[i].answer &&
            a.step === answers[i].step,
        )
      ) {
        return answers as TriageAnswer[];
      }
    } catch {
      /* use the authoritative server progress */
    }
  }
  return saved;
}

export function isUnfinishedCheckin(session: CheckinSession) {
  if (session.resolved_at || session.flow_state === 'resolved') {
    return false;
  }
  if (session.triage_state?.completed) {
    return session.triage_state.completed.finalized === false;
  }
  if (session.triage_state?.phase === 'followup') {
    return session.current_status !== 'fine';
  }
  return session.initial_status !== 'fine' && !session.triage_completed_at;
}

export async function cancelCheckinProgress(
  client: { cancel: (id: number, phaseId: string) => Promise<{ ok: boolean; cancelled: boolean }> },
  account: string | number | undefined,
  session: CheckinSession | null,
) {
  if (session && isUnfinishedCheckin(session)) {
    if (String(session.user_id) !== String(account)) throw new Error('CHECKIN_ACCOUNT_CHANGED');
    const phase = checkinPhaseId(session);
    if (!phase) throw new Error('CHECKIN_SESSION_UNAVAILABLE');
    const result = await client.cancel(session.id, phase);
    if (!result.ok || !result.cancelled) throw new Error('CHECKIN_CANCEL_FAILED');
    await clearPendingAnswers(account, session);
  }
  await clearLocationDraft(account);
}

type Entry =
  | { kind: 'new' | 'home' }
  | { kind: 'location'; draft: LocationDraft }
  | { kind: 'resume'; session: CheckinSession; answers: TriageAnswer[] }
  | { kind: 'followup'; session: CheckinSession };

// Reading an unfinished session never starts a follow-up or resets its answers.
export async function loadCheckinEntry(
  client: { getToday: () => Promise<{ ok: boolean; session: CheckinSession | null }> },
  account: string | number | undefined,
  mode?: string,
  requestedId?: number | null,
): Promise<Entry> {
  const result = await client.getToday();
  if (!result.ok) {
    throw new Error('CHECKIN_LOAD_FAILED');
  }
  const s = result.session;
  if (s && String(s.user_id) !== String(account)) {
    throw new Error('CHECKIN_ACCOUNT_CHANGED');
  }
  // PostgreSQL bigint IDs are strings on the wire; route params were parsed
  // as numbers. Compare their identities without rejecting the same session.
  if (requestedId && String(s?.id) !== String(requestedId)) {
    throw new Error('CHECKIN_SESSION_UNAVAILABLE');
  }
  if (s && isUnfinishedCheckin(s)) {
    await clearLocationDraft(account);
    return { kind: 'resume', session: s, answers: await resumableAnswers(account, s) };
  }
  if (mode === 'resume') {
    if (s) {
      return { kind: 'home' };
    }
    throw new Error('CHECKIN_SESSION_UNAVAILABLE');
  }
  const draft = await readLocationDraft(account, s);
  if (draft) {
    return { kind: 'location', draft };
  }
  if (mode === 'random' || !s) {
    return { kind: 'new' };
  }
  if (s.current_status === 'fine' || s.flow_state === 'resolved') {
    return { kind: 'home' };
  }
  return { kind: 'followup', session: s };
}
