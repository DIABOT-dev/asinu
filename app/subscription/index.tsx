import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { useFontSizeStore } from '../../src/stores/font-size.store';
import { apiClient, ApiError } from '../../src/lib/apiClient';
import { colors, radius, spacing, typography } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

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
  { months: 1,  price: 199000,   discount: 0  },
  { months: 3,  price: 567000,   discount: 5  },
  { months: 6,  price: 1075000,  discount: 10 },
  { months: 12, price: 1910000,  discount: 20 },
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
  premiumText: { color: colors.premiumDark, fontWeight: '600' },
  dimText: { opacity: 0.5 },
});

// ── Animated Plan Option ──────────────────────────────────────────────
function PlanOption({
  plan, selected, onSelect, isXLarge,
}: { plan: typeof PLANS[0]; selected: boolean; onSelect: () => void; isXLarge?: boolean }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(withSpring(0.93), withSpring(1, { damping: 10 }));
    onSelect();
  };

  return (
    <Animated.View style={[animStyle, { width: isXLarge ? '100%' : '47%' }]}>
      <Pressable
        style={[planOptionStyle.option, selected && planOptionStyle.selected]}
        onPress={handlePress}
      >
        {plan.discount > 0 && (
          <View style={planOptionStyle.discountBadge}>
            <Text style={planOptionStyle.discountText}>-{plan.discount}%</Text>
          </View>
        )}
        <Text style={[planOptionStyle.label, selected && planOptionStyle.labelSelected]}>
          {plan.months === 1 ? '1 tháng' : plan.months === 3 ? '3 tháng' : plan.months === 6 ? '6 tháng' : '12 tháng'}
        </Text>
        <Text style={[planOptionStyle.price, selected && planOptionStyle.priceSelected]}>
          {formatVND(plan.price)}đ
        </Text>
        <Text style={[planOptionStyle.perMonth, selected && planOptionStyle.perMonthSelected]}>
          ~{formatVND(pricePerMonth(plan))}đ/tháng
        </Text>
      </Pressable>
    </Animated.View>
  );
}
const planOptionStyle = StyleSheet.create({
  option: {
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surfaceMuted, padding: spacing.md, alignItems: 'center',
    position: 'relative', overflow: 'hidden',
  },
  selected: { borderColor: colors.premium, backgroundColor: colors.premiumLight },
  discountBadge: {
    position: 'absolute', top: 0, right: 0, backgroundColor: colors.premium,
    paddingHorizontal: 6, paddingVertical: 2, borderBottomLeftRadius: radius.sm,
  },
  discountText: { fontSize: typography.size.xxs, fontWeight: '800', color: '#fff' },
  label: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  labelSelected: { color: colors.premiumDark },
  price: { fontSize: typography.size.md, fontWeight: '800', color: colors.textPrimary },
  priceSelected: { color: colors.premiumDark },
  perMonth: { fontSize: typography.size.xxs, color: colors.textSecondary, marginTop: 2 },
  perMonthSelected: { color: '#a16207' },
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
  const { isDark } = useThemeColors();
  const fontScale = useFontSizeStore((s) => s.scale);
  const isXLarge = fontScale === 'xlarge';
  const styles = useMemo(() => createStyles(scaledTypography, insets.top), [scaledTypography, insets.top, isDark]);

  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(1);
  const [qr, setQr] = useState<QRData | null>(null);
  const [creatingQR, setCreatingQR] = useState(false);
  const [history, setHistory] = useState<SubRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [pollStatus, setPollStatus] = useState<'idle' | 'polling' | 'success'>('idle');
  const [showPayMethodModal, setShowPayMethodModal] = useState(false);
  const [showWalletConfirm, setShowWalletConfirm] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string>('0');
  const [walletPayResult, setWalletPayResult] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [walletPayError, setWalletPayError] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  // ── Crown bounce animation ──
  const crownY = useSharedValue(0);
  const crownScale = useSharedValue(1);
  useEffect(() => {
    crownY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 600 }),
        withTiming(0, { duration: 600 }),
      ),
      -1, true
    );
    crownScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 600 }),
        withTiming(1, { duration: 600 }),
      ),
      -1, true
    );
  }, []);
  const crownAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: crownY.value }, { scale: crownScale.value }],
  }));

  // ── CTA pulse animation ──
  const ctaGlow = useSharedValue(1);
  useEffect(() => {
    ctaGlow.value = withDelay(800, withRepeat(
      withSequence(
        withTiming(1.03, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1, true
    ));
  }, []);
  const ctaAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaGlow.value }],
  }));

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

  const handleOpenPayMethod = useCallback(async () => {
    setShowPayMethodModal(true);
    try {
      const res = await apiClient<{ ok: boolean; balance: string }>('/api/payments/balance');
      if (res.ok) setWalletBalance(res.balance);
    } catch {}
  }, []);

  const handleWalletPay = useCallback(async () => {
    setWalletPayResult('loading');
    setWalletPayError('');
    try {
      const res = await apiClient<{ ok: boolean; message?: string }>('/api/subscriptions/wallet', {
        method: 'POST',
        body: { months: selectedPlan },
      });
      if (res.ok) {
        setWalletPayResult('success');
        fetchStatus();
        fetchHistory();
      } else {
        setWalletPayResult('failed');
        setWalletPayError(res.message ?? 'Thanh toán thất bại. Vui lòng thử lại.');
      }
    } catch (err) {
      setWalletPayResult('failed');
      if (err instanceof ApiError) {
        setWalletPayError(err.message || 'Thanh toán thất bại. Vui lòng thử lại.');
      } else {
        setWalletPayError('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.');
      }
    }
  }, [selectedPlan, fetchStatus, fetchHistory]);
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
    { icon: <Ionicons name="checkmark-circle" size={16} color={colors.premiumDark} />, text: t('features.history365d') },
    { icon: <Ionicons name="checkmark-circle" size={16} color={colors.premiumDark} />, text: t('features.connections50') },
    { icon: <Ionicons name="checkmark-circle" size={16} color={colors.premiumDark} />, text: t('features.voice5k') },
  ];

  const activePlan = PLANS.find(p => p.months === selectedPlan) ?? PLANS[0];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <LinearGradient
            colors={[colors.premium, colors.premiumDark]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.headerTitle}>{t('title')}</Text>
            <Animated.View style={crownAnimStyle}>
              <MaterialCommunityIcons name="crown" size={44} color="#fff" style={styles.crownIcon} />
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* ── Current plan ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('currentPlan')}</Text>
          {loadingStatus ? <ActivityIndicator color={colors.primary} /> : (
            <View style={styles.planRow}>
              <View style={[styles.planBadge, status?.isPremium ? styles.premiumBadge : styles.freeBadge]}>
                {status?.isPremium
                  ? <MaterialCommunityIcons name="crown" size={14} color={colors.premiumDark} />
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
          {status?.isPremium && (
            <View style={styles.voiceBar}>
              <View style={styles.voiceBarHeader}>
                <MaterialCommunityIcons name="microphone" size={13} color={colors.premiumDark} />
                <Text style={styles.voiceBarLabel}>
                  {t('voiceUsage', { used: status.voiceUsedThisMonth, limit: status.voiceMonthlyLimit })}
                </Text>
              </View>
              <View style={styles.voiceBarTrack}>
                <Animated.View
                  entering={FadeInUp.delay(400).duration(600)}
                  style={[styles.voiceBarFill, { width: `${Math.min(100, (status.voiceUsedThisMonth / status.voiceMonthlyLimit) * 100)}%` as any }]}
                />
              </View>
            </View>
          )}
        </View>

        {/* ── Two-column feature comparison ── */}
        <View style={isXLarge ? styles.plansColumn : styles.plansRow}>
          <View style={!isXLarge ? { flex: 1 } : undefined}>
            <View style={[styles.planCard, styles.freePlanCard, !isXLarge && { flex: 1 }]}>
              <View style={styles.planCardHeader}>
                <Ionicons name="person-circle-outline" size={28} color={colors.textSecondary} />
                <Text style={styles.freePlanTitle}>{t('free')}</Text>
                <Text style={styles.freePlanPrice}>0đ</Text>
                <Text style={styles.planPriceUnit}>{t('perMonth')}</Text>
              </View>
              <View style={[styles.planCardBody, !isXLarge && { flex: 1 }]}>
                {freeFeatures.map((f, i) => (
                  <FeatureRow key={i} icon={f.icon} text={f.text} dim={f.dim} />
                ))}
              </View>
              <View style={[styles.planCTABtn, styles.freeCTABtn]}>
                <Text style={styles.freeCTAText}>{status?.isPremium ? t('free') : t('currentlyUsing')}</Text>
              </View>
            </View>
          </View>

          <View style={!isXLarge ? { flex: 1 } : undefined}>
            <View style={[styles.planCard, styles.premiumPlanCard, !isXLarge && { flex: 1 }]}>
              <LinearGradient colors={[colors.premium, colors.premiumDark]} style={styles.premiumCardHeader}>
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
                  <Ionicons name="checkmark-circle" size={16} color={colors.premiumDark} />
                  <Text style={styles.premiumBadgeText}>{t('currentlyUsing')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Plan selector ── */}
        {!status?.isPremium && (
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.card}>
            <Text style={styles.cardTitle}>{t('planSelector')}</Text>
            <View style={isXLarge ? styles.planGridColumn : styles.planGrid}>
              {PLANS.map((plan) => (
                <PlanOption
                  key={plan.months}
                  plan={plan}
                  selected={plan.months === selectedPlan}
                  onSelect={() => { setSelectedPlan(plan.months); setQr(null); setPollStatus('idle'); clearTimers(); }}
                  isXLarge={isXLarge}
                />
              ))}
            </View>

            {/* CTA button with pulse */}
            <Animated.View style={ctaAnimStyle}>
              <Pressable style={styles.premiumCTABtn} onPress={handleOpenPayMethod} disabled={creatingQR || !!qr || walletPayResult === 'success'}>
                <LinearGradient
                  colors={[colors.premium, colors.premiumDark]}
                  start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
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
            </Animated.View>
          </Animated.View>
        )}

        {/* ── QR Payment section ── */}
        {qr && !status?.isPremium && (
          <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.card}>
            {pollStatus === 'success' ? (
              <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                <Text style={styles.successTitle}>{t('activationSuccess')}</Text>
                <Text style={styles.successDesc}>{t('activationSuccessDesc')}</Text>
              </Animated.View>
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
                <Animated.View entering={ZoomIn.delay(100).duration(400)}>
                  <Image source={{ uri: qr.qr_url }} style={styles.qrImage} resizeMode="contain" />
                </Animated.View>
                <View style={styles.countdownRow}>
                  <Ionicons name="time-outline" size={14} color={colors.warning} />
                  <Text style={styles.countdownText}>{t('countdown', { time: formatCountdown(countdown) })}</Text>
                </View>
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>{t('transferNote')}</Text>
                  <Text style={styles.noteValue}>{qr.description}</Text>
                </View>
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>{t('amountLabel', { plan: t('planMonth', { months: qr.plan_months }) })}</Text>
                  <Text style={[styles.noteValue, { color: colors.premiumDark }]}>{formatVND(qr.amount)}đ</Text>
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
          </Animated.View>
        )}

        {/* ── Wallet Pay Success ── */}
        {walletPayResult === 'success' && (
          <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.card, styles.successBox]}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text style={styles.successTitle}>{t('activationSuccess')}</Text>
            <Text style={styles.successDesc}>{t('activationSuccessDesc')}</Text>
          </Animated.View>
        )}

        {/* ── History ── */}
        <Animated.View entering={FadeInDown.delay(500).duration(400).springify()} style={styles.card}>
          <Text style={styles.cardTitle}>{t('historyTitle')}</Text>
          {loadingHistory ? <ActivityIndicator color={colors.primary} /> :
            history.length === 0
              ? <Text style={styles.emptyText}>{t('noHistory')}</Text>
              : history.map((sub, i) => (
                <Animated.View
                  key={sub.id}
                  entering={FadeInDown.delay(i * 60).duration(300)}
                  style={styles.historyRow}
                >
                  <View style={styles.historyLeft}>
                    <Ionicons
                      name={sub.status === 'completed' ? 'checkmark-circle' : sub.status === 'failed' ? 'close-circle' : 'time'}
                      size={20} color={statusColor(sub.status)}
                    />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyAmount}>{formatVND(sub.amount)}đ · {t('planMonth', { months: sub.plan_months })}</Text>
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
                </Animated.View>
              ))
          }
        </Animated.View>

      </ScrollView>

      {/* ── Modal chọn phương thức thanh toán ── */}
      <Modal visible={showPayMethodModal} transparent animationType="fade" onRequestClose={() => setShowPayMethodModal(false)}>
        <Pressable style={styles.payModalOverlay} onPress={() => setShowPayMethodModal(false)}>
          <Pressable style={styles.payModalBox} onPress={() => {}}>
            <Text style={styles.payModalTitle}>Chọn phương thức</Text>

            <Pressable
              style={styles.payMethodBtn}
              onPress={() => { setShowPayMethodModal(false); setShowWalletConfirm(true); }}
            >
              <View style={styles.payMethodIcon}>
                <MaterialCommunityIcons name="wallet" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payMethodLabel}>Trừ số dư ví</Text>
                <Text style={styles.payMethodSub}>Số dư: {formatVND(walletBalance)}đ</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            <Pressable
              style={styles.payMethodBtn}
              onPress={() => { setShowPayMethodModal(false); handleCreateQR(); }}
            >
              <View style={styles.payMethodIcon}>
                <MaterialCommunityIcons name="qrcode-scan" size={24} color={colors.premium} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payMethodLabel}>Quét mã QR</Text>
                <Text style={styles.payMethodSub}>Chuyển khoản ngân hàng</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            <Pressable style={styles.payCancelBtn} onPress={() => setShowPayMethodModal(false)}>
              <Text style={styles.payCancelText}>Huỷ</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal xác nhận thanh toán bằng ví ── */}
      <Modal
        visible={showWalletConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (walletPayResult !== 'loading') {
            setShowWalletConfirm(false);
            setWalletPayResult('idle');
            setWalletPayError('');
          }
        }}
      >
        <Pressable
          style={styles.payModalOverlay}
          onPress={() => {
            if (walletPayResult !== 'loading') {
              setShowWalletConfirm(false);
              setWalletPayResult('idle');
              setWalletPayError('');
            }
          }}
        >
          <Pressable style={styles.payModalBox} onPress={() => {}}>
            {walletPayResult === 'success' ? (
              /* ── Thành công ── */
              <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.walletResultBox}>
                <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                <Text style={styles.walletResultTitle}>Đăng ký thành công!</Text>
                <Text style={styles.walletResultDesc}>Gói {activePlan.months} tháng đã được kích hoạt.</Text>
                <Pressable
                  style={styles.confirmOkBtn}
                  onPress={() => { setShowWalletConfirm(false); setWalletPayResult('idle'); }}
                >
                  <Text style={styles.confirmOkText}>Đóng</Text>
                </Pressable>
              </Animated.View>
            ) : (
              /* ── Form xác nhận ── */
              <>
                <MaterialCommunityIcons name="wallet-outline" size={36} color={colors.primary} style={{ alignSelf: 'center', marginBottom: spacing.sm }} />
                <Text style={styles.payModalTitle}>Xác nhận đăng ký</Text>
                <Text style={styles.confirmDesc}>
                  Bạn có chắc chắn muốn đăng ký{'\n'}
                  <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                    gói {activePlan.months} tháng · {formatVND(activePlan.price)}đ
                  </Text>
                  {'\n'}bằng số dư ví không?
                </Text>
                <View style={styles.confirmBalanceRow}>
                  <Text style={styles.confirmBalanceLabel}>Số dư hiện tại</Text>
                  <Text style={styles.confirmBalanceValue}>{formatVND(walletBalance)}đ</Text>
                </View>
                {walletPayResult === 'failed' && (
                  <Animated.View entering={FadeInDown.duration(300)} style={styles.walletErrorBox}>
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.walletErrorText}>{walletPayError}</Text>
                  </Animated.View>
                )}
                <View style={styles.confirmActions}>
                  <Pressable
                    style={styles.confirmCancelBtn}
                    onPress={() => {
                      setShowWalletConfirm(false);
                      setWalletPayResult('idle');
                      setWalletPayError('');
                      setShowPayMethodModal(true);
                    }}
                    disabled={walletPayResult === 'loading'}
                  >
                    <Text style={styles.confirmCancelText}>Quay lại</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.confirmOkBtn, walletPayResult === 'failed' && styles.confirmRetryBtn]}
                    onPress={handleWalletPay}
                    disabled={walletPayResult === 'loading'}
                  >
                    {walletPayResult === 'loading'
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.confirmOkText}>
                          {walletPayResult === 'failed' ? 'Thử lại' : 'Xác nhận'}
                        </Text>
                    }
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

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
    freeBadge: { backgroundColor: colors.border },
    premiumBadge: { backgroundColor: colors.premiumLight, borderWidth: 1.5, borderColor: colors.premium },
    planBadgeText: { fontSize: typography.size.sm, fontWeight: '700' },
    freeBadgeText: { color: colors.textSecondary },
    premiumBadgeText: { color: colors.premiumDark },
    expiresText: { fontSize: typography.size.xs, color: colors.textSecondary },

    voiceBar: { marginTop: spacing.md },
    voiceBarHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
    voiceBarLabel: { fontSize: typography.size.xs, color: colors.textSecondary },
    voiceBarTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
    voiceBarFill: { height: '100%', backgroundColor: colors.premium, borderRadius: 3 },

    plansRow: {
      flexDirection: 'row', gap: spacing.md,
      marginHorizontal: spacing.lg, marginTop: spacing.lg,
      alignItems: 'stretch',
    },
    plansColumn: {
      gap: spacing.md,
      marginHorizontal: spacing.lg, marginTop: spacing.lg,
    },
    planCard: {
      borderRadius: radius.lg, overflow: 'hidden',
      shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 }, elevation: 3,
      backgroundColor: colors.surface,
    },
    freePlanCard: { borderWidth: 1.5, borderColor: colors.border },
    premiumPlanCard: { borderWidth: 1.5, borderColor: colors.premium },
    planCardHeader: {
      alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface, gap: 4,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    freePlanTitle: { fontSize: typography.size.md, fontWeight: '800', color: colors.textPrimary },
    freePlanPrice: { fontSize: typography.size.xl, fontWeight: '800', color: colors.textSecondary },
    planPriceUnit: { fontSize: typography.size.xs, color: colors.textSecondary },
    premiumCardHeader: {
      alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.sm, gap: 4,
    },
    premiumPlanTitle: { fontSize: typography.size.md, fontWeight: '800', color: '#fff' },
    premiumPlanPrice: { fontSize: typography.size.xl, fontWeight: '800', color: '#fff' },
    premiumPlanPriceUnit: { fontSize: typography.size.xs, color: 'rgba(255,255,255,0.85)' },
    planCardBody: { padding: spacing.md, gap: 2 },
    planCTABtn: {
      margin: spacing.md, marginTop: 0, paddingVertical: spacing.sm,
      borderRadius: radius.lg, alignItems: 'center',
    },
    freeCTABtn: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: 'transparent' },
    freeCTAText: { fontSize: typography.size.xs, fontWeight: '700', color: colors.textSecondary },
    premiumActiveBadge: {
      flexDirection: 'row', gap: 4, justifyContent: 'center',
      backgroundColor: colors.premiumLight,
    },

    planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    planGridColumn: { gap: spacing.sm, marginBottom: spacing.lg },

    premiumCTABtn: { borderRadius: radius.lg, overflow: 'hidden' },
    premiumCTAGradient: { paddingVertical: spacing.md, alignItems: 'center' },
    ctaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    premiumCTAText: { fontSize: typography.size.sm, fontWeight: '800', color: '#fff' },

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
    retryBtn: { backgroundColor: colors.premium, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md },
    retryBtnText: { color: '#fff', fontSize: typography.size.xs, fontWeight: '700' },
    successBox: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
    successTitle: { color: colors.success, fontSize: typography.size.md, fontWeight: '700' },
    successDesc: { color: colors.textSecondary, fontSize: typography.size.sm, textAlign: 'center' },

    emptyText: { color: colors.textSecondary, fontSize: typography.size.xs, textAlign: 'center', paddingVertical: spacing.lg },
    historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    historyLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    historyInfo: { flex: 1 },
    historyAmount: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary },
    historyDate: { fontSize: typography.size.xs, color: colors.textSecondary },
    historyValidity: { fontSize: typography.size.xs, color: colors.premiumDark, fontWeight: '600' },
    historyBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
    historyBadgeText: { fontSize: typography.size.xs, fontWeight: '600' },

    // Payment method modal
    payModalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    payModalBox: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    payModalTitle: {
      fontSize: typography.size.md, fontWeight: '700',
      color: colors.textPrimary, textAlign: 'center',
      marginBottom: spacing.sm,
    },
    payMethodBtn: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      padding: spacing.lg, borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1.5, borderColor: colors.border,
    },
    payMethodIcon: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    payMethodLabel: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary },
    payMethodSub: { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
    payCancelBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
    payCancelText: { fontSize: typography.size.sm, color: colors.textSecondary, fontWeight: '600' },

    // Wallet confirm modal
    confirmDesc: {
      fontSize: typography.size.sm, color: colors.textSecondary,
      textAlign: 'center', lineHeight: 22,
    },
    confirmBalanceRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: colors.surfaceMuted, borderRadius: 12,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      marginTop: spacing.xs,
    },
    confirmBalanceLabel: { fontSize: typography.size.sm, color: colors.textSecondary },
    confirmBalanceValue: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary },
    confirmActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    confirmCancelBtn: {
      flex: 1, paddingVertical: spacing.md, borderRadius: 12,
      borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
    },
    confirmCancelText: { fontSize: typography.size.sm, fontWeight: '600', color: colors.textSecondary },
    confirmOkBtn: {
      flex: 1, paddingVertical: spacing.md, borderRadius: 12,
      backgroundColor: colors.primary, alignItems: 'center',
    },
    confirmRetryBtn: { backgroundColor: colors.warning },
    confirmOkText: { fontSize: typography.size.sm, fontWeight: '700', color: '#fff' },

    walletResultBox: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
    walletResultTitle: { fontSize: typography.size.md, fontWeight: '700', color: colors.success },
    walletResultDesc: { fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center' },

    walletErrorBox: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      backgroundColor: colors.danger + '15', borderRadius: 10,
      padding: spacing.md, marginTop: spacing.xs,
    },
    walletErrorText: { flex: 1, fontSize: typography.size.xs, color: colors.danger, fontWeight: '500' },
  });
}
