/**
 * Buy Premium for someone in your Care Circle (MVP audit FIX #10).
 *
 * Flow:
 *  1. Load /api/care-circle/connections — already accepted peers only.
 *  2. User picks a recipient + a plan (1/3/6/12 months).
 *  3. POST /api/subscriptions/qr/gift returns a QR like the self-purchase
 *     flow; we render it the same way and let the user transfer.
 *  4. Payment confirmation arrives via push notification (backend sends
 *     "gift confirmed" to the payer) — no in-app polling here because
 *     the subscription belongs to the recipient, not the payer.
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { careCircleApi, type CareCircleConnection } from '../../src/features/care-circle/care-circle.api';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { ApiError, apiClient } from '../../src/lib/apiClient';
import { colors, radius, spacing } from '../../src/styles';

const PLAN_OPTIONS: { months: 1 | 3 | 6 | 12; label: string; price: number; discountPct: number }[] = [
  { months: 1,  label: '1 tháng',  price: 199000, discountPct: 0 },
  { months: 3,  label: '3 tháng',  price: 567000, discountPct: 5 },
  { months: 6,  label: '6 tháng',  price: 1075000, discountPct: 10 },
  { months: 12, label: '12 tháng', price: 1910000, discountPct: 20 },
];

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

const formatVND = (n: number) => n.toLocaleString('vi-VN');

/**
 * Gradient header with a back button. Root layout has headerShown: false,
 * so every full-screen route in this app renders its own header in-content.
 */
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
  const [selectedMonths, setSelectedMonths] = useState<1 | 3 | 6 | 12>(1);
  const [qr, setQr] = useState<GiftQR | null>(null);
  const [creating, setCreating] = useState(false);

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

  // Map a connection to the user that ISN'T me — that's the giftable party.
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

  const selectedPlan = PLAN_OPTIONS.find((p) => p.months === selectedMonths) ?? PLAN_OPTIONS[0];

  const handleCreateGiftQR = useCallback(async () => {
    if (!recipientId) return;
    setCreating(true);
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
      setCreating(false);
    }
  }, [recipientId, selectedMonths, t]);

  const recipientName = useMemo(() => {
    return connectionPeers.find((p) => p.peerId === recipientId)?.peerName ?? '';
  }, [recipientId, connectionPeers]);

  // ─── QR rendered after successful create ────────────────────────────
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
              <Text style={styles.noteLabel}>{t('amountLabel', { plan: `${qr.plan_months} ${t('monthShort') || 'tháng'}` })}</Text>
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

  // ─── Empty state: no Care Circle peers yet ──────────────────────────
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

  // ─── Picker ─────────────────────────────────────────────────────────
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

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('giftPickPlan')}</Text>
          <View style={styles.planGrid}>
            {PLAN_OPTIONS.map((p) => (
              <Pressable
                key={p.months}
                onPress={() => setSelectedMonths(p.months)}
                style={[
                  styles.planCell,
                  selectedMonths === p.months && styles.planCellActive,
                ]}
              >
                <Text style={styles.planLabel}>{p.label}</Text>
                <Text style={styles.planPrice}>{formatVND(p.price)}đ</Text>
                {p.discountPct > 0 && (
                  <Text style={styles.planDiscount}>{t('saveOff', { pct: p.discountPct })}</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          disabled={!recipientId || creating}
          style={[styles.primaryBtn, (!recipientId || creating) && { opacity: 0.5 }]}
          onPress={() => {
            if (!recipientId) return;
            Alert.alert(
              t('giftConfirmTitle'),
              t('giftConfirmBody', {
                name: recipientName,
                price: formatVND(selectedPlan.price),
                plan: selectedPlan.label,
              }),
              [
                { text: t('cancel'), style: 'cancel' },
                { text: t('confirm'), onPress: handleCreateGiftQR },
              ],
            );
          }}
        >
          <Text style={styles.primaryBtnText}>
            {creating ? t('generatingQR') || '…' : t('giftCreateQR')}
          </Text>
        </Pressable>
      </ScrollView>
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

  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  planCell: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    gap: 4,
  },
  planCellActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '14',
  },
  planLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  planPrice: { fontSize: 14, fontWeight: '800', color: colors.premiumDark },
  planDiscount: { fontSize: 11, color: colors.success, fontWeight: '600' },

  primaryBtn: {
    backgroundColor: colors.primary,
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
  hint: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, alignItems: 'flex-start' },
  hintText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
