import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { IapPurchaseCard } from '../../src/features/iap/IapPurchaseCard';
import { careCircleApi, type CareCircleConnection } from '../../src/features/care-circle/care-circle.api';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { apiClient, getApiErrorMessage } from '../../src/lib/apiClient';
import { showToast } from '../../src/stores/toast.store';
import { colors, radius, spacing, typography } from '../../src/styles';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';

type PlanCode = 'free' | 'antam_2' | 'antam_4' | 'antam_8';
type SubscriptionStatus = {
  ok: boolean;
  planCode: PlanCode;
  planName: string;
  tier: 'free' | 'antam';
  isAnTam: boolean;
  isOwner: boolean;
  ownerUserId: number;
  protectedMemberLimit: number;
  protectedMemberCount: number;
  connectionLimit: number;
  billingPeriod: 'monthly' | 'yearly' | null;
  expiresAt: string | null;
  consultationCredits: number;
};
type ProtectedMember = { userId: number; name: string; avatarUrl: string | null; addedAt: string };
type Household = {
  ok: boolean;
  ownerUserId: number;
  planCode: PlanCode;
  planName: string;
  protectedMemberLimit: number;
  protectedMemberCount: number;
  members: ProtectedMember[];
};

const FREE_FEATURES = [
  'v2FreeFeature1',
  'v2FreeFeature2',
  'v2FreeFeature3',
  'v2FreeFeature4',
  'v2FreeFeature5',
];

const AN_TAM_FEATURES = [
  'v2AnTamFeature1',
  'v2AnTamFeature2',
  'v2AnTamFeature3',
  'v2AnTamFeature4',
  'v2AnTamFeature5',
];

function memberFromConnection(connection: CareCircleConnection, currentUserId: number, fallbackName: string) {
  const currentIsRequester = Number(connection.requester_id) === currentUserId;
  return {
    userId: Number(currentIsRequester ? connection.addressee_id : connection.requester_id),
    name:
      (currentIsRequester ? connection.addressee_full_name : connection.requester_full_name) ||
      (currentIsRequester ? connection.addressee_name : connection.requester_name) ||
      fallbackName,
  };
}

