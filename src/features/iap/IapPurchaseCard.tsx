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

const DEFAULT_PRODUCTS: LocalProduct[] = [
  {
    id: 'asinu.antam1.yearly',
    plan_code: 'antam_1',
    plan_name: 'An Tâm 1',
    billing_period: 'yearly',
    plan_months: 12,
    protected_members: 1,
    consultation_credits: 1,
    display_price_vnd: 699000,
  },
  {
    id: 'asinu.antam1.monthly',
    plan_code: 'antam_1',
    plan_name: 'An Tâm 1',
    billing_period: 'monthly',
    plan_months: 1,
    protected_members: 1,
    consultation_credits: 0,
    display_price_vnd: 89000,
  },
  {
    id: 'asinu.antam2.yearly',
    plan_code: 'antam_2',
    plan_name: 'An Tâm 2',
    billing_period: 'yearly',
    plan_months: 12,
    protected_members: 2,
    consultation_credits: 2,
    display_price_vnd: 1199000,
  },
  {
    id: 'asinu.antam2.monthly',
    plan_code: 'antam_2',
    plan_name: 'An Tâm 2',
    billing_period: 'monthly',
    plan_months: 1,
    protected_members: 2,
    consultation_credits: 0,
    display_price_vnd: 149000,
  },
  {
    id: 'asinu.antam4.yearly',
    plan_code: 'antam_4',
    plan_name: 'An Tâm 4',
    billing_period: 'yearly',
    plan_months: 12,
    protected_members: 4,
    consultation_credits: 4,
    display_price_vnd: 1499000,
  },
  {
    id: 'asinu.antam4.monthly',
    plan_code: 'antam_4',
    plan_name: 'An Tâm 4',
    billing_period: 'monthly',
    plan_months: 1,
    protected_members: 4,
    consultation_credits: 0,
    display_price_vnd: 199000,
  },
  {
    id: 'asinu.antam8.yearly',
    plan_code: 'antam_8',
    plan_name: 'An Tâm 8',
    billing_period: 'yearly',
    plan_months: 12,
    protected_members: 8,
    consultation_credits: 8,
    display_price_vnd: 1799000,
  },
  {
    id: 'asinu.antam8.monthly',
    plan_code: 'antam_8',
    plan_name: 'An Tâm 8',
    billing_period: 'monthly',
    plan_months: 1,
    protected_members: 8,
    consultation_credits: 0,
    display_price_vnd: 249000,
  },
];

