import { useAuthStore } from '../auth/auth.store';
import { useGuidanceStore } from './guidance.store';

/** Only tutorial completion is persisted, never practice answers or results. */
export function useCheckinPracticeEntry() {
  const userId = useAuthStore(state => state.profile?.id);
  const needed = useGuidanceStore(state => state.account === String(userId) && state.ready
    && state.progress.welcomeSeen && !state.progress.completed.includes('checkin.finished'));
  return needed;
}
