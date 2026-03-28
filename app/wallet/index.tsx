import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { RippleRefreshScrollView } from '../../src/components/RippleRefresh';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOut,
  SlideInRight,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { apiClient } from '../../src/lib/apiClient';
import { colors, iconColors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

// ---- types ----
type QRData = { order_code: string; qr_url: string; amount: number; description: string; expires_at: string };
type Payment = { id: number; order_code: string; amount: string; status: 'pending' | 'completed' | 'failed'; created_at: string; completed_at: string | null };
type BalanceRes = { ok: boolean; balance: string };
type QRRes = { ok: boolean; order_code: string; qr_url: string; amount: number; description: string; expires_at: string };
type HistoryRes = { ok: boolean; payments: Payment[]; total: number };

const QUICK_AMOUNTS: { value: number; labelKey: string; icon: string; iconColor: string }[] = [
  { value: 50000,  labelKey: 'quick50',  icon: 'cash-fast',     iconColor: '#6BAF9C' },
  { value: 100000, labelKey: 'quick100', icon: 'cash',          iconColor: '#5b9bd5' },
  { value: 200000, labelKey: 'quick200', icon: 'cash-multiple', iconColor: '#8b7fd4' },
  { value: 500000, labelKey: 'quick500', icon: 'diamond-stone', iconColor: '#c4845a' },
];

function formatVND(val: number | string): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '0';
  return n.toLocaleString('vi-VN');
}
function formatStatus(status: Payment['status'], t: (k: string) => string): string {
  if (status === 'completed') return t('completed');
  if (status === 'failed') return t('failed');
  return t('pending');
}
function statusColor(status: Payment['status']): string {
  if (status === 'completed') return colors.success;
  if (status === 'failed') return colors.danger;
  return colors.warning;
}
function statusIcon(status: Payment['status']): string {
  if (status === 'completed') return 'checkmark-circle';
  if (status === 'failed') return 'close-circle';
  return 'time';
}

// ── Ripple Loader component ─────────────────────────────
function RippleLoader({ size = 60, color = '#fff' }: { size?: number; color?: string }) {
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);
  const opacity1 = useSharedValue(1);
  const opacity2 = useSharedValue(1);
  const opacity3 = useSharedValue(1);

  useEffect(() => {
    const duration = 1800;
    const animate = (sv: typeof ring1, opSv: typeof opacity1, delay: number) => {
      sv.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.ease) }), -1));
      opSv.value = withDelay(delay, withRepeat(withTiming(0, { duration, easing: Easing.out(Easing.ease) }), -1));
    };
    animate(ring1, opacity1, 0);
    animate(ring2, opacity2, 400);
    animate(ring3, opacity3, 800);
  }, []);

  const s1 = useAnimatedStyle(() => ({ transform: [{ scale: 0.3 + ring1.value * 0.7 }], opacity: opacity1.value * 0.6 }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ scale: 0.3 + ring2.value * 0.7 }], opacity: opacity2.value * 0.6 }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ scale: 0.3 + ring3.value * 0.7 }], opacity: opacity3.value * 0.6 }));

  const ringBase = { position: 'absolute' as const, width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[ringBase, s1]} />
      <Animated.View style={[ringBase, s2]} />
      <Animated.View style={[ringBase, s3]} />
      <View style={{ width: size * 0.35, height: size * 0.35, borderRadius: size * 0.175, backgroundColor: color }} />
    </View>
  );
}

// ── Shimmer skeleton ────────────────────────────────────
function Shimmer({ width, height, borderRadius = 8 }: { width: number | string; height: number; borderRadius?: number }) {
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: 0.3 + shimmer.value * 0.4 }));
  return <Animated.View style={[{ width: width as any, height, borderRadius, backgroundColor: 'rgba(255,255,255,0.3)' }, style]} />;
}

