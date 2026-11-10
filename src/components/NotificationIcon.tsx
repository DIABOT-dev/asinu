import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';

type Symbol =
  | 'bell'
  | 'checkin'
  | 'message'
  | 'medication'
  | 'family'
  | 'health'
  | 'activity'
  | 'plan'
  | 'alert'
  | 'reminder'
  | 'gift'
  | 'coin';

function symbolFor(type: string): Symbol {
  if (type === 'emergency' || type.includes('critical')) return 'alert';
  if (
    type.includes('glucose') ||
    type.includes('blood_pressure') ||
    type === 'health_alert' ||
    type === 'caregiver_alert'
  )
    return 'health';
  if (
    type.startsWith('med_') ||
    type.startsWith('medication') ||
    type.startsWith('reminder_medication')
  )
    return 'medication';
  if (
    type.startsWith('doctor') ||
    type.startsWith('consultation') ||
    type === 'coin_card'
  )
    return 'message';
  if (type.includes('coin')) return 'coin';
  if (type.includes('gift')) return 'gift';
  if (
    type.startsWith('care_circle') ||
    type === 'checkin_inactivity_notice' ||
    type === 'caregiver_confirmed'
  )
    return 'family';
  if (
    type.includes('checkin') ||
    type === 'engagement' ||
    type === 'reminder_morning' ||
    type === 'reminder_afternoon' ||
    type === 'reminder_evening'
  )
    return 'checkin';
  if (type.startsWith('reminder')) return 'reminder';
  if (
    type === 'milestone' ||
    type.startsWith('streak') ||
    type.includes('weekly')
  )
    return 'activity';
  if (
    type.includes('subscription') ||
    type.includes('wallet') ||
    type.includes('payment')
  )
    return 'plan';
  return 'bell';
}

const artwork: Record<Symbol, { source: ImageSourcePropType; fill: number }> = {
  bell: {
    source: require('../../assets/images/notifications/bell-v1.png'),
    fill: 117 / 144,
  },
  checkin: {
    source: require('../../assets/images/notifications/checkin-v1.png'),
    fill: 105 / 144,
  },
  message: {
    source: require('../../assets/images/notifications/message-v1.png'),
    fill: 107 / 144,
  },
  medication: {
    source: require('../../assets/images/notifications/medication-v1.png'),
    fill: 95 / 144,
  },
  family: {
    source: require('../../assets/images/notifications/family-v1.png'),
    fill: 122 / 144,
  },
  health: {
    source: require('../../assets/images/notifications/health-v1.png'),
    fill: 104 / 144,
  },
  activity: {
    source: require('../../assets/images/notifications/activity-v1.png'),
    fill: 109 / 144,
  },
  plan: {
    source: require('../../assets/images/notifications/plan-v1.png'),
    fill: 114 / 144,
  },
  alert: {
    source: require('../../assets/images/notifications/alert-v1.png'),
    fill: 101 / 144,
  },
  reminder: {
    source: require('../../assets/images/notifications/reminder-v1.png'),
    fill: 110 / 144,
  },
  gift: {
    source: require('../../assets/images/notifications/gift-v1.png'),
    fill: 105 / 144,
  },
  coin: {
    source: require('../../assets/images/notifications/coin-v1.png'),
    fill: 107 / 144,
  },
};

/** Bundled transparent illustrations keep their appearance on both mobile platforms. */
export function NotificationIcon({
  type,
  size = 30,
}: {
  type: string;
  size?: number;
}) {
  const { colors, categoryColors } = useThemeColors();
  const symbol = symbolFor(type);
  const backgrounds: Record<Symbol, string> = {
    bell: `${colors.primaryText}14`,
    checkin: `${colors.primaryText}14`,
    reminder: colors.premiumLight,
    medication: categoryColors.medicationBg,
    family: categoryColors.glucoseBg,
    message: categoryColors.glucoseBg,
    health: categoryColors.bloodPressureBg,
    alert: categoryColors.bloodPressureBg,
    activity: categoryColors.weightBg,
    plan: `${colors.primaryText}14`,
    gift: colors.premiumLight,
    coin: colors.premiumLight,
  };
  const backgroundColor =
    type.includes('warning') && symbol !== 'alert'
      ? colors.premiumLight
      : backgrounds[symbol];
  // Match the visible object size despite different transparent margins in each illustration.
  const imageSize = Math.min(size / artwork[symbol].fill, 46);
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { backgroundColor }]}
    >
      <Image
        source={artwork[symbol].source}
        style={{ width: imageSize, height: imageSize }}
        resizeMode="contain"
        fadeDuration={0}
        accessible={false}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
