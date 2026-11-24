import ProfileScreen from '../src/features/profile/ProfileScreen';
import { useOnboardingGate } from '../src/features/auth/useOnboardingGate';

export default function AccountScreen() {
  const allowed = useOnboardingGate();
  return allowed ? <ProfileScreen standalone /> : null;
}
