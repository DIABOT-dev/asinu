import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { apiClient } from '../../src/lib/apiClient';
import { colors, radius, spacing } from '../../src/styles';

// ── Types ──────────────────────────────────────────────────────────
type SubscriptionStatus = {
  ok: boolean;
  tier: 'free' | 'premium';
  isPremium: boolean;
  expiresAt: string | null;
  voiceUsedThisMonth: number;
  voiceMonthlyLimit: number;
};

type QRData = {
  order_code: string;
  qr_url: string;
  amount: number;
  description: string;
  expires_at: string;
  plan_months: number;
  discount: number;
};

type SubRecord = {
  id: number;
  order_code: string;
  amount: string;
  status: 'pending' | 'completed' | 'failed';
  plan_months: number;
  subscription_end: string | null;
  created_at: string;
};

// ── Plans ─────────────────────────────────────────────────────────
const PLANS = [
  { months: 1,  label: '1 tháng',  price: 199000,   discount: 0  },
  { months: 3,  label: '3 tháng',  price: 567000,   discount: 5  },
  { months: 6,  label: '6 tháng',  price: 1075000,  discount: 10 },
  { months: 12, label: '12 tháng', price: 1910000,  discount: 20 },
];

// ── Helpers ─────────────────────────────────────────────────────────
function formatVND(val: number | string) {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) ? '0' : n.toLocaleString('vi-VN');
}
function formatDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatCountdown(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}
function pricePerMonth(plan: typeof PLANS[0]) {
  return Math.round(plan.price / plan.months);
}

// ── Feature row ──────────────────────────────────────────────────────
type FeatureRowProps = { icon: React.ReactNode; text: string; premium?: boolean; dim?: boolean };
function FeatureRow({ icon, text, premium, dim }: FeatureRowProps) {
  return (
    <View style={featureRowStyle.row}>
      <View style={featureRowStyle.iconWrap}>{icon}</View>
      <Text style={[featureRowStyle.text, premium && featureRowStyle.premiumText, dim && featureRowStyle.dimText]}>
        {text}
      </Text>
    </View>
  );
}
const featureRowStyle = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  iconWrap: { width: 20, alignItems: 'center' },
  text: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  premiumText: { color: '#d97706', fontWeight: '600' },
  dimText: { opacity: 0.5 },
});

// ── Status badge color ────────────────────────────────────────────────
function statusColor(s: SubRecord['status']) {
  if (s === 'completed') return colors.success;
  if (s === 'failed') return colors.danger;
  return colors.warning;
}

