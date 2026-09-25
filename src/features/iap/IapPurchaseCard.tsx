/**
 * UI block rendered on /subscription when env.paymentMethod === 'iap'.
 *
 * Reads the backend catalogue + local native-store price,
 * shows a picker between monthly / yearly, fires the platform purchase
 * sheet, and on success refreshes the parent screen's premium status.
 *
 * Lives in features/iap (not in /app) so the same card can be embedded
 * in onboarding paywalls later without duplicating logic.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppAlertModal, useAppAlert } from '../../components/AppAlertModal';
import { ScaledText as Text } from '../../components/ScaledText';
import { colors, radius, spacing, typography } from '../../styles';
import { env } from '../../lib/env';
import {
  fetchAvailableProducts,
  purchaseSubscription,
  restorePurchases,
  type LocalProduct,
} from './iap.service';

type Props = {
  /** Called after a successful purchase so the parent can refresh status. */
  onPurchased?: () => void;
};

function formatVND(n: number): string {
  return n.toLocaleString('vi-VN');
}

export function IapPurchaseCard({ onPurchased }: Props) {
  const { t } = useTranslation('subscription');
  const { alertState, showAlert, dismissAlert } = useAppAlert();

  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Load products on mount. Falls back to backend-only when StoreKit /
  // Native store pricing may be unavailable in some environments; UI can still show a VND price.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchAvailableProducts();
        if (cancelled) return;
        setProducts(list);
        // Default-select the yearly plan if present, otherwise the first.
        const def =
          list.find(p => p.id === env.iapProductYearly) ?? list[0];
        setSelectedId(def?.id ?? null);
      } catch (err) {
        console.warn('[iap] failed to load products:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selected = products.find(p => p.id === selectedId);

  const handlePurchase = useCallback(async () => {
    if (!selected) return;
    setPurchasing(true);
    try {
      const result = await purchaseSubscription(selected.id, selected);
      if (result.kind === 'success') {
        showAlert(
          t('activationSuccess'),
          t('activationSuccessDesc'),
          [{ text: t('close'), onPress: onPurchased }],
        );
      } else if (result.kind === 'cancelled') {
        // Silent — user backed out of the sheet.
      } else {
        showAlert(
          t('paymentFailed'),
          result.error || t('paymentNetworkError'),
        );
      }
    } finally {
      setPurchasing(false);
    }
  }, [selected, t, onPurchased, showAlert]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const res = await restorePurchases();
      if (res.restored > 0) {
        showAlert(
          t('restoreSuccess'),
          t('restoreSuccessDesc', { count: res.restored }),
          [{ text: t('close'), onPress: onPurchased }],
        );
      } else {
        showAlert(
          t('restoreNoneTitle'),
          t('restoreNoneBody'),
        );
      }
    } finally {
      setRestoring(false);
    }
  }, [t, onPurchased, showAlert]);

  const alertModal = <AppAlertModal {...alertState} onDismiss={dismissAlert} />;

  if (loading) {
    return (
      <>
        <View style={styles.card}>
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>
              {t('loadingPrices')}
            </Text>
          </View>
        </View>
        {alertModal}
      </>
    );
  }

  if (products.length === 0) {
    return (
      <>
        <View style={styles.card}>
          <Text style={styles.errorText}>
            {t('iapNoProducts')}
          </Text>
        </View>
        {alertModal}
      </>
    );
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {t('chooseIapPlan')}
        </Text>

        <View style={styles.options}>
          {products.map(p => {
            const isSelected = p.id === selectedId;
            const priceLabel =
              p.localizedPrice ?? `${formatVND(p.display_price_vnd)}đ`;
            return (
              <Pressable
                key={p.id}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => setSelectedId(p.id)}
              >
                <View style={styles.optionHeader}>
                  <Text style={styles.optionMonths}>
                    {p.plan_months === 12
                      ? t('planYear')
                      : t('planMonth', { months: p.plan_months })}
                  </Text>
                  {p.plan_months === 12 && (
                    <View style={styles.bestBadge}>
                      <Text style={styles.bestBadgeText}>
                        {t('bestValue')}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.optionPrice}>{priceLabel}</Text>
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.premiumDark}
                    />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={styles.cta}
          disabled={purchasing || !selected}
          onPress={handlePurchase}
        >
          <View style={styles.ctaGradient}>
            {purchasing ? (
              <ActivityIndicator color={colors.premiumDark} />
            ) : (
              <View style={styles.ctaRow}>
                <MaterialCommunityIcons name="crown" size={18} color={colors.premiumDark} />
                <Text style={styles.ctaText}>
                  {t('upgradeNow')}
                </Text>
              </View>
            )}
          </View>
        </Pressable>

        <Pressable
          style={styles.restoreBtn}
          disabled={restoring}
          onPress={handleRestore}
        >
          {restoring ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={styles.restoreText}>
              {t('restorePurchases')}
            </Text>
          )}
        </Pressable>

        <Text style={styles.legalNote}>
          {t('iapLegalNote')}
        </Text>
      </View>
      {alertModal}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: typography.size.sm,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  options: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.premium,
    backgroundColor: colors.premiumLight,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optionMonths: {
    fontSize: typography.size.sm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bestBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.premiumLight,
  },
  bestBadgeText: {
    color: colors.premiumDark,
    fontSize: typography.size.xs,
    fontWeight: '700',
  },
  optionPrice: {
    fontSize: typography.size.md,
    fontWeight: '800',
    color: colors.premiumDark,
  },
  checkmark: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },

  cta: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  ctaGradient: { paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.premiumLight },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ctaText: { color: colors.premiumDark, fontWeight: '800', fontSize: typography.size.sm },

  restoreBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  restoreText: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  legalNote: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: spacing.sm,
  },
});
