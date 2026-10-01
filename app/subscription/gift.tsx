import { Redirect } from 'expo-router';

// Legacy route kept so old deep links still open the V2 Store billing screen.
export default function LegacySubscriptionGiftRoute() {
  return <Redirect href="/subscription" />;
}
