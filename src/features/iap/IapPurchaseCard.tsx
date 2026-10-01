import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppAlertModal, useAppAlert } from '../../components/AppAlertModal';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { colors, radius, spacing, typography } from '../../styles';
import {
  fetchAvailableProducts,
  openOfferCodeRedemption,
  purchaseSubscription,
  restorePurchases,
  type LocalProduct,
} from './iap.service';

type Props = {
  currentPlanCode?: string;
  currentBillingPeriod?: 'monthly' | 'yearly' | null;
  onPurchased?: () => void;
};

const formatVnd = (value: number) => `${value.toLocaleString('vi-VN')}đ`;

export function IapPurchaseCard({ currentPlanCode = 'free', currentBillingPeriod, onPurchased }: Props) {
  const { t } = useTranslation('subscription');
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [selectedPlan, setSelectedPlan] = useState('antam_2');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAvailableProducts()
      .then((items) => active && setProducts(items))
      .catch(() => active && setProducts([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const choices = useMemo(
    () => products.filter((product) => product.billing_period === period),
    [period, products]
  );
  const selected = choices.find((product) => product.plan_code === selectedPlan) ?? choices[0];
  const selectedIsCurrent =
    selected?.plan_code === currentPlanCode && selected?.billing_period === currentBillingPeriod;

  const buy = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await purchaseSubscription(selected.id, selected);
      if (result.kind === 'success') {
        showAlert(t('iapActivatedTitle'), t('iapActivatedBody', { plan: selected.plan_name }), [
          { text: t('close'), onPress: onPurchased },
        ]);
      } else if (result.kind === 'failed') {
        showAlert(t('iapPaymentFailed'), result.error);
      }
    } finally {
      setBusy(false);
    }
  }, [onPurchased, selected, showAlert, t]);

  const restore = useCallback(async () => {
    setBusy(true);
    try {
      const result = await restorePurchases();
      showAlert(
        result.restored > 0 ? t('iapRestoredTitle') : t('iapNotFoundTitle'),
        result.restored > 0
          ? t('iapRestoredBody', { count: result.restored })
          : t('iapNotFoundBody'),
        result.restored > 0 ? [{ text: t('close'), onPress: onPurchased }] : undefined
      );
    } finally {
      setBusy(false);
    }
  }, [onPurchased, showAlert, t]);

  const redeem = useCallback(async () => {
    try {
      await openOfferCodeRedemption();
    } catch {
      showAlert(t('iapRedeemFailedTitle'), t('iapRedeemFailedBody'));
    }
  }, [showAlert, t]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headingRow}>
        <View style={styles.headerInfo}>
          <View style={styles.eyebrowBadge}>
            <Ionicons name="sparkles" size={12} color="#059669" />
            <Text style={styles.eyebrow}>{t('iapEyebrow')}</Text>
          </View>
          <Text style={styles.title}>{t('iapChooseTitle')}</Text>
          <Text style={styles.subtitle}>{t('v2HeroBody')}</Text>
        </View>
        <View style={styles.headerIconWrap}>
          <MaterialCommunityIcons name="shield-check" size={26} color="#059669" />
        </View>
      </View>

      {/* Period switch */}
      <View style={styles.periodSwitch}>
        <Pressable
          style={[styles.periodButton, period === 'yearly' && styles.periodButtonActive]}
          onPress={() => setPeriod('yearly')}
        >
          <Text style={[styles.periodText, period === 'yearly' && styles.periodTextActive]}>
            {t('iapYearly')}
          </Text>
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsBadgeText}>-20%</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.periodButton, period === 'monthly' && styles.periodButtonActive]}
          onPress={() => setPeriod('monthly')}
        >
          <Text style={[styles.periodText, period === 'monthly' && styles.periodTextActive]}>
            {t('iapMonthly')}
          </Text>
        </Pressable>
      </View>

      {/* Plans List */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <View style={styles.planList}>
          {choices.map((product) => {
            const active = product.plan_code === (selected?.plan_code ?? selectedPlan);
            const current =
              currentPlanCode === product.plan_code && currentBillingPeriod === product.billing_period;
            const isPopular = product.plan_code === 'antam_4';
            return (
              <Pressable
                key={product.id}
                style={[
                  styles.plan,
                  active && styles.planActive,
                  isPopular && !active && styles.planPopularBorder,
                ]}
                onPress={() => setSelectedPlan(product.plan_code)}
              >
                {isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>{t('mostPopular')}</Text>
                  </View>
                )}

                <View style={styles.planTopRow}>
                  <View
                    style={[
                      styles.planAvatar,
                      product.plan_code === 'antam_2' && styles.avatarAntam2,
                      product.plan_code === 'antam_4' && styles.avatarAntam4,
                      product.plan_code === 'antam_8' && styles.avatarAntam8,
                    ]}
                  >
                    {product.plan_code === 'antam_4' ? (
                      <Ionicons name="heart" size={18} color="#ea580c" />
                    ) : product.plan_code === 'antam_8' ? (
                      <MaterialCommunityIcons name="shield-crown" size={20} color="#0284c7" />
                    ) : (
                      <Ionicons name="people" size={18} color="#059669" />
                    )}
                  </View>

                  <View style={styles.planCopy}>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planName}>{product.plan_name}</Text>
                      {current && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>{t('iapCurrent')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.planMeta}>
                      {t('iapProtectMembers', { count: product.protected_members })}
                      {product.consultation_credits > 0
                        ? t('iapGiftCredits', { count: product.consultation_credits })
                        : ''}
                    </Text>
                  </View>

                  <View style={styles.radioWrap}>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={24} color="#059669" />
                    ) : (
                      <View style={styles.radioUnchecked} />
                    )}
                  </View>
                </View>

                <View style={styles.planPriceRow}>
                  <Text style={styles.price}>
                    {product.localizedPrice ?? formatVnd(product.display_price_vnd)}
                    <Text style={styles.pricePeriod}>
                      {' '}{period === 'yearly' ? t('iapPerYear') : t('iapPerMonth')}
                    </Text>
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Primary CTA */}
      <Pressable
        style={[styles.buyButtonWrap, (!selected || busy || selectedIsCurrent) && styles.disabled]}
        onPress={buy}
        disabled={!selected || busy || selectedIsCurrent}
      >
        <LinearGradient
          colors={['#059669', '#047857']}
          end={{ x: 1, y: 0 }}
          start={{ x: 0, y: 0 }}
          style={styles.buyButtonGradient}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="shield-check" size={20} color="#fff" />
              <Text style={styles.buyText}>
                {selectedIsCurrent
                  ? t('iapCurrentExact')
                  : t('iapContinue', { plan: selected?.plan_name ?? t('premium') })}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </>
          )}
        </LinearGradient>
      </Pressable>

      {/* Sub links */}
      <View style={styles.links}>
        <Pressable onPress={redeem} style={styles.linkButton}>
          <Ionicons name="pricetag-outline" size={13} color="#059669" />
          <Text style={styles.linkText}>{t('iapOfferCode')}</Text>
        </Pressable>
        <View style={styles.linkDivider} />
        <Pressable onPress={restore} style={styles.linkButton}>
          <Ionicons name="refresh-outline" size={13} color="#059669" />
          <Text style={styles.linkText}>{t('iapRestore')}</Text>
        </Pressable>
      </View>

      {/* Legal row */}
      <View style={styles.legalRow}>
        <Ionicons name="information-circle-outline" size={14} color={isDark ? '#64748b' : '#94a3b8'} />
        <Text style={styles.legal}>{t('iapLegal')}</Text>
      </View>

      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
    </View>
  );
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: isDark ? colors.surface : '#ffffff',
      borderColor: isDark ? colors.border : '#e2e8f0',
      borderRadius: radius.xxl,
      borderWidth: 1,
      gap: spacing.md,
      marginTop: spacing.lg,
      padding: spacing.lg,
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 12,
      elevation: 2,
    },
    headingRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    headerInfo: {
      flex: 1,
      paddingRight: spacing.sm,
    },
    eyebrowBadge: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
      borderColor: isDark ? '#059669' : '#a7f3d0',
      borderRadius: radius.full,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 5,
      marginBottom: 6,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    eyebrow: {
      color: '#059669',
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    title: {
      color: isDark ? '#f8fafc' : '#0f172a',
      fontSize: typography.size.md + 2,
      fontWeight: '800',
      lineHeight: 24,
    },
    subtitle: {
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: typography.size.xs,
      lineHeight: 18,
      marginTop: 3,
    },
    headerIconWrap: {
      alignItems: 'center',
      backgroundColor: isDark ? '#064e3b' : '#d1fae5',
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    periodSwitch: {
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderRadius: radius.xl,
      flexDirection: 'row',
      padding: 4,
    },
    periodButton: {
      alignItems: 'center',
      borderRadius: radius.lg,
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: 38,
      paddingHorizontal: 8,
      paddingVertical: 7,
    },
    periodButtonActive: {
      backgroundColor: isDark ? '#334155' : '#ffffff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1,
    },
    periodText: {
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: typography.size.xs + 1,
      fontWeight: '700',
    },
    periodTextActive: {
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    savingsBadge: {
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b',
      borderRadius: 8,
      borderWidth: 1,
      marginLeft: 6,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    savingsBadgeText: {
      color: '#b45309',
      fontSize: 10,
      fontWeight: '800',
    },
    loading: {
      paddingVertical: spacing.xl,
    },
    planList: {
      gap: spacing.sm + 2,
    },
    plan: {
      backgroundColor: isDark ? colors.surface : '#ffffff',
      borderColor: isDark ? colors.border : '#e2e8f0',
      borderRadius: 18,
      borderWidth: 1.5,
      padding: 14,
      position: 'relative',
    },
    planActive: {
      backgroundColor: isDark ? '#064e3b18' : '#f0fdf4',
      borderColor: '#059669',
      shadowColor: '#059669',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 2,
    },
    planPopularBorder: {
      borderColor: '#fed7aa',
    },
    popularBadge: {
      backgroundColor: '#ea580c',
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      position: 'absolute',
      right: 14,
      top: -10,
      zIndex: 2,
    },
    popularBadgeText: {
      color: '#fffaf5',
      fontSize: 10,
      fontWeight: '800',
    },
    planTopRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    planAvatar: {
      alignItems: 'center',
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    avatarAntam2: {
      backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
    },
    avatarAntam4: {
      backgroundColor: isDark ? '#431407' : '#fff7ed',
    },
    avatarAntam8: {
      backgroundColor: isDark ? '#082f49' : '#f0f9ff',
    },
    planCopy: {
      flex: 1,
    },
    planTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    planName: {
      color: isDark ? '#f8fafc' : '#0f172a',
      fontSize: typography.size.sm + 1,
      fontWeight: '800',
    },
    currentBadge: {
      backgroundColor: isDark ? '#064e3b' : '#d1fae5',
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    currentBadgeText: {
      color: '#065f46',
      fontSize: 10,
      fontWeight: '700',
    },
    planMeta: {
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: typography.size.xs - 0.5,
      lineHeight: 16,
      marginTop: 2,
    },
    radioWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
    },
    radioUnchecked: {
      borderColor: isDark ? '#475569' : '#cbd5e1',
      borderRadius: 11,
      borderWidth: 1.5,
      height: 22,
      width: 22,
    },
    planPriceRow: {
      marginTop: 8,
      paddingLeft: 48,
    },
    price: {
      color: isDark ? '#34d399' : '#059669',
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    pricePeriod: {
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: typography.size.xs,
      fontWeight: '500',
    },
    buyButtonWrap: {
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#059669',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    buyButtonGradient: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 50,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    buyText: {
      color: '#ffffff',
      fontSize: typography.size.sm,
      fontWeight: '800',
    },
    disabled: {
      opacity: 0.55,
      shadowOpacity: 0,
      elevation: 0,
    },
    links: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      paddingVertical: 2,
    },
    linkButton: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    linkText: {
      color: '#059669',
      fontSize: typography.size.xs,
      fontWeight: '700',
    },
    linkDivider: {
      backgroundColor: isDark ? colors.border : '#e2e8f0',
      height: 14,
      width: 1,
    },
    legalRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 4,
    },
    legal: {
      color: isDark ? '#64748b' : '#94a3b8',
      flex: 1,
      fontSize: 10.5,
      lineHeight: 15,
    },
  });
}