// ── Main Screen ──────────────────────────────────────────────────────
export default function SubscriptionScreen() {
  const { t } = useTranslation('subscription');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography, insets.top), [scaledTypography, insets.top]);

  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(1); // months
  const [qr, setQr] = useState<QRData | null>(null);
  const [creatingQR, setCreatingQR] = useState(false);
  const [history, setHistory] = useState<SubRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [pollStatus, setPollStatus] = useState<'idle' | 'polling' | 'success'>('idle');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient<SubscriptionStatus>('/api/subscriptions/status');
      setStatus(res);
    } catch { /* silent */ } finally { setLoadingStatus(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient<{ ok: boolean; subscriptions: SubRecord[] }>('/api/subscriptions/history?limit=10');
      if (res.ok) setHistory(res.subscriptions);
    } catch { /* silent */ } finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    return () => clearTimers();
  }, []);

  const startCountdown = useCallback((expiresAt: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const rem = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setCountdown(rem);
      if (rem <= 0 && timerRef.current) clearInterval(timerRef.current);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, []);

  const startPolling = useCallback((orderCode: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPollStatus('polling');
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiClient<{ ok: boolean; subscriptions: SubRecord[] }>('/api/subscriptions/history?limit=5');
        if (res.ok) {
          const found = res.subscriptions.find(s => s.order_code === orderCode && s.status === 'completed');
          if (found) { clearTimers(); setPollStatus('success'); setHistory(res.subscriptions); fetchStatus(); }
        }
      } catch { /* silent */ }
    }, 5000);
  }, [clearTimers, fetchStatus]);

  const handleCreateQR = useCallback(async () => {
    setCreatingQR(true);
    try {
      const res = await apiClient<QRData>('/api/subscriptions/qr', { method: 'POST', body: { months: selectedPlan } });
      setQr(res);
      setPollStatus('idle');
      startCountdown(res.expires_at);
      startPolling(res.order_code);
    } catch { /* silent */ } finally { setCreatingQR(false); }
  }, [selectedPlan, startCountdown, startPolling]);

  const handleCancelQR = useCallback(() => { clearTimers(); setQr(null); setPollStatus('idle'); }, [clearTimers]);
  const isQrExpired = qr ? countdown <= 0 && pollStatus !== 'success' : false;

  function statusLabel(s: SubRecord['status']) {
    if (s === 'completed') return t('statusCompleted');
    if (s === 'failed') return t('statusFailed');
    return t('statusPending');
  }

  const freeFeatures = [
    { icon: <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />, text: t('features.history7d') },
    { icon: <Ionicons name="people-outline" size={16} color={colors.textSecondary} />, text: t('features.connections3') },
    { icon: <Ionicons name="mic-off-outline" size={16} color={colors.textSecondary} />, text: t('features.voiceNo'), dim: true },
  ];
  const premiumFeatures = [
    { icon: <Ionicons name="checkmark-circle" size={16} color="#d97706" />, text: t('features.history365d') },
    { icon: <Ionicons name="checkmark-circle" size={16} color="#d97706" />, text: t('features.connections50') },
    { icon: <Ionicons name="checkmark-circle" size={16} color="#d97706" />, text: t('features.voice5k') },
  ];

  const activePlan = PLANS.find(p => p.months === selectedPlan) ?? PLANS[0];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <LinearGradient colors={['#f59e0b', '#d97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>{t('title')}</Text>
          <MaterialCommunityIcons name="crown" size={40} color="#fff" style={styles.crownIcon} />
        </LinearGradient>

        {/* ── Current plan ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('currentPlan')}</Text>
          {loadingStatus ? <ActivityIndicator color={colors.primary} /> : (
            <View style={styles.planRow}>
              <View style={[styles.planBadge, status?.isPremium ? styles.premiumBadge : styles.freeBadge]}>
                {status?.isPremium
                  ? <MaterialCommunityIcons name="crown" size={14} color="#d97706" />
                  : <Ionicons name="person-outline" size={14} color={colors.textSecondary} />}
                <Text style={[styles.planBadgeText, status?.isPremium ? styles.premiumBadgeText : styles.freeBadgeText]}>
                  {status?.isPremium ? t('premium') : t('free')}
                </Text>
              </View>
              {status?.isPremium && status.expiresAt
                ? <Text style={styles.expiresText}>{t('expiresAt', { date: formatDate(status.expiresAt) })}</Text>
                : null}
            </View>
          )}
          {/* Voice usage bar for premium users */}
          {status?.isPremium && (
            <View style={styles.voiceBar}>
              <View style={styles.voiceBarHeader}>
                <MaterialCommunityIcons name="microphone" size={13} color="#d97706" />
                <Text style={styles.voiceBarLabel}>
                  {t('voiceUsage', { used: status.voiceUsedThisMonth, limit: status.voiceMonthlyLimit })}
                </Text>
              </View>
              <View style={styles.voiceBarTrack}>
                <View style={[styles.voiceBarFill, { width: `${Math.min(100, (status.voiceUsedThisMonth / status.voiceMonthlyLimit) * 100)}%` as any }]} />
              </View>
            </View>
          )}
        </View>

        {/* ── Two-column feature comparison ── */}
        <View style={styles.plansRow}>

          {/* Free card */}
          <View style={[styles.planCard, styles.freePlanCard]}>
            <View style={styles.planCardHeader}>
              <Ionicons name="person-circle-outline" size={28} color={colors.textSecondary} />
              <Text style={styles.freePlanTitle}>{t('free')}</Text>
              <Text style={styles.freePlanPrice}>0đ</Text>
              <Text style={styles.planPriceUnit}>{t('perMonth')}</Text>
            </View>
            <View style={styles.planCardBody}>
              {freeFeatures.map((f, i) => (
                <FeatureRow key={i} icon={f.icon} text={f.text} dim={f.dim} />
              ))}
            </View>
            <View style={[styles.planCTABtn, styles.freeCTABtn]}>
              <Text style={styles.freeCTAText}>{status?.isPremium ? t('free') : t('currentlyUsing')}</Text>
            </View>
          </View>

          {/* Premium card */}
          <View style={[styles.planCard, styles.premiumPlanCard]}>
            <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.premiumCardHeader}>
              <MaterialCommunityIcons name="crown" size={28} color="#fff" />
              <Text style={styles.premiumPlanTitle}>{t('premium')}</Text>
              <Text style={styles.premiumPlanPrice}>199K</Text>
              <Text style={styles.premiumPlanPriceUnit}>{t('perMonth')}</Text>
            </LinearGradient>
            <View style={styles.planCardBody}>
              {premiumFeatures.map((f, i) => (
                <FeatureRow key={i} icon={f.icon} text={f.text} premium />
              ))}
            </View>
            {status?.isPremium && (
              <View style={[styles.planCTABtn, styles.premiumActiveBadge]}>
                <Ionicons name="checkmark-circle" size={16} color="#d97706" />
                <Text style={styles.premiumBadgeText}>{t('currentlyUsing')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Plan selector (non-premium only) ── */}
        {!status?.isPremium && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('planSelector')}</Text>
            <View style={styles.planGrid}>
              {PLANS.map((plan) => {
                const selected = plan.months === selectedPlan;
                return (
                  <Pressable
                    key={plan.months}
                    style={[styles.planOption, selected && styles.planOptionSelected]}
                    onPress={() => { setSelectedPlan(plan.months); setQr(null); setPollStatus('idle'); clearTimers(); }}
                  >
                    {plan.discount > 0 && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>-{plan.discount}%</Text>
                      </View>
                    )}
                    <Text style={[styles.planOptionLabel, selected && styles.planOptionLabelSelected]}>
                      {plan.label}
                    </Text>
                    <Text style={[styles.planOptionPrice, selected && styles.planOptionPriceSelected]}>
                      {formatVND(plan.price)}đ
                    </Text>
                    <Text style={[styles.planOptionPerMonth, selected && styles.planOptionPerMonthSelected]}>
                      ~{formatVND(pricePerMonth(plan))}đ{t('perMonth')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Upgrade button */}
            <Pressable style={styles.premiumCTABtn} onPress={handleCreateQR} disabled={creatingQR || !!qr}>
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={styles.premiumCTAGradient}
              >
                {creatingQR
                  ? <ActivityIndicator color="#fff" size="small" />
                  : (
                    <View style={styles.ctaRow}>
                      <MaterialCommunityIcons name="crown" size={18} color="#fff" />
                      <Text style={styles.premiumCTAText}>
                        {t('upgradeNow')} · {formatVND(activePlan.price)}đ
                      </Text>
                    </View>
                  )}
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* ── QR Payment section ── */}
        {qr && !status?.isPremium && (
          <View style={styles.card}>
            {pollStatus === 'success' ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                <Text style={styles.successTitle}>{t('activationSuccess')}</Text>
                <Text style={styles.successDesc}>{t('activationSuccessDesc')}</Text>
              </View>
            ) : isQrExpired ? (
              <View style={styles.expiredBox}>
                <Ionicons name="time-outline" size={40} color={colors.danger} />
                <Text style={styles.expiredText}>{t('qrExpired')}</Text>
                <Pressable style={styles.retryBtn} onPress={handleCreateQR}>
                  <Text style={styles.retryBtnText}>{t('generateQR')}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.cardTitle}>{t('paymentQR')}</Text>
                <Image source={{ uri: qr.qr_url }} style={styles.qrImage} resizeMode="contain" />
                <View style={styles.countdownRow}>
                  <Ionicons name="time-outline" size={14} color={colors.warning} />
                  <Text style={styles.countdownText}>{t('countdown', { time: formatCountdown(countdown) })}</Text>
                </View>
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>{t('transferNote')}</Text>
                  <Text style={styles.noteValue}>{qr.description}</Text>
                </View>
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Số tiền ({PLANS.find(p => p.months === qr.plan_months)?.label}):</Text>
                  <Text style={[styles.noteValue, { color: '#d97706' }]}>{formatVND(qr.amount)}đ</Text>
                </View>
                <View style={styles.pollingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.pollingText}>{t('polling')}</Text>
                </View>
                <Pressable style={styles.cancelBtn} onPress={handleCancelQR}>
                  <Text style={styles.cancelBtnText}>{t('cancelQR')}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* ── History ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('historyTitle')}</Text>
          {loadingHistory ? <ActivityIndicator color={colors.primary} /> :
            history.length === 0
              ? <Text style={styles.emptyText}>{t('noHistory')}</Text>
              : history.map(sub => (
                <View key={sub.id} style={styles.historyRow}>
                  <View style={styles.historyLeft}>
                    <Ionicons
                      name={sub.status === 'completed' ? 'checkmark-circle' : sub.status === 'failed' ? 'close-circle' : 'time'}
                      size={20} color={statusColor(sub.status)}
                    />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyAmount}>{formatVND(sub.amount)}đ · {sub.plan_months} tháng</Text>
                      <Text style={styles.historyDate}>
                        {new Date(sub.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </Text>
                      {sub.subscription_end
                        ? <Text style={styles.historyValidity}>{t('validUntil', { date: formatDate(sub.subscription_end) })}</Text>
                        : null}
                    </View>
                  </View>
                  <View style={[styles.historyBadge, { backgroundColor: statusColor(sub.status) + '20' }]}>
                    <Text style={[styles.historyBadgeText, { color: statusColor(sub.status) }]}>{statusLabel(sub.status)}</Text>
                  </View>
                </View>
              ))
          }
        </View>
      </ScrollView>
    </Screen>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>, topInset: number) {
  return StyleSheet.create({
    scrollContent: { paddingBottom: 40, backgroundColor: colors.background },
    header: {
      paddingTop: topInset + spacing.md,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      gap: spacing.xs,
    },
    backBtn: { position: 'absolute', left: spacing.lg, top: topInset + spacing.md, padding: spacing.xs },
    headerTitle: { color: '#fff', fontSize: typography.size.lg, fontWeight: '800' },
    crownIcon: { marginTop: spacing.xs },
    card: {
      backgroundColor: colors.surface,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    cardTitle: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
    planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
    planBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.xl,
    },
    freeBadge: { backgroundColor: '#e5e7eb' },
    premiumBadge: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#f59e0b' },
    planBadgeText: { fontSize: typography.size.sm, fontWeight: '700' },
    freeBadgeText: { color: colors.textSecondary },
    premiumBadgeText: { color: '#d97706' },
    expiresText: { fontSize: typography.size.xs, color: colors.textSecondary },

    // Voice usage bar
    voiceBar: { marginTop: spacing.md },
    voiceBarHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
    voiceBarLabel: { fontSize: typography.size.xs, color: colors.textSecondary },
    voiceBarTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
    voiceBarFill: { height: '100%', backgroundColor: '#f59e0b', borderRadius: 3 },

    // Two-column layout
    plansRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
    },
    planCard: {
      flex: 1,
      borderRadius: radius.lg,
      overflow: 'hidden',
      shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 }, elevation: 3,
      backgroundColor: colors.surface,
    },
    freePlanCard: { borderWidth: 1.5, borderColor: colors.border },
    premiumPlanCard: { borderWidth: 1.5, borderColor: '#f59e0b' },
    planCardHeader: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface,
      gap: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    freePlanTitle: { fontSize: typography.size.md, fontWeight: '800', color: colors.textPrimary },
    freePlanPrice: { fontSize: typography.size.xl, fontWeight: '800', color: colors.textSecondary },
    planPriceUnit: { fontSize: typography.size.xs, color: colors.textSecondary },
    premiumCardHeader: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.sm,
      gap: 4,
    },
    premiumPlanTitle: { fontSize: typography.size.md, fontWeight: '800', color: '#fff' },
    premiumPlanPrice: { fontSize: typography.size.xl, fontWeight: '800', color: '#fff' },
    premiumPlanPriceUnit: { fontSize: typography.size.xs, color: 'rgba(255,255,255,0.85)' },
    planCardBody: { padding: spacing.md, gap: 2, flex: 1 },
    planCTABtn: {
      margin: spacing.md, marginTop: 0,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      alignItems: 'center',
    },
    freeCTABtn: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: 'transparent' },
    freeCTAText: { fontSize: typography.size.xs, fontWeight: '700', color: colors.textSecondary },
    premiumActiveBadge: {
      flexDirection: 'row', gap: 4, justifyContent: 'center',
      backgroundColor: '#fef3c7',
    },

    // Plan selector grid
    planGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    planOption: {
      width: '47%',
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.md,
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    planOptionSelected: {
      borderColor: '#f59e0b',
      backgroundColor: '#fffbeb',
    },
    discountBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: '#f59e0b',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderBottomLeftRadius: radius.sm,
    },
    discountText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    planOptionLabel: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    planOptionLabelSelected: { color: '#d97706' },
    planOptionPrice: { fontSize: typography.size.md, fontWeight: '800', color: colors.textPrimary },
    planOptionPriceSelected: { color: '#d97706' },
    planOptionPerMonth: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },
    planOptionPerMonthSelected: { color: '#a16207' },

    premiumCTABtn: { borderRadius: radius.lg, overflow: 'hidden' },
    premiumCTAGradient: { paddingVertical: spacing.md, alignItems: 'center' },
    ctaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    premiumCTAText: { fontSize: typography.size.sm, fontWeight: '800', color: '#fff' },

    // QR
    qrImage: { width: '100%', height: 220, marginBottom: spacing.md },
    countdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: spacing.md },
    countdownText: { color: colors.warning, fontSize: typography.size.xs, fontWeight: '600' },
    noteBox: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
    noteLabel: { fontSize: typography.size.xs, color: colors.textSecondary, marginBottom: 2 },
    noteValue: { fontSize: typography.size.sm, color: colors.textPrimary, fontWeight: '700' },
    pollingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
    pollingText: { color: colors.textSecondary, fontSize: typography.size.xs },
    cancelBtn: { alignItems: 'center', marginTop: spacing.md, padding: spacing.sm },
    cancelBtnText: { color: colors.danger, fontSize: typography.size.xs, fontWeight: '600' },
    expiredBox: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
    expiredText: { color: colors.danger, fontSize: typography.size.sm, fontWeight: '600' },
    retryBtn: { backgroundColor: '#f59e0b', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md },
    retryBtnText: { color: '#fff', fontSize: typography.size.xs, fontWeight: '700' },
    successBox: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
    successTitle: { color: colors.success, fontSize: typography.size.md, fontWeight: '700' },
    successDesc: { color: colors.textSecondary, fontSize: typography.size.sm, textAlign: 'center' },

    // History
    emptyText: { color: colors.textSecondary, fontSize: typography.size.xs, textAlign: 'center', paddingVertical: spacing.lg },
    historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    historyLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    historyInfo: { flex: 1 },
    historyAmount: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary },
    historyDate: { fontSize: typography.size.xs, color: colors.textSecondary },
    historyValidity: { fontSize: typography.size.xs, color: '#d97706', fontWeight: '600' },
    historyBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
    historyBadgeText: { fontSize: typography.size.xs, fontWeight: '600' },
  });
}
