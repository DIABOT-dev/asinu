import type { CheckinCallAttempt, CheckinCallEpisode } from './checkin-call.api';

const CLOSED_EPISODES = new Set([
  'RESOLVED',
  'EXHAUSTED',
  'EXHAUSTED_MILD',
  'EXHAUSTED_URGENT',
  'CANCELLED',
]);
const CLOSED_ATTEMPTS = new Set(['CANCELLED', 'EXPIRED', 'COMPLETED', 'NO_ANSWER']);

export function isCheckinCallAttemptClosed(
  attempt: Pick<CheckinCallAttempt, 'state' | 'episode_state'>,
): boolean {
  // The winning urgent call remains open until its recipient confirms an action.
  return CLOSED_EPISODES.has(attempt.episode_state) || CLOSED_ATTEMPTS.has(attempt.state);
}

export function getClosedCheckinCallStatusKey(
  attempt: Pick<CheckinCallAttempt, 'state' | 'episode_state' | 'target_role' | 'severity' | 'acknowledged_by' | 'target_user_id' | 'cancellation_reason'>,
): string {
  if (attempt.episode_state === 'RESOLVED' && attempt.acknowledged_by &&
      (attempt.target_role === 'USER' || attempt.acknowledged_by !== attempt.target_user_id)) return 'statusFamilyHandled';
  if (attempt.episode_state === 'CANCELLED') return attempt.cancellation_reason === 'MANUAL_CHECKIN' ? 'statusCheckinRecorded' : 'statusCancelled';
  if (attempt.state === 'NO_ANSWER' && attempt.target_role === 'USER') {
    if (['EXHAUSTED', 'EXHAUSTED_MILD', 'EXHAUSTED_URGENT'].includes(attempt.episode_state)) return 'statusFamilyUnavailable';
    return 'statusUserUnreachable';
  }
  // A lost HTTP response or late poll must not turn an already-successful
  // backend response into an expired result on the device.
  if (attempt.state === 'COMPLETED') {
    if (attempt.target_role === 'FAMILY' && attempt.episode_state === 'RESOLVED') {
      return 'statusFamilyConfirmed';
    }
    if (attempt.target_role === 'USER') {
      if (['EXHAUSTED', 'EXHAUSTED_MILD', 'EXHAUSTED_URGENT'].includes(attempt.episode_state)) {
        return 'statusFamilyUnavailable';
      }
      if (attempt.episode_state === 'RESOLVED' && attempt.severity === 'NONE') {
        return 'statusUserOk';
      }
      if (attempt.severity === 'MILD') {
        return 'statusUserMild';
      }
      if (attempt.severity === 'URGENT') {
        return 'statusUserUrgent';
      }
    }
  }
  return 'statusEnded';
}

export function getCheckinCallTime(value?: string | null): number | null {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

export function getFamilyCallNoticeKeys(severity: string | null | undefined) {
  if (severity === 'URGENT') {
    return { titleKey: 'gallery.urgentFamilyTitle', messageKey: 'gallery.urgentFamilyMessage' };
  }
  if (severity === 'MILD') {
    return { titleKey: 'gallery.mildFamilyTitle', messageKey: 'gallery.mildFamilyMessage' };
  }
  return { titleKey: 'gallery.unknownFamilyTitle', messageKey: 'gallery.unknownFamilyMessage' };
}

export function getUserCheckinCallOutcome(episode: Pick<CheckinCallEpisode, 'state' | 'severity'>) {
  const statusKey = getClosedCheckinCallStatusKey({
    state: 'COMPLETED', episode_state: episode.state, target_role: 'USER', severity: episode.severity,
  });
  const audioKey = statusKey === 'statusUserOk' ? 'user_ok'
    : statusKey === 'statusUserMild' ? 'user_mild'
      : statusKey === 'statusUserUrgent' ? 'user_urgent'
        : statusKey === 'statusFamilyUnavailable' ? 'family_unavailable' : null;
  return { statusKey, audioKey, notifyingFamily: statusKey === 'statusUserMild' || statusKey === 'statusUserUrgent' };
}
