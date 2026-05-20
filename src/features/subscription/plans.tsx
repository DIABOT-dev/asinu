/**
 * Shared subscription plan definitions + the visual picker tile.
 *
 * Both /subscription (self-purchase) and /subscription/gift import these
 * so the two screens stay visually identical when the product team
 * tweaks pricing or copy. If you change the picker shape, update both
 * screens together (or just import this file again).
 */

import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { ScaledText as Text } from '../../components/ScaledText';
import { colors, radius, spacing, typography } from '../../styles';

export type Plan = { months: number; price: number; discount: number };

export const PLANS: Plan[] = [
  { months: 1,  price: 199000,   discount: 0  },
  { months: 3,  price: 567000,   discount: 5  },
  { months: 6,  price: 1075000,  discount: 10 },
  { months: 12, price: 1910000,  discount: 20 },
];

export function pricePerMonth(plan: Plan): number {
  return Math.round(plan.price / plan.months);
}

export function formatVND(val: number | string): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return Number.isNaN(n) ? '0' : n.toLocaleString('vi-VN');
}

export type PlanOptionProps = {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  /** When the screen is wide enough to render plans in a single column. */
  isXLarge?: boolean;
};

export function PlanOption({ plan, selected, onSelect, isXLarge }: PlanOptionProps) {
  const { t } = useTranslation('subscription');
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(withSpring(0.93), withSpring(1, { damping: 10 }));
    onSelect();
  };

  return (
    <Animated.View style={[animStyle, { width: isXLarge ? '100%' : '47%' }]}>
      <Pressable
        style={[styles.option, selected && styles.selected]}
        onPress={handlePress}
      >
        {plan.discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{plan.discount}%</Text>
          </View>
        )}
        <Text style={[styles.label, selected && styles.labelSelected]}>
          {t('planMonth', { months: plan.months })}
        </Text>
        <Text style={[styles.price, selected && styles.priceSelected]}>
          {formatVND(plan.price)}đ
        </Text>
        <Text style={[styles.perMonth, selected && styles.perMonthSelected]}>
          ~{formatVND(pricePerMonth(plan))}đ{t('perMonth')}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  option: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  selected: { borderColor: colors.premium, backgroundColor: colors.premiumLight },
  discountBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.premium,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderBottomLeftRadius: radius.sm,
  },
  discountText: { fontSize: typography.size.xxs, fontWeight: '800', color: '#fff' },
  label: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  labelSelected: { color: colors.premiumDark },
  price: { fontSize: typography.size.md, fontWeight: '800', color: colors.textPrimary },
  priceSelected: { color: colors.premiumDark },
  perMonth: { fontSize: typography.size.xxs, color: colors.textSecondary, marginTop: 2 },
  perMonthSelected: { color: '#a16207' },
});