export function IapPurchaseCard({ currentPlanCode = 'free', currentBillingPeriod, onPurchased }: Props) {
  const { t } = useTranslation('subscription');
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const [products, setProducts] = useState<LocalProduct[]>(DEFAULT_PRODUCTS);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [selectedPlan, setSelectedPlan] = useState('antam_4');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAvailableProducts()
      .then((items) => {
        if (!active) return;
        if (items && items.length > 0) {
          const merged = DEFAULT_PRODUCTS.map((def) => {
            const found = items.find(
              (it) => it.plan_code === def.plan_code && it.billing_period === def.billing_period
            );
            return found ? { ...def, ...found } : def;
          });
          setProducts(merged);
        } else {
          setProducts(DEFAULT_PRODUCTS);
        }
      })
      .catch(() => {
        if (active) setProducts(DEFAULT_PRODUCTS);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
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

  const row1 = useMemo(
    () => choices.filter((p) => p.plan_code === 'antam_1' || p.plan_code === 'antam_2'),
    [choices]
  );
  const row2 = useMemo(
    () => choices.filter((p) => p.plan_code === 'antam_4' || p.plan_code === 'antam_8'),
    [choices]
  );

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

  const renderCard = (product?: LocalProduct) => {
    if (!product) return null;
    const active = product.plan_code === (selected?.plan_code ?? selectedPlan);
    const current =
      currentPlanCode === product.plan_code && currentBillingPeriod === product.billing_period;
    const isPopular = product.plan_code === 'antam_4';

    const getPlanAvatar = () => {
      switch (product.plan_code) {
        case 'antam_1':
          return (
            <View style={[styles.gridCardAvatar, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }]}>
              <Ionicons name="person" size={20} color="#059669" />
            </View>
          );
        case 'antam_2':
          return (
            <View style={[styles.gridCardAvatar, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }]}>
              <Ionicons name="people" size={20} color="#059669" />
            </View>
          );
        case 'antam_4':
          return (
            <View style={[styles.gridCardAvatar, { backgroundColor: isDark ? '#431407' : '#fff7ed' }]}>
              <Ionicons name="heart" size={20} color="#ea580c" />
            </View>
          );
        case 'antam_8':
        default:
          return (
            <View style={[styles.gridCardAvatar, { backgroundColor: isDark ? '#082f49' : '#f0f9ff' }]}>
              <MaterialCommunityIcons name="shield-crown" size={22} color="#0284c7" />
            </View>
          );
      }
    };

    const features = [
      t('iapProtectMembersShort', { count: product.protected_members }),
      period === 'yearly' && product.consultation_credits > 0
        ? t('iapConsultationCount', { count: product.consultation_credits })
        : t('iapNoConsultation'),
      t('iapAiCallcenterShort'),
      t('iapEarlySignalsShort'),
    ];

    return (
      <Pressable
        key={product.id}
        style={[
          styles.gridCard,
          active && styles.gridCardActive,
          isPopular && !active && styles.gridCardPopularBorder,
        ]}
        onPress={() => setSelectedPlan(product.plan_code)}
      >
        {isPopular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>{t('mostPopular')}</Text>
          </View>
        )}

        <View style={styles.gridCardHeader}>
          {getPlanAvatar()}
          <Text style={[styles.gridCardTitle, active && styles.gridCardTitleActive]}>
            {product.plan_name}
          </Text>
          <View style={styles.gridPriceWrap}>
            <Text style={[styles.gridPriceText, active && styles.gridPriceTextActive]}>
              {product.localizedPrice ?? formatVnd(product.display_price_vnd)}
            </Text>
            <Text style={styles.gridPricePeriod}>
              {period === 'yearly' ? t('iapPerYear') : t('iapPerMonth')}
            </Text>
          </View>
        </View>

        <View style={styles.gridFeatureList}>
          {features.map((item, idx) => (
            <View key={idx} style={styles.gridFeatureRow}>
              <View style={styles.gridFeatureIconWrap}>
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={active ? (isPopular ? '#ea580c' : '#059669') : '#059669'}
                />
              </View>
              <Text
                numberOfLines={2}
                style={[styles.gridFeatureText, active && styles.gridFeatureTextActive]}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>

        <View style={active ? styles.cardActivePill : styles.cardInactivePill}>
          {active ? (
            <View style={styles.pillRow}>
              <Ionicons name="checkmark" size={13} color="#fff" />
              <Text style={styles.cardActivePillText}>
                {current ? t('iapCurrent') : t('iapSelected')}
              </Text>
            </View>
          ) : (
            <Text style={styles.cardInactivePillText}>
              {current ? t('iapCurrent') : t('iapSelectPlan')}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headingRow}>
        <View style={styles.headerInfo}>
          <View style={styles.eyebrowBadge}>
            <Ionicons name="sparkles" size={12} color="#059669" />
            <Text style={styles.eyebrow}>{t('iapEyebrow')}</Text>
          </View>
          <Text style={styles.title}>{t('iapPackageSectionTitle')}</Text>
          <Text style={styles.subtitle}>{t('iapPackageSectionSubtitle')}</Text>
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
            <Text style={styles.savingsBadgeText}>{t('iapYearlyDiscountBadge')}</Text>
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

      {/* 2x2 Plans Grid */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <View style={styles.gridWrap}>
          <View style={styles.gridRow}>
            {renderCard(row1[0])}
            {renderCard(row1[1])}
          </View>
          <View style={styles.gridRow}>
            {renderCard(row2[0])}
            {renderCard(row2[1])}
          </View>
        </View>
      )}

      {/* Primary CTA */}
      <Pressable
        style={[styles.buyButtonWrap, (!selected || busy || selectedIsCurrent) && styles.disabled]}
        onPress={buy}
        disabled={!selected || busy || selectedIsCurrent}
      >
        <LinearGradient
          colors={selected?.plan_code === 'antam_4' ? ['#f97316', '#ea580c'] : ['#059669', '#047857']}
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
                  : `${t('iapContinue', { plan: selected?.plan_name ?? t('premium') })} · ${selected?.localizedPrice ?? formatVnd(selected?.display_price_vnd ?? 0)}`}
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
    gridWrap: {
      gap: 12,
    },
    gridRow: {
      alignItems: 'stretch',
      flexDirection: 'row',
      gap: 10,
    },
    gridCard: {
      backgroundColor: isDark ? colors.surface : '#fffdfa',
      borderColor: isDark ? colors.border : '#e2e8f0',
      borderRadius: 20,
      borderWidth: 1.5,
      flex: 1,
      justifyContent: 'space-between',
      padding: 12,
      position: 'relative',
    },
    gridCardActive: {
      backgroundColor: isDark ? '#1c1917' : '#fffbf5',
      borderColor: '#ea580c',
      shadowColor: '#ea580c',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 3,
    },
    gridCardPopularBorder: {
      borderColor: '#fed7aa',
    },
    popularBadge: {
      backgroundColor: '#ea580c',
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
      position: 'absolute',
      right: 10,
      top: -10,
      zIndex: 2,
    },
    popularBadgeText: {
      color: '#fffaf5',
      fontSize: 9.5,
      fontWeight: '800',
    },
    gridCardHeader: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      minHeight: 116,
      paddingBottom: 4,
      paddingTop: 4,
    },
    gridCardAvatar: {
      alignItems: 'center',
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      marginBottom: 6,
      width: 44,
    },
    gridCardTitle: {
      color: isDark ? '#f8fafc' : '#0f172a',
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
    },
    gridCardTitleActive: {
      color: '#ea580c',
    },
    gridPriceWrap: {
      alignItems: 'center',
      height: 38,
      justifyContent: 'center',
      marginTop: 2,
    },
    gridPriceText: {
      color: isDark ? '#f8fafc' : '#0f172a',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    gridPriceTextActive: {
      color: '#ea580c',
    },
    gridPricePeriod: {
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: 10.5,
      marginTop: -2,
    },
    gridFeatureList: {
      gap: 8,
      marginVertical: 10,
    },
    gridFeatureRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      minHeight: 28,
    },
    gridFeatureIconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 5,
      marginTop: 1,
      width: 16,
    },
    gridFeatureText: {
      color: isDark ? '#cbd5e1' : '#475569',
      flex: 1,
      fontSize: 10.5,
      lineHeight: 14.5,
    },
    gridFeatureTextActive: {
      color: isDark ? '#f8fafc' : '#1e293b',
      fontWeight: '600',
    },
    cardActivePill: {
      alignItems: 'center',
      backgroundColor: '#ea580c',
      borderRadius: 10,
      justifyContent: 'center',
      marginTop: 6,
      minHeight: 34,
      paddingHorizontal: 6,
      paddingVertical: 6,
    },
    cardActivePillText: {
      color: '#fffaf5',
      fontSize: 11,
      fontWeight: '700',
    },
    cardInactivePill: {
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderRadius: 10,
      justifyContent: 'center',
      marginTop: 6,
      minHeight: 34,
      paddingHorizontal: 6,
      paddingVertical: 6,
    },
    cardInactivePillText: {
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: 11,
      fontWeight: '600',
    },
    pillRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    buyButtonWrap: {
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#ea580c',
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
      elevation: 0,
      opacity: 0.55,
      shadowOpacity: 0,
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
