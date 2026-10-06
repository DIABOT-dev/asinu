import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ScaledText as Text } from '../../../components/ScaledText';
import { useScaledTypography } from '../../../hooks/useScaledTypography';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { spacing } from '../../../styles';

type Props = {
  onShowQr: () => void;
  onScanQr: () => void;
};

export function CareCircleQrActions({ onShowQr, onScanQr }: Props) {
  const { t } = useTranslation('careCircle');
  const { colors } = useThemeColors();
  const { width } = useWindowDimensions();
  const typography = useScaledTypography();
  const textScale = typography.scaledSize.sm / typography.size.sm;
  // Reserve space for padding, the icon and a readable label before using columns.
  const minimumCardWidth = 64 + 100 * textScale;
  const stacked = width - spacing.lg * 2 < minimumCardWidth * 2 + spacing.sm;
  const actions = [
    { id: 'show-qr', title: t('myQrTitle'), hint: t('myQrShortHint'), icon: 'qr-code-outline' as const, onPress: onShowQr },
    { id: 'scan-qr', title: t('scanQr'), hint: t('scanQrShortHint'), icon: 'scan-outline' as const, onPress: onScanQr },
  ];

  return (
    <View style={[styles.row, stacked && styles.stackedRow]}>
      {actions.map(action => (
        <Pressable
          key={action.id}
          accessibilityRole="button"
          accessibilityLabel={action.title}
          accessibilityHint={action.hint}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.action,
            stacked && styles.stackedAction,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name={action.icon} size={28} color={colors.primaryDark} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{action.title}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.lg,
  },
  stackedRow: { flexDirection: 'column' },
  action: {
    flex: 1,
    minWidth: 0,
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
  },
  stackedAction: { flex: 0, width: '100%' },
  pressed: { opacity: 0.8 },
  icon: {
    width: 32,
    alignSelf: 'stretch',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '800', lineHeight: 21 },
});