// ── Floating wallet icon ────────────────────────────────
function FloatingIcon() {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(
      withTiming(-6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      withTiming(6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
    ), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={style}>
      <MaterialCommunityIcons name="wallet-outline" size={28} color="#fff" />
    </Animated.View>
  );
}

export default function WalletScreen() {
  const { t } = useTranslation('wallet');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography, insets.top), [scaledTypography, insets.top, isDark]);

  const mountedRef = useRef(true);
  const [balance, setBalance] = useState<string>('0');
  const [amount, setAmount] = useState('');
  const [qr, setQr] = useState<QRData | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [creatingQR, setCreatingQR] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [pollStatus, setPollStatus] = useState<'idle' | 'polling' | 'success'>('idle');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await apiClient<BalanceRes>('/api/payments/balance');
      if (res.ok) setBalance(res.balance);
    } catch {} finally { setLoadingBalance(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient<HistoryRes>('/api/payments/history?limit=10');
      if (res.ok) setPayments(res.payments);
    } catch {} finally { setLoadingHistory(false); }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBalance(), fetchHistory()]);
    setRefreshing(false);
  }, [fetchBalance, fetchHistory]);

  useEffect(() => {
    fetchBalance();
    fetchHistory();
    return () => { clearTimers(); mountedRef.current = false; };
  }, []);

  const startCountdown = useCallback((expiresAt: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0 && timerRef.current) clearInterval(timerRef.current);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, []);

  const startPolling = useCallback((orderCode: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPollStatus('polling');
    pollRef.current = setInterval(async () => {
      if (!mountedRef.current) { if (pollRef.current) clearInterval(pollRef.current); return; }
      try {
        const res = await apiClient<HistoryRes>('/api/payments/history?limit=10');
        if (!mountedRef.current) return;
        if (res.ok) {
          setPayments(res.payments);
          const found = res.payments.find((p) => p.order_code === orderCode);
          if (found?.status === 'completed') {
            setPollStatus('success');
            if (pollRef.current) clearInterval(pollRef.current);
            fetchBalance();
          }
        }
      } catch {}
    }, 5000);
  }, [fetchBalance]);

  const handleGenerateQR = useCallback(async () => {
    const num = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!num || num < 1000) { setError(t('amountMin')); return; }
    setError('');
    setCreatingQR(true);
    clearTimers();
    setQr(null);
    setPollStatus('idle');
    try {
      const res = await apiClient<QRRes>('/api/payments/qr', { method: 'POST', body: { amount: num } });
      if (res.ok) {
        setQr({ order_code: res.order_code, qr_url: res.qr_url, amount: res.amount, description: res.description, expires_at: res.expires_at });
        startCountdown(res.expires_at);
        startPolling(res.order_code);
      }
    } catch { setError(t('createQRError')); } finally { setCreatingQR(false); }
  }, [amount, t, clearTimers, startCountdown, startPolling]);

  const isExpired = qr ? countdown <= 0 : false;
  const minuteStr = Math.floor(countdown / 60).toString().padStart(2, '0');
  const secondStr = (countdown % 60).toString().padStart(2, '0');

  return (
    <Screen>
      <RippleRefreshScrollView
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ══ Header ══ */}
        <Animated.View entering={FadeIn.duration(500)}>
          <LinearGradient
            colors={['#3d8b84', '#2a7870', '#1e6b63']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />

            <View style={styles.headerRow}>
              <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} hitSlop={12} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </Pressable>
              <ScaledText style={styles.headerTitle}>{t('title')}</ScaledText>
              <Pressable onPress={onRefresh} hitSlop={12} style={styles.backBtn}>
                <Ionicons name="refresh" size={20} color="#fff" />
              </Pressable>
            </View>

            {/* Balance card inside header */}
            <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.balanceCard}>
              <View style={styles.balanceCardLeft}>
                <FloatingIcon />
                <View>
                  <ScaledText style={styles.balanceLabel}>{t('balance')}</ScaledText>
                  {loadingBalance ? (
                    <View style={{ marginTop: 8 }}>
                      <RippleLoader size={32} color="rgba(255,255,255,0.8)" />
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 2 }}>
                      <ScaledText style={styles.balanceValue}>{formatVND(balance)}</ScaledText>
                      <ScaledText style={styles.balanceUnit}>{t('balanceUnit')}</ScaledText>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.balanceShine} />
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* ══ Top-up section ══ */}
        <Animated.View entering={FadeInDown.delay(200).duration(450).springify()}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="wallet-plus-outline" size={18} color={iconColors.primary} />
              <ScaledText style={styles.sectionTitle}>{t('topUp')}</ScaledText>
            </View>

            {/* Amount selection */}
            <View style={styles.quickGrid}>
              {QUICK_AMOUNTS.map((q, idx) => {
                const active = amount === String(q.value);
                return (
                  <Animated.View key={q.value} entering={FadeInDown.delay(280 + idx * 55).duration(380).springify()}>
                    <Pressable
                      style={({ pressed }) => [styles.quickCard, active && styles.quickCardActive, pressed && { opacity: 0.85 }]}
                      onPress={() => setAmount(String(q.value))}
                    >
                      <MaterialCommunityIcons name={q.icon as any} size={20} color={q.iconColor} />
                      <View style={styles.quickCardBody}>
                        <ScaledText style={[styles.quickCardAmount, active && styles.quickCardAmountActive]}>
                          {formatVND(q.value)} đ
                        </ScaledText>
                        <ScaledText style={styles.quickCardLabel}>{t(q.labelKey)}</ScaledText>
                      </View>
                      <View style={[styles.quickCardCheck, active && styles.quickCardCheckActive]}>
                        {active
                          ? <Ionicons name="checkmark" size={14} color="#fff" />
                          : <View style={styles.quickCardCheckEmpty} />
                        }
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <ScaledText style={styles.dividerText}>hoặc nhập số tiền</ScaledText>
              <View style={styles.dividerLine} />
            </View>

            {/* Custom amount input */}
            <Animated.View entering={FadeInLeft.delay(580).duration(380)}>
              <View style={styles.inputWrap}>
                <View style={styles.inputCurrencyBadge}>
                  <ScaledText style={styles.inputCurrencyText}>₫</ScaledText>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={t('enterAmount')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={amount ? formatVND(parseInt(amount)) : ''}
                  onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, '').replace(/\./g, ''))}
                />
                {amount.length > 0 && (
                  <Pressable onPress={() => setAmount('')} style={{ marginRight: spacing.md }}>
                    <Ionicons name="close-circle" size={20} color={colors.border} />
                  </Pressable>
                )}
              </View>
            </Animated.View>

            {!!error && (
              <Animated.View entering={FadeIn.duration(250)}>
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={15} color={iconColors.danger} />
                  <ScaledText style={styles.errorText}>{error}</ScaledText>
                </View>
              </Animated.View>
            )}

            {/* Generate QR button */}
            <Animated.View entering={FadeInDown.delay(650).duration(400).springify()}>
              <Pressable
                style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
                onPress={handleGenerateQR}
                disabled={creatingQR}
              >
                <LinearGradient colors={['#3d8b84', '#2a7870']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.generateBtnInner}>
                  {creatingQR ? (
                    <RippleLoader size={28} color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="qr-code-outline" size={22} color="#fff" />
                      <ScaledText style={styles.generateBtnText}>{t('generateQR')}</ScaledText>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>

        {/* ══ QR display ══ */}
        {qr && (
          <Animated.View entering={FadeInDown.delay(100).duration(450).springify()}>
            <View style={styles.section}>
              {pollStatus === 'success' ? (
                <Animated.View entering={ZoomIn.duration(500).springify()} style={styles.successBox}>
                  <Ionicons name="checkmark-circle" size={72} color={iconColors.emerald} />
                  <ScaledText style={styles.successTitle}>{t('paymentSuccess')}</ScaledText>
                  <ScaledText style={styles.successSub}>+{formatVND(qr.amount)} đ</ScaledText>
                </Animated.View>
              ) : (
                <>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="scan-outline" size={18} color={iconColors.warning} />
                    <ScaledText style={styles.sectionTitle}>{t('scanQR')}</ScaledText>
                  </View>

                  {isExpired ? (
                    <Animated.View entering={FadeIn.duration(350)} style={styles.expiredBox}>
                      <Ionicons name="time-outline" size={40} color={iconColors.danger} />
                      <ScaledText style={styles.expiredText}>{t('expired')}</ScaledText>
                      <Pressable style={styles.refreshBtn} onPress={handleGenerateQR}>
                        <Ionicons name="refresh" size={16} color="#fff" />
                        <ScaledText style={styles.refreshBtnText}>{t('refreshQR')}</ScaledText>
                      </Pressable>
                    </Animated.View>
                  ) : (
                    <>
                      {/* QR code */}
                      <Animated.View entering={ZoomIn.delay(150).duration(450).springify()} style={styles.qrWrapper}>
                        <View style={styles.qrContainer}>
                          <Image source={{ uri: qr.qr_url }} style={styles.qrImage} resizeMode="contain" />
                        </View>
                        <View style={styles.qrAmountBadge}>
                          <ScaledText style={styles.qrAmountText}>{formatVND(qr.amount)} đ</ScaledText>
                        </View>
                      </Animated.View>

                      {/* Countdown */}
                      <Animated.View entering={FadeIn.delay(300).duration(350)} style={styles.countdownRow}>
                        <Ionicons name="time-outline" size={15} color={countdown < 60 ? colors.danger : colors.warning} />
                        <ScaledText style={[styles.countdownText, countdown < 60 && { color: colors.danger }]}>
                          {t('expiresIn', { minutes: minuteStr, seconds: secondStr })}
                        </ScaledText>
                      </Animated.View>

                      {/* Transfer note */}
                      <Animated.View entering={FadeInUp.delay(400).duration(350)}>
                        <View style={styles.noteBox}>
                          <ScaledText style={styles.noteLabel}>{t('transferNote')}</ScaledText>
                          <View style={styles.noteValueRow}>
                            <ScaledText style={styles.noteValue}>{qr.description}</ScaledText>
                            <Pressable hitSlop={8}>
                              <Ionicons name="copy-outline" size={17} color={iconColors.primary} />
                            </Pressable>
                          </View>
                        </View>
                      </Animated.View>

                      {/* Polling indicator */}
                      <Animated.View entering={FadeIn.delay(500).duration(350)}>
                        <View style={styles.pendingRow}>
                          <RippleLoader size={22} color={iconColors.primary} />
                          <ScaledText style={styles.pendingText}>{t('paymentPending')}</ScaledText>
                        </View>
                      </Animated.View>
                    </>
                  )}
                </>
              )}
            </View>
          </Animated.View>
        )}

        {/* ══ Transaction History ══ */}
        <Animated.View entering={FadeInDown.delay(300).duration(450).springify()}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="receipt-outline" size={18} color={iconColors.primary} />
              <ScaledText style={styles.sectionTitle}>{t('history')}</ScaledText>
            </View>

            {loadingHistory ? (
              <View style={styles.shimmerWrap}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={styles.shimmerRow}>
                    <Shimmer width={44} height={44} borderRadius={13} />
                    <View style={{ flex: 1, gap: 7 }}>
                      <Shimmer width="65%" height={14} />
                      <Shimmer width="42%" height={10} />
                    </View>
                    <Shimmer width={68} height={26} borderRadius={13} />
                  </View>
                ))}
              </View>
            ) : payments.length === 0 ? (
              <Animated.View entering={FadeIn.delay(450).duration(350)} style={styles.emptyWrap}>
                <Ionicons name="wallet-outline" size={36} color={colors.textSecondary} />
                <ScaledText style={styles.emptyText}>{t('noHistory')}</ScaledText>
              </Animated.View>
            ) : (
              payments.map((p, idx) => (
                <Animated.View key={p.id} entering={SlideInRight.delay(400 + idx * 50).duration(380).springify()}>
                  <View style={[styles.paymentRow, idx === payments.length - 1 && { borderBottomWidth: 0 }]}>
                    <Ionicons name={statusIcon(p.status) as any} size={20} color={statusColor(p.status)} />
                    <View style={styles.paymentInfo}>
                      <ScaledText style={styles.paymentAmount}>+{formatVND(p.amount)} đ</ScaledText>
                      <ScaledText style={styles.paymentDate}>
                        {new Date(p.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </ScaledText>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor(p.status) + '15' }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor(p.status) }]} />
                      <ScaledText style={[styles.statusText, { color: statusColor(p.status) }]}>{formatStatus(p.status, t)}</ScaledText>
                    </View>
                  </View>
                </Animated.View>
              ))
            )}
          </View>
        </Animated.View>
      </RippleRefreshScrollView>
    </Screen>
  );
}

