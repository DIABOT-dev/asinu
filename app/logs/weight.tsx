import { Redirect } from 'expo-router';

// Keep installed deep links usable after retiring weight journals.
export default function RetiredWeightLog() {
  return <Redirect href="/logs" />;
}
