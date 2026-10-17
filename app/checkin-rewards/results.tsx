import { useLocalSearchParams } from 'expo-router';
import { GiftDetailScreen } from '../../src/features/checkin-rewards/GiftDetailScreen';
export default function GiftResultsScreen() {
  const { period } = useLocalSearchParams<{ period: string }>();
  return <GiftDetailScreen kind="results" id={period || ''} />;
}
