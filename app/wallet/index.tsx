import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { apiClient } from '../../src/lib/apiClient';
import { colors, radius, spacing } from '../../src/styles';

// ---- types ----
type QRData = {
  order_code: string;
  qr_url: string;
  amount: number;
  description: string;
  expires_at: string;
};

type Payment = {
  id: number;
  order_code: string;
  amount: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
};

type BalanceRes = { ok: boolean; balance: string };
type QRRes = { ok: boolean; order_code: string; qr_url: string; amount: number; description: string; expires_at: string };
type HistoryRes = { ok: boolean; payments: Payment[]; total: number };

const QUICK_AMOUNTS: { value: number; labelKey: string }[] = [
  { value: 50000, labelKey: 'quick50' },
  { value: 100000, labelKey: 'quick100' },
  { value: 200000, labelKey: 'quick200' },
  { value: 500000, labelKey: 'quick500' },
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

export default function WalletScreen() {
  const { t } = useTranslation('wallet');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography, insets.top), [scaledTypography, insets.top]);

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
    } catch {
      // silent
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient<HistoryRes>('/api/payments/history?limit=10');
      if (res.ok) setPayments(res.payments);
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBalance(), fetchHistory()]);
    setRefreshing(false);
  }, [fetchBalance, fetchHistory]);

  useEffect(() => {
    fetchBalance();
    fetchHistory();
    return () => clearTimers();
  }, []);

  const startCountdown = useCallback((expiresAt: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, []);

  const startPolling = useCallback((orderCode: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPollStatus('polling');
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiClient<HistoryRes>('/api/payments/history?limit=10');
        if (res.ok) {
          setPayments(res.payments);
          const found = res.payments.find((p) => p.order_code === orderCode);
          if (found?.status === 'completed') {
            setPollStatus('success');
            if (pollRef.current) clearInterval(pollRef.current);
            fetchBalance();
          }
        }
      } catch {
        // silent
      }
    }, 5000);
  }, [fetchBalance]);

  const handleGenerateQR = useCallback(async () => {
    const num = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!num || num < 1000) {
      setError(t('amountMin'));
      return;
    }
    setError('');
    setCreatingQR(true);
    clearTimers();
    setQr(null);
    setPollStatus('idle');

    try {
      const res = await apiClient<QRRes>('/api/payments/qr', {
        method: 'POST',
        body: { amount: num },
      });
      if (res.ok) {
        setQr({
          order_code: res.order_code,
          qr_url: res.qr_url,
          amount: res.amount,
          description: res.description,
          expires_at: res.expires_at,
        });
        startCountdown(res.expires_at);
        startPolling(res.order_code);
      }
    } catch {
      setError(t('createQRError'));
    } finally {
      setCreatingQR(false);
    }
  }, [amount, t, clearTimers, startCountdown, startPolling]);

  const isExpired = qr ? countdown <= 0 : false;

  const minuteStr = Math.floor(countdown / 60).toString().padStart(2, '0');
  const secondStr = (countdown % 60).toString().padStart(2, '0');

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} hitSlop={8}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <ScaledText style={styles.headerTitle}>{t('title')}</ScaledText>
            <View style={{ width: 24 }} />
          </View>

          <ScaledText style={styles.balanceLabel}>{t('balance')}</ScaledText>
          {loadingBalance ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 4 }} />
          ) : (
            <ScaledText style={styles.balanceValue}>
              {formatVND(balance)} {t('balanceUnit')}
            </ScaledText>
          )}
        </LinearGradient>

        {/* Top-up section */}
        <View style={styles.card}>
          <ScaledText style={styles.cardTitle}>{t('topUp')}</ScaledText>

          {/* Quick amount buttons */}
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((q) => (
              <Pressable
                key={q.value}
                style={[styles.quickBtn, amount === String(q.value) && styles.quickBtnActive]}
                onPress={() => setAmount(String(q.value))}
              >
                <ScaledText style={[styles.quickBtnText, amount === String(q.value) && styles.quickBtnTextActive]}>
                  {t(q.labelKey)}
                </ScaledText>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder={t('enterAmount')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
          />

          {!!error && <ScaledText style={styles.errorText}>{error}</ScaledText>}

          <Pressable
            style={[styles.generateBtn, creatingQR && { opacity: 0.7 }]}
            onPress={handleGenerateQR}
            disabled={creatingQR}
          >
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.generateBtnInner}>
              {creatingQR ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ScaledText style={styles.generateBtnText}>{t('generateQR')}</ScaledText>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {/* QR display */}
        {qr && (
          <View style={styles.card}>
            {pollStatus === 'success' ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                <ScaledText style={styles.successText}>{t('paymentSuccess')}</ScaledText>
              </View>
            ) : (
              <>
                <ScaledText style={styles.cardTitle}>{t('scanQR')}</ScaledText>

                {isExpired ? (
                  <View style={styles.expiredBox}>
                    <ScaledText style={styles.expiredText}>{t('expired')}</ScaledText>
                    <Pressable style={styles.refreshBtn} onPress={handleGenerateQR}>
                      <ScaledText style={styles.refreshBtnText}>{t('refreshQR')}</ScaledText>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Image
                      source={{ uri: qr.qr_url }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />

                    {/* Countdown */}
                    <View style={styles.countdownRow}>
                      <Ionicons name="time-outline" size={16} color={colors.warning} />
                      <ScaledText style={styles.countdownText}>
                        {t('expiresIn', { minutes: minuteStr, seconds: secondStr })}
                      </ScaledText>
                    </View>

                    {/* Transfer note */}
                    <View style={styles.noteBox}>
                      <ScaledText style={styles.noteLabel}>{t('transferNote')}:</ScaledText>
                      <ScaledText style={styles.noteValue}>{qr.description}</ScaledText>
                    </View>

                    {/* Pending indicator */}
                    <View style={styles.pendingRow}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <ScaledText style={styles.pendingText}>{t('paymentPending')}</ScaledText>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* History */}
        <View style={styles.card}>
          <ScaledText style={styles.cardTitle}>{t('history')}</ScaledText>
          {loadingHistory ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : payments.length === 0 ? (
            <ScaledText style={styles.emptyText}>{t('noHistory')}</ScaledText>
          ) : (
            payments.map((p) => (
              <View key={p.id} style={styles.paymentRow}>
                <View style={styles.paymentLeft}>
                  <Ionicons
                    name={p.status === 'completed' ? 'checkmark-circle' : p.status === 'failed' ? 'close-circle' : 'time'}
                    size={20}
                    color={statusColor(p.status)}
                  />
                  <View style={styles.paymentInfo}>
                    <ScaledText style={styles.paymentAmount}>+{formatVND(p.amount)} đ</ScaledText>
                    <ScaledText style={styles.paymentDate}>
                      {new Date(p.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </ScaledText>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(p.status) + '20' }]}>
                  <ScaledText style={[styles.statusText, { color: statusColor(p.status) }]}>
                    {formatStatus(p.status, t)}
                  </ScaledText>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function createStyles(scaledTypography: { size: { xs: number; sm: number; md: number; lg: number; xl: number } }, topInset: number) {
  return StyleSheet.create({
    scroll: {
      paddingBottom: spacing.xxl + 20,
    },
    header: {
      paddingTop: topInset + spacing.md,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    headerTitle: {
      color: '#fff',
      fontSize: scaledTypography.size.md,
      fontWeight: '700',
    },
    balanceLabel: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: scaledTypography.size.xs,
      marginBottom: 4,
    },
    balanceValue: {
      color: '#fff',
      fontSize: scaledTypography.size.xl,
      fontWeight: '800',
    },
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
    },
    cardTitle: {
      fontSize: scaledTypography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    quickRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    quickBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    quickBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '15',
    },
    quickBtnText: {
      fontSize: scaledTypography.size.xs,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    quickBtnTextActive: {
      color: colors.primary,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: scaledTypography.size.sm,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    errorText: {
      color: colors.danger,
      fontSize: scaledTypography.size.xs,
      marginBottom: spacing.sm,
    },
    generateBtn: {
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    generateBtnInner: {
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    generateBtnText: {
      color: '#fff',
      fontSize: scaledTypography.size.sm,
      fontWeight: '700',
    },
    qrImage: {
      width: '100%',
      height: 240,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    countdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginBottom: spacing.md,
    },
    countdownText: {
      color: colors.warning,
      fontSize: scaledTypography.size.xs,
      fontWeight: '600',
    },
    noteBox: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    noteLabel: {
      fontSize: scaledTypography.size.xs,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    noteValue: {
      fontSize: scaledTypography.size.sm,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    pendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    pendingText: {
      color: colors.textSecondary,
      fontSize: scaledTypography.size.xs,
    },
    expiredBox: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    expiredText: {
      color: colors.danger,
      fontSize: scaledTypography.size.sm,
      fontWeight: '600',
      marginBottom: spacing.md,
    },
    refreshBtn: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
    },
    refreshBtnText: {
      color: '#fff',
      fontSize: scaledTypography.size.xs,
      fontWeight: '600',
    },
    successBox: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    successText: {
      color: colors.success,
      fontSize: scaledTypography.size.md,
      fontWeight: '700',
      marginTop: spacing.md,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: scaledTypography.size.xs,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    paymentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    paymentLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    paymentInfo: {
      flex: 1,
    },
    paymentAmount: {
      fontSize: scaledTypography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    paymentDate: {
      fontSize: scaledTypography.size.xs,
      color: colors.textSecondary,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    statusText: {
      fontSize: scaledTypography.size.xs,
      fontWeight: '600',
    },
  });
}
