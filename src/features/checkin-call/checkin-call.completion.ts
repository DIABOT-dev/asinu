import { endVoipCall, getActiveVoipCalls } from '../../lib/voip';
import { checkinCallApi } from './checkin-call.api';
import { isCheckinCallAttemptClosed } from './checkin-call.state';

// A manual check-in can cancel a reminder even when its call screen is not
// mounted. The pending-navigation getter is insufficient after entering the app.
export async function withManualCheckinCallCompletion<T extends { ok: boolean }>(
  save: () => Promise<T>,
): Promise<T> {
  const calls = await getActiveVoipCalls();
  const result = await save();
  if (!result.ok) return result;
  // Return the saved result promptly; optional call reconciliation must not
  // keep the check-in button spinning while a status endpoint is slow/offline.
  void Promise.all(calls.map(async call => {
    try {
      const { attempt } = await checkinCallApi.attempt(call.attemptId);
      // Keep unrelated family/urgent calls and calls arriving during the save.
      // Only the server may declare this user's original reminder closed.
      if (attempt.id === call.attemptId && attempt.episode_id === call.episodeId
        && attempt.target_role === 'USER' && isCheckinCallAttemptClosed(attempt)) {
        await endVoipCall(call.attemptId);
      }
    } catch {
      // A failed optional reconciliation must not turn a saved check-in into
      // an error or prematurely terminate a still-active safety flow.
    }
  }));
  return result;
}
