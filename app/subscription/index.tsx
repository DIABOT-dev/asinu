import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { SubscriptionFAQ } from '../../src/components/SubscriptionFAQ';
import { RestoreLink } from '../../src/features/iap/RestoreLink';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { apiClient, ApiError } from '../../src/lib/apiClient';
import { env } from '../../src/lib/env';
import { colors, radius, spacing } from '../../src/styles';
import { showToast } from '../../src/stores/toast.store';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { PLANS, formatVND } from '../../src/features/subscription/plans';

// Assets
const CROWN_HERO = require('../../assets/images/subscription/crown_hero.png');
const PHONE_HERO = require('../../assets/images/subscription/phone_hero.png');
const LEAVES_LEFT = require('../../assets/images/subscription/header_leaves_left.png');

// Types
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

function formatDate(d: string | null) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function formatCountdown(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function statusColor(s: SubRecord['status']) {
  if (s === 'completed') return colors.success;
  if (s === 'failed') return colors.danger;
  return colors.warning;
}

// ── Memoized Subcomponents for Zero-Jank Rendering ──

type CurrentPlanCardProps = {
  status: SubscriptionStatus | null;
  t: (key: string, options?: any) => string;
  styles: ReturnType<typeof createStyles>;
};

const CurrentPlanCard = memo(function CurrentPlanCard({ status, t, styles }: CurrentPlanCardProps) {
  return (
    <View style={styles.currentPlanCard}>
      <View style={styles.currentAvatarWrap}>
        <Ionicons name="person" size={20} color="#059669" />
      </View>
      <View style={styles.currentPlanInfo}>
        <View style={styles.currentPlanTitleRow}>
          <Text style={styles.currentPlanLabel}>{t('currentPlan')}</Text>
          <View style={styles.currentPlanBadge}>
            <Text style={styles.currentPlanBadgeText}>
              {status?.isPremium ? t('premium') : t('free')}
            </Text>
          </View>
        </View>
        <Text style={styles.currentPlanSub}>
          {status?.isPremium && status.expiresAt
            ? t('expiresAt', { date: formatDate(status.expiresAt) })
            : t('currentPlanDesc')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </View>
  );
});

type FeatureItem = {
  icon?: React.ReactNode;
  text: string;
  dim?: boolean;
};

type PlanComparisonProps = {
  freeFeatures: FeatureItem[];
  premiumFeatures: FeatureItem[];
  onUpgradePress: () => void;
  t: (key: string) => string;
  styles: ReturnType<typeof createStyles>;
};

const PlanComparison = memo(function PlanComparison({
  freeFeatures,
  premiumFeatures,
  onUpgradePress,
  t,
  styles,
}: PlanComparisonProps) {
  return (
    <View style={styles.comparisonRow}>
      {/* Free Plan Card */}
      <View style={styles.freeCard}>
        <View style={styles.planCardHeader}>
          <View style={styles.freeAvatar}>
            <Ionicons name="person-outline" size={20} color="#64748b" />
          </View>
          <Text style={styles.freePlanTitle}>{t('free')}</Text>
          <Text style={styles.freePrice}>0đ</Text>
          <Text style={styles.perMonthText}>{t('perMonth')}</Text>
        </View>

        <View style={styles.featureList}>
          {freeFeatures.map((item, idx) => (
            <View key={idx} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>{item.icon}</View>
              <Text
                style={[styles.featureText, item.dim && styles.featureTextDim]}
                numberOfLines={2}
              >
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.freeCTABox}>
          <Text style={styles.freeCTAText}>{t('currentlyUsing')}</Text>
        </View>
      </View>

      {/* Premium Plan Card (Highlighted) */}
      <View style={styles.premiumCard}>
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>{t('mostPopular')}</Text>
        </View>

        <View style={styles.planCardHeader}>
          <View style={styles.premiumAvatar}>
            <MaterialCommunityIcons name="crown" size={22} color="#f59e0b" />
          </View>
          <Text style={styles.premiumPlanTitle}>{t('premium')}</Text>
          <Text style={styles.premiumPrice}>199K</Text>
          <Text style={styles.premiumPerMonthText}>{t('perMonth')}</Text>
        </View>

        <View style={styles.featureList}>
          {premiumFeatures.map((item, idx) => (
            <View key={idx} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color="#ea580c" style={styles.premiumCheckIcon} />
              <Text style={styles.premiumFeatureText} numberOfLines={2}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={onUpgradePress}
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
          <LinearGradient
            colors={['#f97316', '#ea580c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.premiumCTABtn}
          >
            <Text style={styles.premiumCTAText}>{t('upgradeNow')} →</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
});

type ComingSoonCardProps = {
  t: (key: string) => string;
  styles: ReturnType<typeof createStyles>;
};

const ComingSoonCard = memo(function ComingSoonCard({ t, styles }: ComingSoonCardProps) {
  return (
    <View style={styles.comingSoonCard}>
      <View style={styles.sproutIconWrap}>
        <MaterialCommunityIcons name="sprout" size={22} color="#059669" />
      </View>
      <View style={styles.comingSoonTextCol}>
        <Text style={styles.comingSoonTitle}>{t('upgradeComingSoonTitle')}</Text>
        <Text style={styles.comingSoonBody}>{t('upgradeComingSoonBody')}</Text>
      </View>
      <Image
        source={PHONE_HERO}
        style={styles.phoneArtImg}
        contentFit="contain"
        cachePolicy="memory-disk"
        priority="normal"
      />
    </View>
  );
});

type HistoryCardProps = {
  history: SubRecord[];
  loadingHistory: boolean;
  t: (key: string, options?: any) => string;
  statusLabel: (s: SubRecord['status']) => string;
  styles: ReturnType<typeof createStyles>;
};

const HistoryCard = memo(function HistoryCard({
  history,
  loadingHistory,
  t,
  statusLabel,
  styles,
}: HistoryCardProps) {
  return (
    <View style={styles.historyCard}>
      <View style={styles.receiptIconWrap}>
        <Ionicons name="receipt-outline" size={20} color="#059669" />
      </View>
      <View style={styles.historyContentWrap}>
        <Text style={styles.historyTitle}>{t('historyTitle')}</Text>
        {loadingHistory ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.historyLoading} />
        ) : history.length === 0 ? (
          <Text style={styles.historyEmptyText}>{t('noHistory')}</Text>
        ) : (
          <View style={styles.historyItemsList}>
            {history.slice(0, 3).map((sub) => (
              <View key={sub.id} style={styles.historyItemRow}>
                <View style={styles.historyItemCol}>
                  <Text style={styles.historyItemAmount}>
                    {formatVND(sub.amount)}đ · {t('planMonth', { months: sub.plan_months })}
                  </Text>
                  <Text style={styles.historyItemDate}>{formatDate(sub.created_at)}</Text>
                </View>
                <View style={[styles.historyStatusPill, { backgroundColor: statusColor(sub.status) + '20' }]}>
                  <Text style={[styles.historyStatusText, { color: statusColor(sub.status) }]}>
                    {statusLabel(sub.status)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

// ── Main Screen Component ──

export default function SubscriptionScreen() {
  const { t } = useTranslation('subscription');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography, isDark), [scaledTypography, isDark]);

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
  }, [fetchStatus, fetchHistory, clearTimers]);

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
          if (found) {
            clearTimers();
            setPollStatus('success');
            setHistory(res.subscriptions);
            fetchStatus();
            showToast(t('subscriptionSuccess'), 'success');
          }
        }
      } catch { /* silent */ }
    }, 5000);
  }, [clearTimers, fetchStatus, t]);

  const handleCreateQR = useCallback(async () => {
    setCreatingQR(true);
    try {
      const res = await apiClient<QRData>('/api/subscriptions/qr', { method: 'POST', body: { months: selectedPlan } });
      setQr(res);
      setPollStatus('idle');
      startCountdown(res.expires_at);
      startPolling(res.order_code);
      showToast(t('qrCreated'), 'success');
    } catch {
      showToast(t('paymentNetworkError'), 'error');
    } finally { setCreatingQR(false); }
  }, [selectedPlan, startCountdown, startPolling, t]);

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
        showToast(t('subscriptionSuccess'), 'success');
      } else {
        setWalletPayResult('failed');
        setWalletPayError(res.message ?? t('paymentFailed'));
        showToast(res.message ?? t('paymentFailed'), 'error');
      }
    } catch (err) {
      setWalletPayResult('failed');
      if (err instanceof ApiError) {
        setWalletPayError(err.message || t('paymentFailed'));
        showToast(err.message || t('paymentFailed'), 'error');
      } else {
        setWalletPayError(t('paymentNetworkError'));
        showToast(t('paymentNetworkError'), 'error');
      }
    }
  }, [selectedPlan, fetchStatus, fetchHistory, t]);

  const handleUpgradePress = useCallback(() => {
    if (env.paymentMethod === 'sepay') {
      handleOpenPayMethod();
    } else if (env.paymentMethod === 'iap') {
      showToast(t('chooseIapPlan'), 'info');
    } else {
      showToast(t('upgradeComingSoonTitle'), 'info');
    }
  }, [handleOpenPayMethod, t]);

  const isQrExpired = qr ? countdown <= 0 && pollStatus !== 'success' : false;
  const activePlan = PLANS.find(p => p.months === selectedPlan) ?? PLANS[0];

  const statusLabel = useCallback((s: SubRecord['status']) => {
    if (s === 'completed') return t('statusCompleted');
    if (s === 'failed') return t('statusFailed');
    return t('statusPending');
  }, [t]);

  // Feature lists matching the screenshot
  const freeFeatures = useMemo<FeatureItem[]>(() => [
    { icon: <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />, text: t('features.history30d') },
    { icon: <Ionicons name="chatbubble-outline" size={15} color={colors.textSecondary} />, text: t('features.chatHistory30d') },
    { icon: <MaterialCommunityIcons name="cube-outline" size={15} color={colors.textSecondary} />, text: t('features.chatContext50') },
    { icon: <Ionicons name="people-outline" size={15} color={colors.textSecondary} />, text: t('features.connectionsFree') },
    { icon: <Ionicons name="mic-off-outline" size={15} color="#94a3b8" />, text: t('features.voiceChatNo'), dim: true },
    { icon: <Ionicons name="mic-off-outline" size={15} color="#94a3b8" />, text: t('features.voiceLogNo'), dim: true },
    { icon: <Ionicons name="mic-off-outline" size={15} color="#94a3b8" />, text: t('features.voiceTranscribeNo'), dim: true },
  ], [t]);

  const premiumFeatures = useMemo<FeatureItem[]>(() => [
    { text: t('features.history365d') },
    { text: t('features.chatHistory365d') },
    { text: t('features.chatContext300') },
    { text: t('features.connections3') },
    { text: t('features.voiceChat5k') },
    { text: t('features.voiceLogYes') },
    { text: t('features.voiceTranscribeYes') },
  ], [t]);

  const handleBack = useCallback(() => router.back(), [router]);
  const handleGiftPress = useCallback(() => router.push('/subscription/gift' as any), [router]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.sm }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        removeClippedSubviews={Platform.OS === 'android'}
      >
        <Animated.View entering={FadeInDown.duration(280)}>
          {/* ── Top Header with 3D Crown Art & Left Leaves ── */}
          <View style={styles.headerRow}>
            {/* Decorative leaf vine behind back button */}
            <View style={styles.leavesLeftWrap} pointerEvents="none">
              <Image
                source={LEAVES_LEFT}
                style={styles.leavesLeftImg}
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="high"
              />
            </View>

            <ScreenBackButton onPress={handleBack} />
            <View style={styles.headerTextCol}>
              <Text style={styles.headerTitle}>{t('title')}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={2}>
                {t('headerSubtitle')}
              </Text>
            </View>
            <View style={styles.crownArtWrap} pointerEvents="none">
              <Image
                source={CROWN_HERO}
                style={styles.crownHeroImg}
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="high"
              />
            </View>
          </View>

          {/* ── Gói hiện tại (Current Plan Card) ── */}
          <CurrentPlanCard status={status} t={t} styles={styles} />

          {/* ── Two-Column Plan Comparison (Miễn phí vs Premium) ── */}
          <PlanComparison
            freeFeatures={freeFeatures}
            premiumFeatures={premiumFeatures}
            onUpgradePress={handleUpgradePress}
            t={t}
            styles={styles}
          />

          {/* ── FAQ Section (Câu hỏi thường gặp) ── */}
          <View style={styles.faqWrapper}>
            <SubscriptionFAQ />
          </View>

          {/* ── Coming Soon Banner (Tính năng nâng cấp sắp ra mắt) ── */}
          <ComingSoonCard t={t} styles={styles} />

          {/* ── Registration History Card (Lịch sử đăng ký) ── */}
          <HistoryCard
            history={history}
            loadingHistory={loadingHistory}
            t={t}
            statusLabel={statusLabel}
            styles={styles}
          />

          {/* Restore Purchases Link for Store Guidelines */}
          {status?.isPremium && (
            <View style={styles.restoreWrap}>
              <RestoreLink onRestored={() => { fetchStatus(); fetchHistory(); }} />
            </View>
          )}

          {/* Gift Premium Entry if SePay enabled */}
          {env.paymentMethod === 'sepay' && (
            <Pressable
              onPress={handleGiftPress}
              style={({ pressed }) => [styles.giftCard, { opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={styles.giftIconWrap}>
                <Ionicons name="gift" size={20} color="#d97706" />
              </View>
              <View style={styles.giftContentWrap}>
                <Text style={styles.giftTitle}>{t('giftEntry')}</Text>
                <Text style={styles.giftDesc}>{t('giftEntryDesc')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── QR Payment Section Modal (SePay) ── */}
      {qr && (
        <Modal visible transparent animationType="fade" onRequestClose={handleCancelQR}>
          <Pressable style={styles.payModalOverlay} onPress={handleCancelQR}>
            <Pressable style={styles.payModalBox} onPress={() => {}}>
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
                  <Text style={styles.payModalTitle}>{t('paymentQR')}</Text>
                  <Image source={{ uri: qr.qr_url }} style={styles.qrImage} contentFit="contain" />
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
                    <Text style={[styles.noteValue, { color: '#ea580c' }]}>{formatVND(qr.amount)}đ</Text>
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
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Modal chọn phương thức thanh toán ── */}
      <Modal visible={showPayMethodModal} transparent animationType="fade" onRequestClose={() => setShowPayMethodModal(false)}>
        <Pressable style={styles.payModalOverlay} onPress={() => setShowPayMethodModal(false)}>
          <Pressable style={styles.payModalBox} onPress={() => {}}>
            <Text style={styles.payModalTitle}>{t('chooseMethod')}</Text>

            <Pressable
              style={styles.payMethodBtn}
              onPress={() => { setShowPayMethodModal(false); setShowWalletConfirm(true); }}
            >
              <View style={styles.payMethodIcon}>
                <MaterialCommunityIcons name="wallet" size={24} color={colors.primary} />
              </View>
              <View style={styles.payMethodTextWrap}>
                <Text style={styles.payMethodLabel}>{t('walletDeduct')}</Text>
                <Text style={styles.payMethodSub}>{t('walletBalance', { amount: formatVND(walletBalance) })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            <Pressable
              style={styles.payMethodBtn}
              onPress={() => { setShowPayMethodModal(false); handleCreateQR(); }}
            >
              <View style={styles.payMethodIcon}>
                <MaterialCommunityIcons name="qrcode-scan" size={24} color="#ea580c" />
              </View>
              <View style={styles.payMethodTextWrap}>
                <Text style={styles.payMethodLabel}>{t('scanQR')}</Text>
                <Text style={styles.payMethodSub}>{t('bankTransfer')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            <Pressable style={styles.payCancelBtn} onPress={() => setShowPayMethodModal(false)}>
              <Text style={styles.payCancelText}>{t('cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal xác nhận thanh toán bằng ví ── */}
      <Modal visible={showWalletConfirm} transparent animationType="fade" onRequestClose={() => setShowWalletConfirm(false)}>
        <Pressable style={styles.payModalOverlay} onPress={() => setShowWalletConfirm(false)}>
          <Pressable style={styles.payModalBox} onPress={() => {}}>
            {walletPayResult === 'success' ? (
              <View style={styles.walletResultBox}>
                <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                <Text style={styles.walletResultTitle}>{t('subscriptionSuccess')}</Text>
                <Text style={styles.walletResultDesc}>{t('planActivated', { months: activePlan.months })}</Text>
                <Pressable
                  style={styles.confirmOkBtn}
                  onPress={() => { setShowWalletConfirm(false); setWalletPayResult('idle'); }}
                >
                  <Text style={styles.confirmOkText}>{t('close')}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <MaterialCommunityIcons name="wallet-outline" size={36} color={colors.primary} style={styles.walletIconSelf} />
                <Text style={styles.payModalTitle}>{t('confirmSubscription')}</Text>
                <Text style={styles.confirmDesc}>
                  {t('confirmSubscriptionMsg', { months: activePlan.months, price: formatVND(activePlan.price) })}
                </Text>
                <View style={styles.confirmBalanceRow}>
                  <Text style={styles.confirmBalanceLabel}>{t('currentBalance')}</Text>
                  <Text style={styles.confirmBalanceValue}>{formatVND(walletBalance)}{t('currency')}</Text>
                </View>
                {walletPayResult === 'failed' && (
                  <View style={styles.walletErrorBox}>
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.walletErrorText}>{walletPayError}</Text>
                  </View>
                )}
                <View style={styles.confirmActions}>
                  <Pressable
                    style={styles.confirmCancelBtn}
                    onPress={() => { setShowWalletConfirm(false); setShowPayMethodModal(true); }}
                    disabled={walletPayResult === 'loading'}
                  >
                    <Text style={styles.confirmCancelText}>{t('goBack')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.confirmOkBtn, walletPayResult === 'failed' && styles.confirmRetryBtn]}
                    onPress={handleWalletPay}
                    disabled={walletPayResult === 'loading'}
                  >
                    {walletPayResult === 'loading' ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.confirmOkText}>{walletPayResult === 'failed' ? t('retry') : t('confirm')}</Text>
                    )}
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

function createStyles(typography: ReturnType<typeof useScaledTypography>, isDark: boolean) {
  return StyleSheet.create({
    scrollContent: {
      paddingBottom: 90,
      paddingHorizontal: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
      minHeight: 112,
      paddingTop: 6,
      paddingBottom: 8,
    },
    leavesLeftWrap: {
      position: 'absolute',
      left: -14,
      top: -8,
      width: 140,
      height: 85,
      zIndex: 0,
    },
    leavesLeftImg: {
      width: '100%',
      height: '100%',
    },
    headerTextCol: {
      flex: 1,
      paddingLeft: 10,
      paddingRight: 180,
      justifyContent: 'center',
      zIndex: 1,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    headerSubtitle: {
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 17,
      color: isDark ? '#94a3b8' : '#047857',
      marginTop: 2,
    },
    crownArtWrap: {
      position: 'absolute',
      right: -4,
      top: 4,
      width: 180,
      height: 90,
      zIndex: 1,
    },
    crownHeroImg: {
      width: '100%',
      height: '100%',
    },

    // Current plan card
    currentPlanCard: {
      backgroundColor: isDark ? colors.surface : '#ffffff',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#e2e8f0',
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 4,
    },
    currentAvatarWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: isDark ? '#064e3b' : '#d1fae5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    currentPlanInfo: {
      flex: 1,
    },
    currentPlanTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    currentPlanLabel: {
      fontSize: 14.5,
      fontWeight: '700',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    currentPlanBadge: {
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    currentPlanBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#059669',
    },
    currentPlanSub: {
      fontSize: 12,
      color: isDark ? '#94a3b8' : '#64748b',
      marginTop: 2,
    },

    // Comparison row
    comparisonRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 14,
      alignItems: 'stretch',
    },
    freeCard: {
      flex: 1,
      backgroundColor: isDark ? colors.surface : '#ffffff',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#e2e8f0',
      padding: 12,
      justifyContent: 'space-between',
    },
    premiumCard: {
      flex: 1,
      backgroundColor: isDark ? '#1c1917' : '#fffbf5',
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: '#f59e0b',
      padding: 12,
      justifyContent: 'space-between',
      position: 'relative',
    },
    popularBadge: {
      position: 'absolute',
      top: -10,
      right: 12,
      backgroundColor: '#ea580c',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      zIndex: 2,
    },
    popularBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#ffffff',
    },
    planCardHeader: {
      alignItems: 'center',
      paddingTop: 4,
      paddingBottom: 8,
    },
    freeAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    premiumAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#fef3c7',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    freePlanTitle: {
      fontSize: 14.5,
      fontWeight: '700',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    premiumPlanTitle: {
      fontSize: 14.5,
      fontWeight: '700',
      color: '#ea580c',
    },
    freePrice: {
      fontSize: 22,
      fontWeight: '800',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginTop: 2,
      letterSpacing: -0.5,
    },
    premiumPrice: {
      fontSize: 22,
      fontWeight: '800',
      color: '#ea580c',
      marginTop: 2,
      letterSpacing: -0.5,
    },
    perMonthText: {
      fontSize: 11,
      color: '#94a3b8',
      marginTop: -2,
    },
    premiumPerMonthText: {
      fontSize: 11,
      color: '#ea580c',
      opacity: 0.8,
      marginTop: -2,
    },
    featureList: {
      marginVertical: 10,
      gap: 9,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    featureIconWrap: {
      width: 18,
      alignItems: 'center',
      marginRight: 6,
    },
    featureText: {
      flex: 1,
      fontSize: 11,
      color: isDark ? '#cbd5e1' : '#475569',
      lineHeight: 15,
    },
    featureTextDim: {
      color: '#94a3b8',
    },
    premiumCheckIcon: {
      marginRight: 6,
    },
    premiumFeatureText: {
      flex: 1,
      fontSize: 11,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#1e293b',
      lineHeight: 15,
    },
    freeCTABox: {
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 6,
    },
    freeCTAText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: '#64748b',
    },
    premiumCTABtn: {
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 6,
    },
    premiumCTAText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: '#ffffff',
    },

    faqWrapper: {
      marginTop: 16,
    },

    // Coming soon card
    comingSoonCard: {
      backgroundColor: isDark ? '#064e3b20' : '#e6f7ef',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? '#047857' : '#a7f3d0',
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      position: 'relative',
      overflow: 'hidden',
      minHeight: 96,
    },
    sproutIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? '#064e3b' : '#d1fae5',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    comingSoonTextCol: {
      flex: 1,
      paddingRight: 142,
    },
    comingSoonTitle: {
      fontSize: 13.5,
      fontWeight: '700',
      color: isDark ? '#34d399' : '#047857',
    },
    comingSoonBody: {
      fontSize: 11.5,
      color: isDark ? '#a7f3d0' : '#065f46',
      marginTop: 2,
      lineHeight: 16,
    },
    phoneArtImg: {
      position: 'absolute',
      right: 4,
      top: '50%',
      transform: [{ translateY: -34 }],
      width: 136,
      height: 68,
    },

    // History card
    historyCard: {
      backgroundColor: isDark ? colors.surface : '#ffffff',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#e2e8f0',
      padding: 14,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginTop: 12,
    },
    receiptIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? '#064e3b' : '#d1fae5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    historyContentWrap: {
      flex: 1,
    },
    historyTitle: {
      fontSize: 14.5,
      fontWeight: '700',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    historyLoading: {
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    historyEmptyText: {
      fontSize: 12,
      color: '#94a3b8',
      marginTop: 4,
    },
    historyItemsList: {
      marginTop: 8,
      gap: 8,
    },
    historyItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark ? colors.border : '#f1f5f9',
    },
    historyItemCol: {
      flex: 1,
    },
    historyItemAmount: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#f8fafc' : '#1e293b',
    },
    historyItemDate: {
      fontSize: 11.5,
      color: '#94a3b8',
      marginTop: 1,
    },
    historyStatusPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    historyStatusText: {
      fontSize: 11,
      fontWeight: '600',
    },

    restoreWrap: {
      marginTop: 14,
      alignItems: 'center',
    },

    // Gift card
    giftCard: {
      backgroundColor: isDark ? colors.surface : '#ffffff',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#e2e8f0',
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 12,
    },
    giftIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: '#fef3c7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    giftContentWrap: {
      flex: 1,
    },
    giftTitle: {
      fontSize: 14.5,
      fontWeight: '700',
      color: isDark ? '#f8fafc' : '#1e293b',
    },
    giftDesc: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 1,
    },

    // Modals
    payModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    payModalBox: {
      backgroundColor: isDark ? colors.surface : '#ffffff',
      borderRadius: 24,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    payModalTitle: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    payMethodBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    payMethodIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    payMethodTextWrap: {
      flex: 1,
    },
    payMethodLabel: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    payMethodSub: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
    payCancelBtn: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      marginTop: spacing.xs,
    },
    payCancelText: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      fontWeight: '600',
    },

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

    walletIconSelf: { alignSelf: 'center', marginBottom: spacing.sm },
    confirmDesc: { fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    confirmBalanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginTop: spacing.xs },
    confirmBalanceLabel: { fontSize: typography.size.sm, color: colors.textSecondary },
    confirmBalanceValue: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary },
    confirmActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    confirmCancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    confirmCancelText: { fontSize: typography.size.sm, fontWeight: '600', color: colors.textSecondary },
    confirmOkBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
    confirmRetryBtn: { backgroundColor: colors.warning },
    confirmOkText: { fontSize: typography.size.sm, fontWeight: '700', color: '#fff' },

    walletResultBox: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
    walletResultTitle: { fontSize: typography.size.md, fontWeight: '700', color: colors.success },
    walletResultDesc: { fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center' },

    walletErrorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.danger + '15', borderRadius: 10, padding: spacing.md, marginTop: spacing.xs },
    walletErrorText: { flex: 1, fontSize: typography.size.xs, color: colors.danger, fontWeight: '500' },
  });
}
