import { useAuthStore } from '../auth/auth.store';

/** The backend owns age/gender policy; UI only renders its addressing fields. */
export function useCheckinAddressing() {
  const addressing = useAuthStore(state => state.profile?.checkinAddressing);
  return {
    honorific: addressing?.honorific || 'bạn',
    Honorific: addressing?.Honorific || 'Bạn',
    CallName: addressing?.CallName || addressing?.Honorific || 'Bạn',
  };
}
