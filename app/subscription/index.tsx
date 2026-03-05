import { Ionicons } from '@expo/vector-icons';
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
};

type QRData = {
  order_code: string;
  qr_url: string;
  amount: number;
  description: string;
  expires_at: string;
  plan_months: number;
};

type SubRecord = {
  id: number;
  order_code: string;
  amount: string;
  status: 'pending' | 'completed' | 'failed';
  plan_months: number;
  subscription_start: string | null;
  subscription_end: string | null;
  created_at: string;
};

// ── Helpers ─────────────────────────────────────────────────────────
function formatVND(val: number | string): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '0';
  return n.toLocaleString('vi-VN');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Feature Row Component ────────────────────────────────────────────
function FeatureRow({ icon, text, highlight }: { icon: string; text: string; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={{ fontSize: 14, color: highlight ? '#d97706' : colors.textSecondary, flex: 1 }}>
        {text}
      </Text>
    </View>
  );
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
    } catch {
      // silent
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient<{ ok: boolean; subscriptions: SubRecord[] }>('/api/subscriptions/history?limit=10');
      if (res.ok) setHistory(res.subscriptions);
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    return () => clearTimers();
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
      try {
        const res = await apiClient<{ ok: boolean; subscriptions: SubRecord[] }>('/api/subscriptions/history?limit=5');
        if (res.ok) {
          const found = res.subscriptions.find(
            (s) => s.order_code === orderCode && s.status === 'completed'
          );
          if (found) {
            clearTimers();
            setPollStatus('success');
            setHistory(res.subscriptions);
            fetchStatus();
          }
        }
      } catch {
        // silent
      }
    }, 5000);
  }, [clearTimers, fetchStatus]);

  const handleCreateQR = useCallback(async () => {
    setCreatingQR(true);
    try {
      const res = await apiClient<QRData>('/api/subscriptions/qr', { method: 'POST', body: { months: 1 } });
      setQr(res);
      setPollStatus('idle');
      startCountdown(res.expires_at);
      startPolling(res.order_code);
    } catch (e: any) {
      // silent — user sees no QR
    } finally {
      setCreatingQR(false);
    }
  }, [startCountdown, startPolling]);

  const handleCancelQR = useCallback(() => {
    clearTimers();
    setQr(null);
    setPollStatus('idle');
  }, [clearTimers]);

  const isQrExpired = qr ? countdown <= 0 && pollStatus !== 'success' : false;

  function statusColor(s: SubRecord['status']): string {
    if (s === 'completed') return colors.success;
    if (s === 'failed') return colors.danger;
    return colors.warning;
  }

  function statusLabel(s: SubRecord['status']): string {
    if (s === 'completed') return t('statusCompleted');
    if (s === 'failed') return t('statusFailed');
    return t('statusPending');
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <LinearGradient
          colors={['#f59e0b', '#d97706']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>{t('title')}</Text>
          <View style={styles.crownBadge}>
            <Text style={styles.crownEmoji}>👑</Text>
          </View>
        </LinearGradient>

        {/* ── Current Plan Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('currentPlan')}</Text>
          {loadingStatus ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.planRow}>
              <View style={[styles.planBadge, status?.isPremium ? styles.premiumBadge : styles.freeBadge]}>
                <Text style={[styles.planBadgeText, status?.isPremium ? styles.premiumBadgeText : styles.freeBadgeText]}>
                  {status?.isPremium ? `👑 ${t('premium')}` : t('free')}
                </Text>
              </View>
              {status?.isPremium && status.expiresAt ? (
                <Text style={styles.expiresText}>
                  {t('expiresAt', { date: formatDate(status.expiresAt) })}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* ── Feature Comparison ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('featuresTitle')}</Text>

          {/* Free column */}
          <View style={styles.featureSection}>
            <Text style={styles.featureSectionTitle}>{t('features.freeTitle')}</Text>
            <FeatureRow icon="📋" text={t('features.logs30')} />
            <FeatureRow icon="📅" text={t('features.history7d')} />
            <FeatureRow icon="👥" text={t('features.connections3')} />
            <FeatureRow icon="🚫" text={t('features.voiceNo')} />
          </View>

          <View style={styles.featureDivider} />

          {/* Premium column */}
          <View style={styles.featureSection}>
            <Text style={[styles.featureSectionTitle, { color: '#d97706' }]}>{t('features.premiumTitle')} 👑</Text>
            <FeatureRow icon="✅" text={t('features.logsUnlimited')} highlight />
            <FeatureRow icon="✅" text={t('features.historyFull')} highlight />
            <FeatureRow icon="✅" text={t('features.connectionsUnlimited')} highlight />
            <FeatureRow icon="🎙️" text={t('features.voiceYes')} highlight />
          </View>
        </View>

        {/* ── Upgrade Card / QR ── */}
        {!status?.isPremium && (
          <View style={styles.card}>
            {pollStatus === 'success' ? (
              /* Success state */
              <View style={styles.successBox}>
                <Text style={{ fontSize: 48 }}>🎉</Text>
                <Text style={styles.successTitle}>{t('activationSuccess')}</Text>
                <Text style={styles.successDesc}>{t('activationSuccessDesc')}</Text>
              </View>
            ) : !qr ? (
              /* Upgrade CTA */
              <>
                <View style={styles.priceRow}>
                  <Text style={styles.priceText}>{t('price')}</Text>
                  <Text style={styles.priceNote}>{t('priceNote')}</Text>
                </View>
                <Pressable style={styles.upgradeBtn} onPress={handleCreateQR} disabled={creatingQR}>
                  <LinearGradient
                    colors={['#f59e0b', '#d97706']}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.upgradeBtnInner}
                  >
                    {creatingQR ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.upgradeBtnText}>{t('upgradeNow')}</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </>
            ) : isQrExpired ? (
              /* Expired QR */
              <View style={styles.expiredBox}>
                <Ionicons name="time-outline" size={40} color={colors.danger} />
                <Text style={styles.expiredText}>QR đã hết hạn</Text>
                <Pressable style={styles.retryBtn} onPress={handleCreateQR}>
                  <Text style={styles.retryBtnText}>{t('generateQR')}</Text>
                </Pressable>
              </View>
            ) : (
              /* QR Display */
              <>
                <Text style={styles.cardTitle}>{t('paymentQR')}</Text>
                <Image
                  source={{ uri: qr.qr_url }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
                {/* Countdown */}
                <View style={styles.countdownRow}>
                  <Ionicons name="time-outline" size={14} color={colors.warning} />
                  <Text style={styles.countdownText}>
                    {t('countdown', { time: formatCountdown(countdown) })}
                  </Text>
                </View>
                {/* Transfer note */}
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>{t('transferNote')}</Text>
                  <Text style={styles.noteValue}>{qr.description}</Text>
                </View>
                {/* Amount */}
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Số tiền:</Text>
                  <Text style={[styles.noteValue, { color: '#d97706' }]}>{formatVND(qr.amount)}đ</Text>
                </View>
                {/* Polling indicator */}
                <View style={styles.pollingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.pollingText}>{t('polling')}</Text>
                </View>
                {/* Cancel */}
                <Pressable style={styles.cancelBtn} onPress={handleCancelQR}>
                  <Text style={styles.cancelBtnText}>{t('cancelQR')}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* ── Subscription History ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('historyTitle')}</Text>
          {loadingHistory ? (
            <ActivityIndicator color={colors.primary} />
          ) : history.length === 0 ? (
            <Text style={styles.emptyText}>{t('noHistory')}</Text>
          ) : (
            history.map((sub) => (
              <View key={sub.id} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <Ionicons
                    name={sub.status === 'completed' ? 'checkmark-circle' : sub.status === 'failed' ? 'close-circle' : 'time'}
                    size={20}
                    color={statusColor(sub.status)}
                  />
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyAmount}>{formatVND(sub.amount)}đ</Text>
                    <Text style={styles.historyDate}>
                      {new Date(sub.created_at).toLocaleDateString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                      })}
                    </Text>
                    {sub.subscription_end ? (
                      <Text style={styles.historyValidity}>
                        {t('validUntil', { date: formatDate(sub.subscription_end) })}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={[styles.historyBadge, { backgroundColor: statusColor(sub.status) + '20' }]}>
                  <Text style={[styles.historyBadgeText, { color: statusColor(sub.status) }]}>
                    {statusLabel(sub.status)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function createStyles(
  typography: ReturnType<typeof useScaledTypography>,
  topInset: number
) {
  return StyleSheet.create({
    scrollContent: {
      paddingBottom: 40,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: topInset + spacing.md,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
    },
    backBtn: {
      position: 'absolute',
      left: spacing.lg,
      top: topInset + spacing.md,
      padding: spacing.xs,
    },
    headerTitle: {
      color: '#fff',
      fontSize: typography.size.lg,
      fontWeight: '800',
    },
    crownBadge: {
      marginTop: spacing.xs,
    },
    crownEmoji: {
      fontSize: 40,
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
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flexWrap: 'wrap',
    },
    planBadge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.xl,
    },
    freeBadge: {
      backgroundColor: '#e5e7eb',
    },
    premiumBadge: {
      backgroundColor: '#fef3c7',
      borderWidth: 1,
      borderColor: '#f59e0b',
    },
    planBadgeText: {
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
    freeBadgeText: {
      color: colors.textSecondary,
    },
    premiumBadgeText: {
      color: '#d97706',
    },
    expiresText: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    featureSection: {
      marginBottom: spacing.sm,
    },
    featureSectionTitle: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    featureDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },
    priceRow: {
      marginBottom: spacing.md,
    },
    priceText: {
      fontSize: typography.size.xl,
      fontWeight: '800',
      color: '#d97706',
      marginBottom: spacing.xs,
    },
    priceNote: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    upgradeBtn: {
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    upgradeBtnInner: {
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    upgradeBtnText: {
      color: '#fff',
      fontSize: typography.size.md,
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
      fontSize: typography.size.xs,
      fontWeight: '600',
    },
    noteBox: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    noteLabel: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    noteValue: {
      fontSize: typography.size.sm,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    pollingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    pollingText: {
      color: colors.textSecondary,
      fontSize: typography.size.xs,
    },
    cancelBtn: {
      alignItems: 'center',
      marginTop: spacing.md,
      padding: spacing.sm,
    },
    cancelBtnText: {
      color: colors.danger,
      fontSize: typography.size.xs,
      fontWeight: '600',
    },
    expiredBox: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      gap: spacing.sm,
    },
    expiredText: {
      color: colors.danger,
      fontSize: typography.size.sm,
      fontWeight: '600',
    },
    retryBtn: {
      backgroundColor: '#f59e0b',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      marginTop: spacing.sm,
    },
    retryBtnText: {
      color: '#fff',
      fontSize: typography.size.xs,
      fontWeight: '700',
    },
    successBox: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      gap: spacing.sm,
    },
    successTitle: {
      color: colors.success,
      fontSize: typography.size.md,
      fontWeight: '700',
    },
    successDesc: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      textAlign: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.size.xs,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    historyLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    historyInfo: {
      flex: 1,
    },
    historyAmount: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    historyDate: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    historyValidity: {
      fontSize: typography.size.xs,
      color: '#d97706',
      fontWeight: '600',
    },
    historyBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    historyBadgeText: {
      fontSize: typography.size.xs,
      fontWeight: '600',
    },
  });
}
