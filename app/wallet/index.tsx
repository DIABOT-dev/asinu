import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
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
import { colors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

// ---- types ----
type QRData = { order_code: string; qr_url: string; amount: number; description: string; expires_at: string };
type Payment = { id: number; order_code: string; amount: string; status: 'pending' | 'completed' | 'failed'; created_at: string; completed_at: string | null };
type BalanceRes = { ok: boolean; balance: string };
type QRRes = { ok: boolean; order_code: string; qr_url: string; amount: number; description: string; expires_at: string };
type HistoryRes = { ok: boolean; payments: Payment[]; total: number };

const QUICK_AMOUNTS: { value: number; labelKey: string; icon: string }[] = [
  { value: 50000, labelKey: 'quick50', icon: 'cash-fast' },
  { value: 100000, labelKey: 'quick100', icon: 'cash' },
  { value: 200000, labelKey: 'quick200', icon: 'cash-multiple' },
  { value: 500000, labelKey: 'quick500', icon: 'diamond-stone' },
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ══════ Header with balance ══════ */}
        <Animated.View entering={FadeInUp.duration(600).springify()}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark, '#065f53']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
            <View style={styles.decorCircle3} />

            <View style={styles.headerRow}>
              <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} hitSlop={12} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </Pressable>
              <Animated.View entering={FadeIn.delay(300).duration(400)}>
                <ScaledText style={styles.headerTitle}>{t('title')}</ScaledText>
              </Animated.View>
              <Pressable onPress={onRefresh} hitSlop={12} style={styles.backBtn}>
                <Ionicons name="refresh" size={20} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.balanceSection}>
              <Animated.View entering={ZoomIn.delay(200).duration(500).springify()} style={styles.balanceIconWrap}>
                <FloatingIcon />
              </Animated.View>
              <Animated.View entering={FadeIn.delay(400).duration(400)}>
                <ScaledText style={styles.balanceLabel}>{t('balance')}</ScaledText>
              </Animated.View>
              {loadingBalance ? (
                <View style={{ marginTop: 12 }}>
                  <RippleLoader size={50} color="rgba(255,255,255,0.7)" />
                </View>
              ) : (
                <Animated.View entering={FadeIn.delay(500).duration(600)}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>
                    <ScaledText style={styles.balanceValue}>{formatVND(balance)}</ScaledText>
                    <ScaledText style={styles.balanceUnit}>{t('balanceUnit')}</ScaledText>
                  </View>
                </Animated.View>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ══════ Top-up section ══════ */}
        <Animated.View entering={FadeInDown.delay(200).duration(500).springify()}>
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Animated.View entering={ZoomIn.delay(300).duration(400)} style={styles.cardTitleIcon}>
                <Ionicons name="add-circle" size={20} color={colors.primary} />
              </Animated.View>
              <ScaledText style={styles.cardTitle}>{t('topUp')}</ScaledText>
            </View>

            <View style={styles.quickGrid}>
              {QUICK_AMOUNTS.map((q, idx) => {
                const active = amount === String(q.value);
                return (
                  <Animated.View key={q.value} entering={FadeInDown.delay(350 + idx * 80).duration(400).springify()} style={{ width: '47%' as any, flexGrow: 1 }}>
                    <Pressable
                      style={[styles.quickCard, active && styles.quickCardActive]}
                      onPress={() => setAmount(String(q.value))}
                    >
                      <MaterialCommunityIcons name={q.icon as any} size={22} color={active ? colors.primary : colors.textSecondary} />
                      <ScaledText style={[styles.quickCardText, active && styles.quickCardTextActive]}>{t(q.labelKey)}</ScaledText>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <Animated.View entering={FadeInLeft.delay(600).duration(400)}>
              <View style={styles.inputWrap}>
                <MaterialCommunityIcons name="currency-sign" size={18} color={colors.textSecondary} style={{ marginLeft: spacing.md }} />
                <TextInput
                  style={styles.input}
                  placeholder={t('enterAmount')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                />
                {amount.length > 0 && (
                  <Pressable onPress={() => setAmount('')} style={{ marginRight: spacing.md }}>
                    <Ionicons name="close-circle" size={18} color={colors.border} />
                  </Pressable>
                )}
              </View>
            </Animated.View>

            {!!error && (
              <Animated.View entering={FadeIn.duration(300)}>
                <ScaledText style={styles.errorText}>{error}</ScaledText>
              </Animated.View>
            )}

            <Animated.View entering={FadeInUp.delay(700).duration(400).springify()}>
              <Pressable
                style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
                onPress={handleGenerateQR}
                disabled={creatingQR}
              >
                <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.generateBtnInner}>
                  {creatingQR ? (
                    <RippleLoader size={30} color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="qr-code-outline" size={20} color="#fff" />
                      <ScaledText style={styles.generateBtnText}>{t('generateQR')}</ScaledText>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>

        {/* ══════ QR display ══════ */}
        {qr && (
          <Animated.View entering={FadeInDown.delay(100).duration(500).springify()}>
            <View style={styles.card}>
              {pollStatus === 'success' ? (
                <Animated.View entering={ZoomIn.duration(600).springify()} style={styles.successBox}>
                  <View style={styles.successIconWrap}>
                    <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                  </View>
                  <ScaledText style={styles.successText}>{t('paymentSuccess')}</ScaledText>
                </Animated.View>
              ) : (
                <>
                  <View style={styles.cardTitleRow}>
                    <Animated.View entering={ZoomIn.duration(400)} style={[styles.cardTitleIcon, { backgroundColor: `${colors.warning}15` }]}>
                      <Ionicons name="scan-outline" size={20} color={colors.warning} />
                    </Animated.View>
                    <ScaledText style={styles.cardTitle}>{t('scanQR')}</ScaledText>
                  </View>

                  {isExpired ? (
                    <Animated.View entering={FadeIn.duration(400)} style={styles.expiredBox}>
                      <Ionicons name="time-outline" size={48} color={colors.danger} />
                      <ScaledText style={styles.expiredText}>{t('expired')}</ScaledText>
                      <Pressable style={styles.refreshBtn} onPress={handleGenerateQR}>
                        <Ionicons name="refresh" size={16} color="#fff" />
                        <ScaledText style={styles.refreshBtnText}>{t('refreshQR')}</ScaledText>
                      </Pressable>
                    </Animated.View>
                  ) : (
                    <>
                      <Animated.View entering={ZoomIn.delay(200).duration(500).springify()} style={styles.qrContainer}>
                        <Image source={{ uri: qr.qr_url }} style={styles.qrImage} resizeMode="contain" />
                      </Animated.View>

                      <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.amountDisplay}>
                        <ScaledText style={styles.amountDisplayText}>{formatVND(qr.amount)} đ</ScaledText>
                      </Animated.View>

                      <Animated.View entering={FadeIn.delay(500).duration(400)} style={styles.countdownRow}>
                        <View style={styles.countdownBadge}>
                          <Ionicons name="time-outline" size={14} color={colors.warning} />
                          <ScaledText style={styles.countdownText}>
                            {t('expiresIn', { minutes: minuteStr, seconds: secondStr })}
                          </ScaledText>
                        </View>
                      </Animated.View>

                      <Animated.View entering={FadeInRight.delay(600).duration(400)}>
                        <View style={styles.noteBox}>
                          <ScaledText style={styles.noteLabel}>{t('transferNote')}</ScaledText>
                          <View style={styles.noteValueRow}>
                            <ScaledText style={styles.noteValue}>{qr.description}</ScaledText>
                            <Ionicons name="copy-outline" size={16} color={colors.primary} />
                          </View>
                        </View>
                      </Animated.View>

                      <Animated.View entering={FadeIn.delay(700).duration(400)}>
                        <View style={styles.pendingRow}>
                          <RippleLoader size={24} color={colors.primary} />
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

        {/* ══════ Transaction History ══════ */}
        <Animated.View entering={FadeInDown.delay(300).duration(500).springify()}>
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Animated.View entering={ZoomIn.delay(400).duration(400)} style={[styles.cardTitleIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="receipt-outline" size={20} color={colors.primary} />
              </Animated.View>
              <ScaledText style={styles.cardTitle}>{t('history')}</ScaledText>
            </View>

            {loadingHistory ? (
              <View style={styles.shimmerWrap}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={styles.shimmerRow}>
                    <Shimmer width={40} height={40} borderRadius={12} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Shimmer width="70%" height={14} />
                      <Shimmer width="40%" height={10} />
                    </View>
                    <Shimmer width={60} height={24} borderRadius={12} />
                  </View>
                ))}
              </View>
            ) : payments.length === 0 ? (
              <Animated.View entering={FadeIn.delay(500).duration(400)} style={styles.emptyWrap}>
                <Ionicons name="wallet-outline" size={40} color={colors.border} />
                <ScaledText style={styles.emptyText}>{t('noHistory')}</ScaledText>
              </Animated.View>
            ) : (
              payments.map((p, idx) => (
                <Animated.View key={p.id} entering={SlideInRight.delay(450 + idx * 60).duration(400).springify()}>
                  <View style={[styles.paymentRow, idx === payments.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[styles.paymentIconWrap, { backgroundColor: statusColor(p.status) + '15' }]}>
                      <Ionicons name={statusIcon(p.status) as any} size={20} color={statusColor(p.status)} />
                    </View>
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
      </ScrollView>
    </Screen>
  );
}

function createStyles(scaledTypography: { size: { xs: number; sm: number; md: number; lg: number; xl: number } }, topInset: number) {
  return StyleSheet.create({
    scroll: { paddingBottom: spacing.xxl + 20 },

    header: {
      paddingTop: topInset + spacing.md, paddingBottom: spacing.xxl + 10,
      paddingHorizontal: spacing.lg, overflow: 'hidden',
    },
    decorCircle1: {
      position: 'absolute', top: -40, right: -40,
      width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)',
    },
    decorCircle2: {
      position: 'absolute', bottom: -20, left: -30,
      width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)',
    },
    decorCircle3: {
      position: 'absolute', top: 60, left: '50%' as any,
      width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.03)',
    },
    headerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { color: '#fff', fontSize: scaledTypography.size.md, fontWeight: '700' },
    balanceSection: { alignItems: 'center', gap: 6, paddingTop: 4 },
    balanceIconWrap: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    balanceLabel: {
      color: 'rgba(255,255,255,0.75)', fontSize: scaledTypography.size.xs,
      textTransform: 'uppercase', letterSpacing: 1,
    },
    balanceValue: { color: '#fff', fontSize: scaledTypography.size.xl + 4, fontWeight: '800', lineHeight: Math.round((scaledTypography.size.xl + 4) * 1.5) },
    balanceUnit: { color: '#fff', fontSize: scaledTypography.size.md, fontWeight: '600', marginBottom: 6 },

    card: {
      backgroundColor: colors.surface,
      marginHorizontal: spacing.lg, marginTop: spacing.lg,
      borderRadius: radius.xl, padding: spacing.lg,
      borderWidth: 1.5, borderColor: colors.border,
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
    cardTitleIcon: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center',
    },
    cardTitle: { fontSize: scaledTypography.size.md, fontWeight: '700', color: colors.textPrimary },

    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    quickCard: {
      paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
      borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.background, alignItems: 'center', gap: 6,
    },
    quickCardActive: {
      borderColor: colors.primary, backgroundColor: `${colors.primary}08`,
      shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    quickCardText: { fontSize: scaledTypography.size.sm, fontWeight: '700', color: colors.textSecondary },
    quickCardTextActive: { color: colors.primary },

    inputWrap: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg,
      backgroundColor: colors.background, marginBottom: spacing.md,
    },
    input: {
      flex: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.md,
      fontSize: scaledTypography.size.sm, color: colors.textPrimary,
    },
    errorText: { color: colors.danger, fontSize: scaledTypography.size.xs, marginBottom: spacing.sm },

    generateBtn: { borderRadius: radius.lg, overflow: 'hidden' },
    generateBtnInner: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: spacing.sm, paddingVertical: spacing.md + 2, minHeight: 48,
    },
    generateBtnText: { color: '#fff', fontSize: scaledTypography.size.sm, fontWeight: '700' },

    qrContainer: {
      backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: spacing.md, alignSelf: 'center', marginBottom: spacing.md,
      shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    qrImage: { width: 200, height: 200 },
    amountDisplay: {
      alignSelf: 'center', backgroundColor: `${colors.primary}10`,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
      borderRadius: radius.full, marginBottom: spacing.md,
    },
    amountDisplayText: { fontSize: scaledTypography.size.lg, fontWeight: '800', color: colors.primary },
    countdownRow: { alignItems: 'center', marginBottom: spacing.md },
    countdownBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: `${colors.warning}15`, paddingHorizontal: spacing.md,
      paddingVertical: 6, borderRadius: radius.full,
    },
    countdownText: { color: colors.warning, fontSize: scaledTypography.size.xs, fontWeight: '600' },
    noteBox: {
      backgroundColor: colors.background, borderRadius: radius.lg,
      padding: spacing.md, marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.border,
    },
    noteLabel: { fontSize: scaledTypography.size.xs, color: colors.textSecondary, marginBottom: 4 },
    noteValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    noteValue: { fontSize: scaledTypography.size.sm, color: colors.textPrimary, fontWeight: '700', flex: 1 },
    pendingRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
      backgroundColor: `${colors.primary}08`, borderRadius: radius.lg, paddingVertical: spacing.md,
    },
    pendingText: { color: colors.textSecondary, fontSize: scaledTypography.size.xs },

    expiredBox: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
    expiredText: { color: colors.danger, fontSize: scaledTypography.size.sm, fontWeight: '600' },
    refreshBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primary, paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg, borderRadius: radius.lg,
    },
    refreshBtnText: { color: '#fff', fontSize: scaledTypography.size.xs, fontWeight: '600' },
    successBox: { alignItems: 'center', paddingVertical: spacing.xxl },
    successIconWrap: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: `${colors.success}15`,
      alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
    },
    successText: { color: colors.success, fontSize: scaledTypography.size.lg, fontWeight: '700' },

    emptyWrap: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
    emptyText: { color: colors.textSecondary, fontSize: scaledTypography.size.xs, textAlign: 'center' },

    shimmerWrap: { gap: spacing.md, paddingVertical: spacing.sm },
    shimmerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },

    paymentRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    paymentIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    paymentInfo: { flex: 1 },
    paymentAmount: { fontSize: scaledTypography.size.sm, fontWeight: '700', color: colors.textPrimary },
    paymentDate: { fontSize: scaledTypography.size.xs, color: colors.textSecondary, marginTop: 2 },
    statusBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.full,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: scaledTypography.size.xs, fontWeight: '600' },
  });
}
