import { useLocalSearchParams } from 'expo-router';
import { GiftDetailScreen } from '../../src/features/checkin-rewards/GiftDetailScreen';
export default function GiftReceiptScreen() {
  const { gift } = useLocalSearchParams<{ gift: string }>();
  return <GiftDetailScreen kind="receipt" id={gift || ''} />;
}