function createStyles(scaledTypography: { size: { xs: number; sm: number; md: number; lg: number; xl: number } }, topInset: number) {
  return StyleSheet.create({
    scroll: { paddingBottom: spacing.xxl + 24 },

    // ── Header ──────────────────────────────────────────
    header: {
      paddingTop: topInset + spacing.sm,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
      overflow: 'hidden',
    },
    decorCircle1: {
      position: 'absolute', top: -50, right: -50,
      width: 180, height: 180, borderRadius: 90,
      backgroundColor: 'rgba(255,255,255,0.07)',
    },
    decorCircle2: {
      position: 'absolute', bottom: 10, left: -40,
      width: 120, height: 120, borderRadius: 60,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    headerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    backBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { color: '#fff', fontSize: scaledTypography.size.md, fontWeight: '700' },

    // Balance card (inside header)
    balanceCard: {
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 20,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
    },
    balanceCardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
    balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: scaledTypography.size.xs, marginBottom: 2 },
    balanceValue: {
      color: '#fff', fontSize: scaledTypography.size.lg + 2, fontWeight: '800',
      lineHeight: Math.round((scaledTypography.size.lg + 2) * 1.3),
    },
    balanceUnit: { color: 'rgba(255,255,255,0.85)', fontSize: scaledTypography.size.sm, fontWeight: '600', marginBottom: 3 },
    balanceShine: {
      position: 'absolute', right: -20, top: -20,
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },

    // ── Section card ────────────────────────────────────
    section: {
      backgroundColor: colors.surface,
      marginHorizontal: spacing.lg, marginTop: spacing.lg,
      borderRadius: radius.xl, padding: spacing.lg,
      borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 }, elevation: 2,
    },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg,
    },
    sectionTitle: { fontSize: scaledTypography.size.md, fontWeight: '700', color: colors.textPrimary },

    // ── Quick amount cards ───────────────────────────────
    quickGrid: { gap: spacing.sm, marginBottom: spacing.lg },
    quickCard: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingVertical: spacing.md, paddingHorizontal: spacing.md,
      borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.background,
    },
    quickCardActive: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}07`,
    },
    quickCardBody: { flex: 1 },
    quickCardAmount: {
      fontSize: scaledTypography.size.sm + 1, fontWeight: '700', color: colors.textPrimary,
    },
    quickCardAmountActive: { color: colors.primary },
    quickCardLabel: {
      fontSize: scaledTypography.size.xs, color: colors.textSecondary, marginTop: 1,
    },
    quickCardCheck: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 1.5, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    quickCardCheckActive: {
      backgroundColor: colors.primary, borderColor: colors.primary,
    },
    quickCardCheckEmpty: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'transparent' },

    // ── Divider ─────────────────────────────────────────
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontSize: scaledTypography.size.xs, color: colors.textSecondary },

    // ── Input ────────────────────────────────────────────
    inputWrap: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1.5, borderColor: colors.border, borderRadius: 14,
      backgroundColor: colors.background, marginBottom: spacing.md, overflow: 'hidden',
    },
    inputCurrencyBadge: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      backgroundColor: colors.surfaceMuted, borderRightWidth: 1, borderRightColor: colors.border,
    },
    inputCurrencyText: { fontSize: scaledTypography.size.sm, fontWeight: '700', color: colors.textSecondary },
    input: {
      flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      fontSize: scaledTypography.size.sm, color: colors.textPrimary,
    },
    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: `${colors.danger}10`, borderRadius: 10,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    errorText: { color: colors.danger, fontSize: scaledTypography.size.xs, flex: 1 },

    // ── Generate button ──────────────────────────────────
    generateBtn: { borderRadius: 14, overflow: 'hidden', marginTop: spacing.xs },
    generateBtnInner: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: spacing.sm, paddingVertical: spacing.md + 4, minHeight: 52,
    },
    generateBtnText: { color: '#fff', fontSize: scaledTypography.size.sm, fontWeight: '700' },

    // ── QR section ───────────────────────────────────────
    qrWrapper: { alignItems: 'center', marginBottom: spacing.md },
    qrContainer: {
      backgroundColor: '#fff',
      borderRadius: 20, padding: spacing.md,
      shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      borderWidth: 1, borderColor: colors.border,
    },
    qrImage: { width: 210, height: 210 },
    qrAmountBadge: {
      marginTop: spacing.md,
      backgroundColor: `${colors.primary}12`,
      paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
      borderRadius: radius.full,
    },
    qrAmountText: { fontSize: scaledTypography.size.lg, fontWeight: '800', color: colors.primary },

    countdownRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      marginBottom: spacing.md,
    },
    countdownText: { color: colors.warning, fontSize: scaledTypography.size.xs, fontWeight: '600' },

    noteBox: {
      backgroundColor: colors.background, borderRadius: 14,
      padding: spacing.md, marginBottom: spacing.md,
      borderWidth: 1.5, borderColor: colors.border,
    },
    noteLabel: { fontSize: scaledTypography.size.xs, color: colors.textSecondary, marginBottom: 4 },
    noteValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    noteValue: { fontSize: scaledTypography.size.sm, color: colors.textPrimary, fontWeight: '700', flex: 1 },

    pendingRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
      backgroundColor: `${colors.primary}08`, borderRadius: 12, paddingVertical: spacing.md,
    },
    pendingText: { color: colors.textSecondary, fontSize: scaledTypography.size.xs },

    expiredBox: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
    expiredText: { color: colors.danger, fontSize: scaledTypography.size.sm, fontWeight: '600' },
    refreshBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primary, paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.xl, borderRadius: 12,
    },
    refreshBtnText: { color: '#fff', fontSize: scaledTypography.size.xs, fontWeight: '600' },

    successBox: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
    successTitle: { color: colors.success, fontSize: scaledTypography.size.lg, fontWeight: '700' },
    successSub: { color: colors.textSecondary, fontSize: scaledTypography.size.sm },

    // ── History ──────────────────────────────────────────
    emptyWrap: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
    emptyText: { color: colors.textSecondary, fontSize: scaledTypography.size.xs },

    shimmerWrap: { gap: spacing.md, paddingVertical: spacing.xs },
    shimmerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },

    paymentRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingVertical: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    paymentInfo: { flex: 1 },
    paymentAmount: { fontSize: scaledTypography.size.sm, fontWeight: '700', color: colors.textPrimary },
    paymentDate: { fontSize: scaledTypography.size.xs, color: colors.textSecondary, marginTop: 2 },
    statusBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: spacing.sm + 2, paddingVertical: 5, borderRadius: radius.full,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: scaledTypography.size.xs, fontWeight: '600' },
  });
}
