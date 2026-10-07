import { useAuthStore } from '../auth/auth.store';
import { useGuidanceStore } from './guidance.store';

/** The guide opens automatically once; later visits require explicit replay. */
export function useCheckinPracticeEntry() {
  const userId = useAuthStore(state => state.profile?.id);
  const needed = useGuidanceStore(state => state.account === String(userId) && state.ready
    && state.progress.welcomeSeen
    && (!state.progress.firstCheckin || state.progress.epoch > 0)
    && !state.progress.completed.includes('checkin.practice')
    && !state.progress.completed.includes('checkin.finished'));
  return needed;
}
