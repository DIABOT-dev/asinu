import { useLocalSearchParams } from 'expo-router';
import { GiftDetailScreen } from '../../src/features/checkin-rewards/GiftDetailScreen';
export default function GiftRulesScreen() {
  const { period } = useLocalSearchParams<{ period: string }>();
  return <GiftDetailScreen kind="rules" id={period || ''} />;
}
