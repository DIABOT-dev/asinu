import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ScaledText as Text } from '../../../components/ScaledText';
import { useScaledFontSize } from '../../../hooks/useScaledTypography';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { ProfilePreferenceModal } from '../../profile/ProfilePreferenceModal';
import { localizedPlanName } from '../planName';
import type { PlanCode } from '../subscription.types';

export const FREE_PLAN_BENEFITS = [
  'v2FreeFeature1', 'v2FreeFeature2', 'v2FreeFeature3',
  'v2FreeFeature4', 'v2FreeFeature5', 'v2FreeFeature6',
] as const;
export const AN_TAM_PLAN_BENEFITS = [
  'v2AnTamFeature1', 'v2AnTamFeature2', 'v2AnTamFeature3',
  'v2AnTamFeature4', 'v2AnTamFeature5', 'v2AnTamFeature6',
] as const;

type Props = {
  visible: boolean;
  premium: boolean;
  currentPlanCode?: PlanCode;
  expiresAt?: string | null;
  disabled?: boolean;
  onClose: () => void;
  onChoosePlan?: () => void;
};

/** A quick overview: only benefits scroll; the plan, close button and action stay visible. */
export function PlanDetailsModal({
  visible, premium, currentPlanCode, expiresAt, disabled = false, onClose, onChoosePlan,
}: Props) {
  const { t, i18n } = useTranslation('subscription');
  const { colors, isDark } = useThemeColors();
  const { fontScale } = useWindowDimensions();
  const titleSize = useScaledFontSize(17);
  const checkSize = Math.round(useScaledFontSize(16) * fontScale);
  const titleLineHeight = Math.round(titleSize * (Platform.OS === 'android' ? 1.6 : 1.5)) * fontScale;
  const benefits = premium ? AN_TAM_PLAN_BENEFITS : FREE_PLAN_BENEFITS;
  const title = currentPlanCode
    ? localizedPlanName(currentPlanCode, t)
    : t(premium ? 'v2AnTamPlanName' : 'v2FreePlan');
  const expiry = expiresAt ? new Date(expiresAt) : null;
  const meta = !premium ? t('freeForever')
    : expiry && !Number.isNaN(expiry.getTime())
      ? t('validUntil', { date: expiry.toLocaleDateString(i18n.language.startsWith('en') ? 'en-US' : 'vi-VN') })
      : currentPlanCode ? t('currentlyUsing') : `${t('iapMonthly')} · ${t('iapYearly')}`;
  const action = t(premium ? currentPlanCode ? 'viewPlans' : 'iapChooseTitle' : 'upgradeNow');

  return (
    <ProfilePreferenceModal
      visible={visible}
      title={title}
      onClose={onClose}
      headerContent={<Text allowFontScaling style={[styles.meta, { color: colors.textSecondary }]}>{meta}</Text>}
      footer={onChoosePlan && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => { if (!disabled) onChoosePlan(); }}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: isDark ? '#83DDD0' : '#0F766E', opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
          ]}
        >
          <Text allowFontScaling style={[styles.actionText, { color: isDark ? '#10332F' : '#F8FDFB' }]}>{action}</Text>
        </Pressable>
      )}
    >
      <View style={styles.benefits}>
        {benefits.map((key) => (
          <View key={key} style={styles.benefit}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.check, { height: titleLineHeight, width: checkSize + 2 }]}
            >
              <Ionicons
                name="checkmark-circle"
                allowFontScaling={false}
                size={checkSize}
                color={colors.primaryText}
                style={{ lineHeight: checkSize, includeFontPadding: false }}
              />
            </View>
            <Text allowFontScaling style={[styles.benefitText, { color: colors.textPrimary }]}>{t(key)}</Text>
          </View>
        ))}
      </View>
    </ProfilePreferenceModal>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 14 },
  benefits: { gap: 10, paddingVertical: 4 },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 36 },
  check: { flexShrink: 0, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  benefitText: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: '500' },
  action: { minHeight: 56, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
});
