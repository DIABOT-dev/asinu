import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useThemeColors } from '../hooks/useThemeColors';
import { HealthCoinIcon } from '../features/v21/HealthCoinIcon';

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

/** A single rounded stroke style, with meaning independent of read/unread state. */
export function NotificationIcon({
  type,
  size = 30,
}: {
  type: string;
  size?: number;
}) {
  const { colors, categoryColors, brandColors } = useThemeColors();
  const symbol = symbolFor(type);
  const tones = {
    bell: [colors.primaryText, `${colors.primaryText}14`],
    checkin: [colors.primaryText, `${colors.primaryText}14`],
    reminder: [colors.premiumDark, colors.premiumLight],
    medication: [categoryColors.medication, categoryColors.medicationBg],
    family: [categoryColors.glucose, categoryColors.glucoseBg],
    message: [categoryColors.glucose, categoryColors.glucoseBg],
    health: [colors.danger, categoryColors.bloodPressureBg],
    alert: [colors.danger, categoryColors.bloodPressureBg],
    activity: [brandColors.violet, categoryColors.weightBg],
    plan: [colors.primaryText, `${colors.primaryText}14`],
    gift: [colors.premiumDark, colors.premiumLight],
    coin: [colors.premiumDark, colors.premiumLight],
  };
  const [color, backgroundColor] =
    type.includes('warning') && symbol !== 'alert'
      ? [colors.premiumDark, colors.premiumLight]
      : tones[symbol];
  const artwork = {
    bell: () => (
      <>
        <Path d="M7 22h18l-2.2-3.4v-5.4a6.8 6.8 0 0 0-13.6 0v5.4L7 22Z" />
        <Path d="M13 26a3.2 3.2 0 0 0 6 0M16 4v2.2" />
      </>
    ),
    checkin: () => (
      <>
        <Rect x="5" y="7" width="22" height="21" rx="5" />
        <Path d="M10 4v6M22 4v6M5 13h22" />
        <Path
          d="M16 24s-5-3.1-5-5.5a2.6 2.6 0 0 1 5-1 2.6 2.6 0 0 1 5 1C21 20.9 16 24 16 24Z"
          fill={color}
          fillOpacity={0.12}
        />
      </>
    ),
    message: () => (
      <>
        <Path d="M9 6h14a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5H12l-7 4V11a5 5 0 0 1 4-5Z" />
        <Path d="M11 13h10M11 18h6" />
        <Circle cx="24" cy="7" r="3.5" fill={color} strokeWidth="0" />
      </>
    ),
    medication: () => (
      <G rotation="42" origin="16,16">
        <Rect x="10" y="3" width="12" height="26" rx="6" />
        <Path d="M10 16h12M14 8v4" />
        <Path
          d="M11 17h10v6a5 5 0 0 1-10 0Z"
          fill={color}
          fillOpacity={0.14}
          stroke="none"
        />
      </G>
    ),
    family: () => (
      <>
        <Circle cx="13" cy="10" r="4.5" />
        <Path
          d="M4.5 27v-3a8.5 8.5 0 0 1 17 0v3H4.5Z"
          fill={color}
          fillOpacity={0.1}
        />
        <Path d="M23 8a4 4 0 0 1 0 8M25 20a6 6 0 0 1 3 5v2" />
      </>
    ),
    health: () => (
      <>
        <Path
          d="M16 27S4 19.7 4 11.9A6.9 6.9 0 0 1 16 7a6.9 6.9 0 0 1 12 4.9C28 19.7 16 27 16 27Z"
          fill={color}
          fillOpacity={0.08}
        />
        <Path d="M6.5 16H12l2.1-4.5 3.4 9 2.5-5h5.5" />
      </>
    ),
    activity: () => (
      <>
        <Rect x="5" y="20" width="5" height="8" rx="1.5" />
        <Rect x="13.5" y="14" width="5" height="14" rx="1.5" />
        <Rect
          x="22"
          y="5"
          width="5"
          height="23"
          rx="1.5"
          fill={color}
          fillOpacity={0.12}
        />
        <Path d="m5 12 6-5 4 2 5-5" />
      </>
    ),
    plan: () => (
      <>
        <Path
          d="m16 4 11 4v8c0 6.5-6 11-11 13C11 27 5 22.5 5 16V8l11-4Z"
          fill={color}
          fillOpacity={0.08}
        />
        <Path d="m10.5 16 4 4 7-8" />
      </>
    ),
    alert: () => (
      <>
        <Path
          d="M13 6a3.5 3.5 0 0 1 6 0l10 17a3.5 3.5 0 0 1-3 5H6a3.5 3.5 0 0 1-3-5L13 6Z"
          fill={color}
          fillOpacity={0.08}
        />
        <Path d="M16 12v7" />
        <Circle cx="16" cy="23" r="1" fill={color} strokeWidth="0" />
      </>
    ),
    reminder: () => (
      <>
        <Circle cx="16" cy="17" r="10" />
        <Path d="M16 11v6l4 2M7 4 3 8M25 4l4 4M8 26l-2 3M24 26l2 3" />
      </>
    ),
    gift: () => (
      <>
        <Rect x="5" y="10" width="22" height="6" rx="2" />
        <Path d="M7 16v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V16M16 10v18" />
        <Path
          d="M16 10s-8 0-8-4a3 3 0 0 1 5-2c2 2 3 6 3 6Zm0 0s8 0 8-4a3 3 0 0 0-5-2c-2 2-3 6-3 6Z"
          fill={color}
          fillOpacity={0.12}
        />
      </>
    ),
    coin: () => null,
  };
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 50,
        height: 50,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor,
        flexShrink: 0,
      }}
    >
      {symbol === 'coin' ? (
        <HealthCoinIcon size={size} />
      ) : (
        <Svg width={size} height={size} viewBox="0 0 32 32" accessible={false}>
          <G
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {artwork[symbol]()}
          </G>
        </Svg>
      )}
    </View>
  );
}
