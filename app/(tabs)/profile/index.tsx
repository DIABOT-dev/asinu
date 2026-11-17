import { Redirect } from 'expo-router';

/** Preserve saved /profile links while personal settings live outside the tabs. */
export default function LegacyProfileRoute() {
  return <Redirect href="/account" />;
}