export default function SubscriptionScreen() {
  const { t, i18n } = useTranslation('subscription');
  const router = useRouter();
  const currentUserId = Number(useAuthStore((state) => state.profile?.id) || 0);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [connections, setConnections] = useState<CareCircleConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberModal, setMemberModal] = useState(false);
  const [memberBusy, setMemberBusy] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextStatus, nextHousehold, nextConnections] = await Promise.all([
        apiClient<SubscriptionStatus>('/api/subscriptions/status'),
        apiClient<Household>('/api/subscription-household'),
        careCircleApi.getConnections(),
      ]);
      setStatus(nextStatus);
      setHousehold(nextHousehold);
      setConnections(nextConnections);
    } catch (error) {
      showToast(getApiErrorMessage(error, t, 'v2LoadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void refresh(); }, [refresh]);

  const candidates = useMemo(() => {
    const activeIds = new Set(household?.members.map((member) => member.userId) ?? []);
    return connections
      .map((connection) => memberFromConnection(connection, currentUserId, t('v2Relative')))
      .filter((member) => member.userId > 0 && !activeIds.has(member.userId));
  }, [connections, currentUserId, household?.members, t]);

  const addMember = useCallback(async (userId: number) => {
    setMemberBusy(userId);
    try {
      const next = await apiClient<Household>('/api/subscription-household/members', {
        method: 'POST',
        body: { user_id: userId },
      });
      setHousehold(next);
      setMemberModal(false);
      await refresh();
    } catch (error) {
      showToast(getApiErrorMessage(error, t, 'v2MemberUpdateError'), 'error');
    } finally {
      setMemberBusy(null);
    }
  }, [refresh, t]);

  const removeMember = useCallback(async (userId: number) => {
    setMemberBusy(userId);
    try {
      const next = await apiClient<Household>(`/api/subscription-household/members/${userId}`, {
        method: 'DELETE',
      });
      setHousehold(next);
      await refresh();
    } catch (error) {
      showToast(getApiErrorMessage(error, t, 'v2MemberUpdateError'), 'error');
    } finally {
      setMemberBusy(null);
    }
  }, [refresh, t]);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen options={{
        headerShown: true,
        title: t('v2PageTitle'),
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerLeft: () => <ScreenBackButton onPress={() => router.back()} />,
      }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><MaterialCommunityIcons name="shield-check" size={31} color="#fff" /></View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{t('v2HeroTitle')}</Text>
            <Text style={styles.heroBody}>{t('v2HeroBody')}</Text>
          </View>
        </View>

        <View style={styles.currentCard}>
          <Text style={styles.sectionLabel}>{t('v2CurrentPlan')}</Text>
          {loading ? <ActivityIndicator color={colors.primary} /> : (
            <>
              <View style={styles.currentRow}>
                <Text style={styles.currentName}>{status?.planName ?? t('v2FreePlan')}</Text>
                <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>{t('v2Active')}</Text></View>
              </View>
              <Text style={styles.currentMeta}>
                {status?.isAnTam
                  ? t('v2PaidMeta', {
                      used: status.protectedMemberCount,
                      limit: status.protectedMemberLimit,
                      expiry: status.expiresAt
                        ? t('v2PaidExpiry', {
                            date: new Date(status.expiresAt).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN'),
                          })
                        : '',
                    })
                  : t('v2FreeMeta')}
              </Text>
            </>
          )}
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.cardTitle}>{t('v2FreeTitle')}</Text>
          {FREE_FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={19} color={colors.success} />
              <Text style={styles.featureText}>{t(feature)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.cardTitle}>{t('v2AnTamTitle')}</Text>
          {AN_TAM_FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <MaterialCommunityIcons name="shield-check" size={19} color={colors.primary} />
              <Text style={styles.featureText}>{t(feature)}</Text>
            </View>
          ))}
        </View>

        <IapPurchaseCard
          currentPlanCode={status?.planCode}
          currentBillingPeriod={status?.billingPeriod}
          onPurchased={refresh}
        />

        <View style={styles.householdCard}>
          <View style={styles.householdHeader}>
            <View style={styles.householdTitleCopy}>
              <Text style={styles.cardTitle}>{t('v2ProtectedPeople')}</Text>
              <Text style={styles.householdMeta}>{t('v2SlotsUsed', { used: household?.protectedMemberCount ?? 0, limit: household?.protectedMemberLimit ?? 1 })}</Text>
            </View>
            {status?.isOwner && status.isAnTam && (
              <Pressable
                style={styles.addButton}
                disabled={
                  (household?.protectedMemberCount ?? 0) >=
                    (household?.protectedMemberLimit ?? 1) &&
                  !(household?.members ?? []).some(
                    (member) => member.userId === household?.ownerUserId
                  )
                }
                onPress={() => setMemberModal(true)}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addText}>{t('v2Add')}</Text>
              </Pressable>
            )}
          </View>
          {(household?.members ?? []).map((member) => (
            <View key={member.userId} style={styles.memberRow}>
              <View style={styles.memberAvatar}><Text style={styles.memberInitial}>{member.name.trim().charAt(0).toUpperCase()}</Text></View>
              <View style={styles.memberCopy}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberRole}>{member.userId === household?.ownerUserId ? t('v2Owner') : t('v2Protected')}</Text>
              </View>
              {status?.isOwner && member.userId !== household?.ownerUserId && (
                <Pressable onPress={() => removeMember(member.userId)} disabled={memberBusy === member.userId}>
                  {memberBusy === member.userId
                    ? <ActivityIndicator size="small" color={colors.textSecondary} />
                    : <Ionicons name="close-circle-outline" size={22} color={colors.textSecondary} />}
                </Pressable>
              )}
            </View>
          ))}
          {!status?.isAnTam && <Text style={styles.freeHint}>{t('v2FreeHint')}</Text>}
        </View>

        <Text style={styles.footerNote}>{t('v2EmergencyContactHint')}</Text>
      </ScrollView>

      <Modal visible={memberModal} transparent animationType="slide" onRequestClose={() => setMemberModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMemberModal(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('v2ChooseProtected')}</Text>
          <Text style={styles.sheetBody}>{t('v2ChooseProtectedBody')}</Text>
          {candidates.length === 0 ? (
            <Pressable style={styles.emptyCandidate} onPress={() => { setMemberModal(false); router.push('/care-circle/invite' as any); }}>
              <Ionicons name="person-add-outline" size={23} color={colors.primary} />
              <Text style={styles.emptyCandidateText}>{t('v2InviteToCircle')}</Text>
            </Pressable>
          ) : candidates.map((candidate) => (
            <Pressable key={candidate.userId} style={styles.candidateRow} onPress={() => addMember(candidate.userId)}>
              <View style={styles.memberAvatar}><Text style={styles.memberInitial}>{candidate.name.charAt(0).toUpperCase()}</Text></View>
              <Text style={styles.candidateName}>{candidate.name}</Text>
              {memberBusy === candidate.userId ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="add-circle" size={24} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  hero: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.primaryDark, flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  heroIcon: { width: 54, height: 54, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { color: '#fff', fontSize: typography.size.lg, fontWeight: '900' },
  heroBody: { marginTop: 5, color: 'rgba(255,255,255,0.84)', fontSize: typography.size.sm, lineHeight: 20 },
  currentCard: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  sectionLabel: { fontSize: typography.size.xxs, fontWeight: '800', letterSpacing: 1, color: colors.textSecondary },
  currentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  currentName: { fontSize: typography.size.xl, fontWeight: '900', color: colors.textPrimary },
  activeBadge: { backgroundColor: colors.emeraldLight, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.full },
  activeBadgeText: { color: colors.emerald, fontSize: typography.size.xxs, fontWeight: '800' },
  currentMeta: { color: colors.textSecondary, fontSize: typography.size.sm },
  featureCard: { marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  cardTitle: { fontSize: typography.size.md, fontWeight: '800', color: colors.textPrimary },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  featureText: { flex: 1, fontSize: typography.size.sm, lineHeight: 20, color: colors.textSecondary },
  householdCard: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  householdHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  householdTitleCopy: { gap: 3 },
  householdMeta: { fontSize: typography.size.xs, color: colors.textSecondary },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full },
  addText: { color: '#fff', fontSize: typography.size.xs, fontWeight: '800' },
  memberRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  memberAvatar: { width: 36, height: 36, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  memberInitial: { color: colors.primaryDark, fontWeight: '900' },
  memberCopy: { flex: 1 },
  memberName: { color: colors.textPrimary, fontSize: typography.size.sm, fontWeight: '700' },
  memberRole: { marginTop: 2, color: colors.textSecondary, fontSize: typography.size.xs },
  freeHint: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryLight, color: colors.primaryDark, fontSize: typography.size.xs, lineHeight: 18 },
  footerNote: { marginTop: spacing.md, textAlign: 'center', color: colors.textSecondary, fontSize: typography.size.xs },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.xl, paddingBottom: 38, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  sheetTitle: { fontSize: typography.size.lg, fontWeight: '900', color: colors.textPrimary },
  sheetBody: { marginTop: 4, marginBottom: spacing.md, fontSize: typography.size.sm, color: colors.textSecondary },
  candidateRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  candidateName: { flex: 1, fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary },
  emptyCandidate: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primaryLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyCandidateText: { color: colors.primaryDark, fontWeight: '800', fontSize: typography.size.sm },
});
