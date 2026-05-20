/**
 * Buy Premium for someone in your Care Circle (MVP audit FIX #10).
 *
 * Two payment methods, matching the self-purchase screen:
 *   - Wallet — POST /api/subscriptions/wallet/gift, activates immediately.
 *   - QR     — POST /api/subscriptions/qr/gift, payer scans SePay QR.
 *
 * In both cases the BENEFICIARY of the resulting subscription is the
 * Care Circle peer the payer selected. Backend verifies the connection
 * before charging or generating the QR; we never trust the recipient id
 * client-side.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { careCircleApi, type CareCircleConnection } from '../../src/features/care-circle/care-circle.api';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { PLANS, PlanOption, formatVND, type Plan } from '../../src/features/subscription/plans';
import { ApiError, apiClient } from '../../src/lib/apiClient';
import { colors, radius, spacing } from '../../src/styles';

type GiftQR = {
  order_code: string;
  qr_url: string;
  amount: number;
  description: string;
  expires_at: string;
  plan_months: number;
  is_gift: boolean;
  payer_user_id: number;
  recipient_user_id: number;
};

type WalletResult =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; expiresAt: string; planMonths: number }
  | { status: 'failed'; error: string };

function GiftHeader({ title, topInset }: { title: string; topInset: number }) {
  return (
    <LinearGradient
      colors={[colors.premium, colors.premiumDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: topInset + spacing.md }]}
    >
      <Pressable
        accessibilityLabel="Quay lại"
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => router.back()}
        style={[styles.backBtn, { top: topInset + spacing.md }]}
      >
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
    </LinearGradient>
  );
}

export default function GiftSubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('subscription');
  const { t: tcc } = useTranslation('careCircle');
  const currentUserId = useAuthStore((s) => s.profile?.id);

  const [connections, setConnections] = useState<CareCircleConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<number>(1);

  const [qr, setQr] = useState<GiftQR | null>(null);
  const [creatingQR, setCreatingQR] = useState(false);

  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [showPayMethodModal, setShowPayMethodModal] = useState(false);
  const [wallet, setWallet] = useState<WalletResult>({ status: 'idle' });

  useEffect(() => {
    (async () => {
      try {
        const list = await careCircleApi.getConnections();
        setConnections(list.filter((c) => c.status === 'accepted'));
      } catch {
        setConnections([]);
      } finally {
        setLoadingConnections(false);
      }
    })();
  }, []);

  // Each user_connections row stores the pair as (requester_id, addressee_id).
  // Whichever side ISN'T me is the giftable peer.
  const connectionPeers = useMemo(() => {
    if (!currentUserId) return [];
    return connections.map((c) => {
      const meIsRequester = String(c.requester_id) === String(currentUserId);
      const peerId = meIsRequester ? c.addressee_id : c.requester_id;
      const peerName =
        (meIsRequester ? c.addressee_full_name : c.requester_full_name) ||
        (meIsRequester ? c.addressee_name : c.requester_name) ||
        (meIsRequester ? c.addressee_phone : c.requester_phone) ||
        '—';
      return { peerId: Number(peerId), peerName, role: c.role };
    });
  }, [connections, currentUserId]);

  const selectedPlan = PLANS.find((p) => p.months === selectedMonths) ?? PLANS[0];
  const recipientName = useMemo(
    () => connectionPeers.find((p) => p.peerId === recipientId)?.peerName ?? '',
    [recipientId, connectionPeers],
  );

  const openPayMethod = useCallback(async () => {
    if (!recipientId) return;
    setShowPayMethodModal(true);
    // Fetch wallet balance lazily — matches main subscription flow.
    try {
      const res = await apiClient<{ ok: boolean; balance: string }>('/api/payments/balance');
      if (res.ok) setWalletBalance(res.balance);
    } catch {
      setWalletBalance(null);
    }
  }, [recipientId]);

  const handleCreateGiftQR = useCallback(async () => {
    if (!recipientId) return;
    setCreatingQR(true);
    setShowPayMethodModal(false);
    try {
      const res = await apiClient<GiftQR>('/api/subscriptions/qr/gift', {
        method: 'POST',
        body: { months: selectedMonths, recipient_user_id: recipientId },
      });
      setQr(res);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'NOT_IN_CARE_CIRCLE') {
        Alert.alert(t('giftErrorNotInCircleTitle'), t('giftErrorNotInCircleBody'));
      } else if (err instanceof ApiError && err.code === 'INVALID_RECIPIENT') {
        Alert.alert(t('giftErrorInvalidTitle'), t('giftErrorInvalidBody'));
      } else {
        Alert.alert(t('giftErrorGenericTitle'), err?.message || t('giftErrorGenericBody'));
      }
    } finally {
      setCreatingQR(false);
    }
  }, [recipientId, selectedMonths, t]);

  const handleWalletPay = useCallback(async () => {
    if (!recipientId) return;
    setWallet({ status: 'loading' });
    try {
      const res = await apiClient<{ ok: boolean; expiresAt?: string; planMonths?: number; message?: string }>(
        '/api/subscriptions/wallet/gift',
        {
          method: 'POST',
          body: { months: selectedMonths, recipient_user_id: recipientId },
        },
      );
      if (res.ok && res.expiresAt && res.planMonths != null) {
        setWallet({ status: 'success', expiresAt: res.expiresAt, planMonths: res.planMonths });
      } else {
        setWallet({ status: 'failed', error: res.message || t('paymentFailed') });
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'NOT_IN_CARE_CIRCLE') {
        setWallet({ status: 'failed', error: t('giftErrorNotInCircleBody') });
      } else if (err instanceof ApiError) {
        setWallet({ status: 'failed', error: err.message || t('paymentFailed') });
      } else {
        setWallet({ status: 'failed', error: t('paymentNetworkError') });
      }
    }
  }, [recipientId, selectedMonths, t]);

  // ─── Branch 1: QR rendered after a successful create ─────────────────
  if (qr) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('giftTitle'), headerShown: false }} />
        <GiftHeader title={t('giftTitle')} topInset={insets.top} />
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}>
          <View style={styles.card}>
            <Text style={styles.qrHeader}>{t('giftQRHeader', { name: recipientName })}</Text>
            <Image source={{ uri: qr.qr_url }} style={styles.qrImage} contentFit="contain" />
            <View style={styles.noteRow}>
              <Text style={styles.noteLabel}>{t('transferNote')}</Text>
              <Text style={styles.noteValue}>{qr.description}</Text>
            </View>
            <View style={styles.noteRow}>
              <Text style={styles.noteLabel}>
                {t('amountLabel', { plan: t('planMonth', { months: qr.plan_months }) })}
              </Text>
              <Text style={[styles.noteValue, { color: colors.premiumDark }]}>{formatVND(qr.amount)}đ</Text>
            </View>
            <View style={styles.hint}>
              <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
              <Text style={styles.hintText}>{t('giftQRHint')}</Text>
            </View>
            <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={styles.secondaryBtnText}>{t('close')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  // ─── Branch 2: empty Care Circle ─────────────────────────────────────
  if (!loadingConnections && connectionPeers.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('giftTitle'), headerShown: false }} />
        <GiftHeader title={t('giftTitle')} topInset={insets.top} />
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>{t('giftEmptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('giftEmptyBody')}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/care-circle/invite')}>
            <Text style={styles.primaryBtnText}>{tcc('invite') || t('giftEmptyCTA')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ─── Branch 3: picker (recipient + plan) ─────────────────────────────
  return (
    <Screen>
      <Stack.Screen options={{ title: t('giftTitle'), headerShown: false }} />
      <GiftHeader title={t('giftTitle')} topInset={insets.top} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.intro}>{t('giftIntro')}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('giftPickRecipient')}</Text>
          <View style={{ gap: spacing.sm }}>
            {connectionPeers.map((p) => (
              <Pressable
                key={p.peerId}
                onPress={() => setRecipientId(p.peerId)}
                style={[
                  styles.recipientRow,
                  recipientId === p.peerId && styles.recipientRowActive,
                ]}
              >
                <MaterialCommunityIcons
                  name="account-heart"
                  size={22}
                  color={recipientId === p.peerId ? colors.primary : colors.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipientName}>{p.peerName}</Text>
                  {p.role ? <Text style={styles.recipientRole}>{p.role}</Text> : null}
                </View>
                {recipientId === p.peerId && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Plan picker — same shared PlanOption tile as the self-buy flow. */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('giftPickPlan')}</Text>
          <View style={styles.planGrid}>
            {PLANS.map((plan: Plan) => (
              <PlanOption
                key={plan.months}
                plan={plan}
                selected={plan.months === selectedMonths}
                onSelect={() => setSelectedMonths(plan.months)}
              />
            ))}
          </View>
        </View>

        <Pressable
          disabled={!recipientId || creatingQR}
          style={[styles.primaryBtn, (!recipientId || creatingQR) && { opacity: 0.5 }]}
          onPress={openPayMethod}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <MaterialCommunityIcons name="crown" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>
              {t('upgradeNow')} · {formatVND(selectedPlan.price)}đ
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* ── Payment-method chooser (QR vs wallet) ───────────────────── */}
      <Modal visible={showPayMethodModal} transparent animationType="fade" onRequestClose={() => setShowPayMethodModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPayMethodModal(false)}>
          <Pressable style={styles.modalBox} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t('chooseMethod')}</Text>

            <Pressable
              style={styles.methodBtn}
              onPress={() => { setShowPayMethodModal(false); handleWalletPay(); }}
            >
              <View style={styles.methodIcon}>
                <MaterialCommunityIcons name="wallet" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodTitle}>{t('walletDeduct')}</Text>
                {walletBalance != null && (
                  <Text style={styles.methodSubtitle}>{t('walletBalance', { amount: formatVND(walletBalance) })}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            <Pressable style={styles.methodBtn} onPress={handleCreateGiftQR}>
              <View style={styles.methodIcon}>
                <MaterialCommunityIcons name="qrcode-scan" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodTitle}>{t('scanQR')}</Text>
                <Text style={styles.methodSubtitle}>{t('bankTransfer')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            <Pressable style={styles.cancelBtn} onPress={() => setShowPayMethodModal(false)}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Wallet result (loading / success / failed) ──────────────── */}
      <Modal
        visible={wallet.status !== 'idle'}
        transparent
        animationType="fade"
        onRequestClose={() => wallet.status !== 'loading' && setWallet({ status: 'idle' })}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => wallet.status !== 'loading' && setWallet({ status: 'idle' })}
        >
          <Pressable style={styles.modalBox} onPress={() => {}}>
            {wallet.status === 'loading' && (
              <View style={styles.walletState}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.walletStateText}>{t('polling')}</Text>
              </View>
            )}
            {wallet.status === 'success' && (
              <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.walletState}>
                <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                <Text style={[styles.walletStateText, { fontWeight: '800' }]}>{t('giftSuccessTitle')}</Text>
                <Text style={[styles.walletStateText, { color: colors.textSecondary }]}>
                  {t('giftSuccessBody', { name: recipientName, plan: t('planMonth', { months: wallet.planMonths }) })}
                </Text>
                <Pressable style={styles.primaryBtn} onPress={() => { setWallet({ status: 'idle' }); router.back(); }}>
                  <Text style={styles.primaryBtnText}>{t('close')}</Text>
                </Pressable>
              </Animated.View>
            )}
            {wallet.status === 'failed' && (
              <View style={styles.walletState}>
                <Ionicons name="close-circle" size={48} color={colors.danger} />
                <Text style={[styles.walletStateText, { fontWeight: '700' }]}>{t('paymentFailed')}</Text>
                <Text style={[styles.walletStateText, { color: colors.textSecondary }]}>{wallet.error}</Text>
                <Pressable style={styles.secondaryBtn} onPress={() => setWallet({ status: 'idle' })}>
                  <Text style={styles.secondaryBtnText}>{t('close')}</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  backBtn: { position: 'absolute', left: spacing.lg, padding: spacing.xs },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },

  scroll: { padding: spacing.lg, gap: spacing.md },
  intro: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },

  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  recipientRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '0d',
  },
  recipientName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  recipientRole: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Same 2-column layout as the main subscription PlanOption grid.
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },

  primaryBtn: {
    backgroundColor: colors.premium,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryBtnText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },

  qrHeader: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  qrImage: { width: 240, height: 240, alignSelf: 'center' },
  noteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  noteLabel: { fontSize: 13, color: colors.textSecondary },
  noteValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  hint: {
    flexDirection: 'row', gap: spacing.xs, padding: spacing.sm,
    backgroundColor: colors.surfaceMuted, borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  hintText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // ── Payment method modal (mirrors subscription/index modal styling) ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  methodIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  methodTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  methodSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cancelBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },

  walletState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  walletStateText: { fontSize: 14, color: colors.textPrimary, textAlign: 'center' },
});
