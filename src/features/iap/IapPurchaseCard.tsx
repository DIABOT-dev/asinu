import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppAlertModal, useAppAlert } from '../../components/AppAlertModal';
import { ScaledText as Text } from '../../components/ScaledText';
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
    return () => { active = false; };
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
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>{t('iapEyebrow')}</Text>
          <Text style={styles.title}>{t('iapChooseTitle')}</Text>
        </View>
        <MaterialCommunityIcons name="shield-check" size={32} color={colors.primary} />
      </View>

      <View style={styles.periodSwitch}>
        {(['yearly', 'monthly'] as const).map((value) => (
          <Pressable
            key={value}
            style={[styles.periodButton, period === value && styles.periodButtonActive]}
            onPress={() => setPeriod(value)}
          >
            <Text style={[styles.periodText, period === value && styles.periodTextActive]}>
              {value === 'yearly' ? t('iapYearly') : t('iapMonthly')}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <View style={styles.planList}>
          {choices.map((product) => {
            const active = product.plan_code === selected?.plan_code;
            const current =
              currentPlanCode === product.plan_code && currentBillingPeriod === product.billing_period;
            return (
              <Pressable
                key={product.id}
                style={[styles.plan, active && styles.planActive]}
                onPress={() => setSelectedPlan(product.plan_code)}
              >
                <View style={styles.planTop}>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                  <View style={styles.planCopy}>
                    <Text style={styles.planName}>{product.plan_name}</Text>
                    <Text style={styles.planMeta}>
                      {t('iapProtectMembers', { count: product.protected_members })}
                      {product.consultation_credits > 0
                        ? t('iapGiftCredits', { count: product.consultation_credits })
                        : ''}
                    </Text>
                  </View>
                  {current && <Text style={styles.currentBadge}>{t('iapCurrent')}</Text>}
                </View>
                <Text style={styles.price}>
                  {product.localizedPrice ?? formatVnd(product.display_price_vnd)}
                  <Text style={styles.pricePeriod}>{period === 'yearly' ? t('iapPerYear') : t('iapPerMonth')}</Text>
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        style={[styles.buyButton, (!selected || busy || selectedIsCurrent) && styles.disabled]}
        onPress={buy}
        disabled={!selected || busy || selectedIsCurrent}
      >
        {busy ? <ActivityIndicator color="#fff" /> : (
          <>
            <MaterialCommunityIcons name="shield-check" size={20} color="#fff" />
            <Text style={styles.buyText}>
              {selectedIsCurrent
                ? t('iapCurrentExact')
                : t('iapContinue', { plan: selected?.plan_name ?? t('premium') })}
            </Text>
          </>
        )}
      </Pressable>

      <View style={styles.links}>
        <Pressable onPress={redeem}><Text style={styles.link}>{t('iapOfferCode')}</Text></Pressable>
        <View style={styles.linkDivider} />
        <Pressable onPress={restore}><Text style={styles.link}>{t('iapRestore')}</Text></Pressable>
      </View>
      <View style={styles.legalRow}>
        <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
        <Text style={styles.legal}>
          {t('iapLegal')}
        </Text>
      </View>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: typography.size.xxs, fontWeight: '800', color: colors.primary, letterSpacing: 1 },
  title: { marginTop: 3, fontSize: typography.size.lg, fontWeight: '800', color: colors.textPrimary },
  periodSwitch: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, padding: 4, borderRadius: radius.lg },
  periodButton: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.md },
  periodButtonActive: { backgroundColor: colors.surface },
  periodText: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textSecondary },
  periodTextActive: { color: colors.primaryDark },
  loading: { paddingVertical: spacing.xl },
  planList: { gap: spacing.sm },
  plan: { padding: spacing.md, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface },
  planActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  planCopy: { flex: 1 },
  planName: { fontSize: typography.size.md, fontWeight: '800', color: colors.textPrimary },
  planMeta: { marginTop: 2, fontSize: typography.size.xs, color: colors.textSecondary },
  currentBadge: { fontSize: typography.size.xxs, fontWeight: '800', color: colors.primaryDark, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  price: { marginTop: spacing.sm, marginLeft: 28, fontSize: typography.size.lg, fontWeight: '900', color: colors.primaryDark },
  pricePeriod: { fontSize: typography.size.xs, fontWeight: '600', color: colors.textSecondary },
  buyButton: { minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  buyText: { color: '#fff', fontSize: typography.size.sm, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  link: { color: colors.primaryDark, fontSize: typography.size.xs, fontWeight: '700' },
  linkDivider: { width: 1, height: 14, backgroundColor: colors.border },
  legalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  legal: { flex: 1, fontSize: typography.size.xxs, lineHeight: 17, color: colors.textSecondary },
});
