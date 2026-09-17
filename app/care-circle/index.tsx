import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { RippleRefreshScrollView } from '../../src/components/RippleRefresh';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Dropdown, DropdownOption } from '../../src/components/Dropdown';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { CareCircleTabSkeleton } from '../../src/components/state/MainScreenSkeletons';
import { useInitialLoadingGate } from '../../src/hooks/useInitialLoadingGate';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useLanguageStore } from '../../src/stores/language.store';
import { showToast } from '../../src/stores/toast.store';
import { useCareCircle } from '../../src/features/care-circle';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, iconColors, spacing, brandColors } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { getApiErrorMessage } from '../../src/lib/apiClient';

export default function CareCircleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((state) => state.profile);
  const { language } = useLanguageStore();
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();

  const {
    invitations,
    connections,
    loading,
    refreshing,
    cancelInvitation,
    acceptInvitation,
    rejectInvitation,
    deleteConnection,
    updateConnection,
    updatePermissions,
    refresh,
    fetchInvitations,
    fetchConnections,
  } = useCareCircle();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editConnection, setEditConnection] = useState<{
    id: string;
    relationship_type?: string;
    role?: string;
    name: string;
    permissions?: {
      can_view_logs: boolean;
      can_receive_alerts: boolean;
      can_ack_escalation: boolean;
    };
  } | null>(null);
  const [editRelationType, setEditRelationType] = useState<DropdownOption | null>(null);
  const [editRole, setEditRole] = useState<DropdownOption | null>(null);
  const [editPermissions, setEditPermissions] = useState({
    can_view_logs: true,
    can_receive_alerts: true,
    can_ack_escalation: true,
  });

  // Profile modal
  type ProfileTarget = {
    name: string;
    email?: string;
    phone?: string;
    relationship?: string;
    role?: string;
    invitationId?: string;
  };
  const [profileTarget, setProfileTarget] = useState<ProfileTarget | null>(null);

  // Relationship options
  const relationshipOptions: DropdownOption[] = [
    { id: 'vo', label: t('relWife'), subtitle: t('relSpouse') },
    { id: 'chong', label: t('relHusband'), subtitle: t('relSpouse') },
    { id: 'con-trai', label: t('relSon'), subtitle: t('relChild') },
    { id: 'con-gai', label: t('relDaughter'), subtitle: t('relChild') },
    { id: 'me', label: t('relMother'), subtitle: t('relParent') },
    { id: 'bo', label: t('relFather'), subtitle: t('relParent') },
    { id: 'anh-trai', label: t('relOlderBrother'), subtitle: t('relSibling') },
    { id: 'chi-gai', label: t('relOlderSister'), subtitle: t('relSibling') },
    { id: 'em-trai', label: t('relYoungerBrother'), subtitle: t('relSibling') },
    { id: 'em-gai', label: t('relYoungerSister'), subtitle: t('relSibling') },
    { id: 'ong-noi', label: t('relGrandfatherPaternal'), subtitle: t('relGrandparentPaternal') },
    { id: 'ba-noi', label: t('relGrandmotherPaternal'), subtitle: t('relGrandparentPaternal') },
    { id: 'ong-ngoai', label: t('relGrandfatherMaternal'), subtitle: t('relGrandparentMaternal') },
    { id: 'ba-ngoai', label: t('relGrandmotherMaternal'), subtitle: t('relGrandparentMaternal') },
    { id: 'ban-than', label: t('relBestFriend'), subtitle: t('relCloseFriend') },
    { id: 'nguoi-yeu', label: t('relPartner'), subtitle: t('relSoulmate') },
  ];

  // Role options
  const roleOptions: DropdownOption[] = [
    { id: 'nguoi-cham-soc', label: t('rolePrimaryCaregiver'), subtitle: t('roleCaregiverDesc') },
    { id: 'bac-si', label: t('roleFamilyDoctor'), subtitle: t('roleDoctorDesc') },
    { id: 'y-ta', label: t('roleNurse'), subtitle: t('roleNurseDesc') },
    { id: 'duoc-si', label: t('rolePharmacist'), subtitle: t('rolePharmacistDesc') },
    { id: 'chuyen-gia-dinh-duong', label: t('roleNutritionist'), subtitle: t('roleNutritionistDesc') },
    { id: 'huan-luyen-vien', label: t('roleTrainer'), subtitle: t('roleTrainerDesc') },
    { id: 'nguoi-ho-tro', label: t('roleHelper'), subtitle: t('roleHelperDesc') },
    { id: 'than-nhan', label: t('roleRelative'), subtitle: t('roleRelativeDesc') },
    { id: 'nguoi-giup-viec', label: t('roleHousekeeper'), subtitle: t('roleHousekeeperDesc') },
    { id: 'tu-van-tam-ly', label: t('roleCounselor'), subtitle: t('roleCounselorDesc') },
  ];

  const reverseRelationship = (relationshipType: string | undefined, otherGender?: string): string => {
    if (!relationshipType) return '';

    const isMale = otherGender === 'Nam';
    const isFemale = otherGender === 'Nữ';

    const symmetric: Record<string, string> = {
      'vo': t('relHusband'), 'Vợ': t('relHusband'),
      'chong': t('relWife'), 'Chồng': t('relWife'),
      'ban-than': t('relBestFriend'), 'Bạn thân': t('relBestFriend'),
      'nguoi-yeu': t('relPartner'), 'Người yêu': t('relPartner'),
    };
    if (symmetric[relationshipType]) return symmetric[relationshipType];

    const parentSet = new Set(['bo', 'Bố', 'me', 'Mẹ']);
    const childSet = new Set(['con-trai', 'Con trai', 'con-gai', 'Con gái']);
    if (parentSet.has(relationshipType)) {
      if (isMale) return t('relSon');
      if (isFemale) return t('relDaughter');
      return relationshipType;
    }
    if (childSet.has(relationshipType)) {
      if (isMale) return t('relFather');
      if (isFemale) return t('relMother');
      return relationshipType;
    }

    const olderSet = new Set(['anh-trai', 'Anh trai', 'chi-gai', 'Chị gái']);
    const youngerSet = new Set(['em-trai', 'Em trai', 'em-gai', 'Em gái']);
    if (olderSet.has(relationshipType)) {
      if (isMale) return t('relYoungerBrother');
      if (isFemale) return t('relYoungerSister');
      return relationshipType;
    }
    if (youngerSet.has(relationshipType)) {
      if (isMale) return t('relOlderBrother');
      if (isFemale) return t('relOlderSister');
      return relationshipType;
    }

    const grandparentSet = new Set(['ong-noi', 'Ông nội', 'ba-noi', 'Bà nội', 'ong-ngoai', 'Ông ngoại', 'ba-ngoai', 'Bà ngoại']);
    if (grandparentSet.has(relationshipType)) {
      if (isMale) return t('relGrandson');
      if (isFemale) return t('relGranddaughter');
      return relationshipType;
    }

    return relationshipType;
  };

  const getRelationshipLabel = (relationshipType: string | undefined): string => {
    if (!relationshipType) return '';
    const option = relationshipOptions.find(
      opt => opt.id === relationshipType || opt.label === relationshipType
    );
    return option?.label || relationshipType;
  };

  useFocusEffect(
    useCallback(() => {
      fetchInvitations(true);
      fetchConnections(true);
    }, [fetchInvitations, fetchConnections])
  );

  const handleAccept = async (id: string) => {
    try {
      setActionLoading(id);
      await acceptInvitation(id);
      showToast(t('acceptSuccess'), 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error, t, 'acceptError'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: string) => {
    showAlert(
      t('cancelInviteTitle') || 'Huỷ lời mời',
      t('cancelInviteMsg') || 'Bạn có chắc muốn huỷ lời mời này?',
      [
        { text: tc('cancel'), style: 'cancel' },
        {
          text: t('cancelInvite') || 'Huỷ lời mời',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(id);
              await cancelInvitation(id);
              showToast(t('cancelSuccess') || 'Đã huỷ lời mời', 'success');
            } catch {
              showToast(t('cancelError') || 'Không thể huỷ lời mời', 'error');
            } finally {
              setActionLoading(null);
            }
          }
        }
      ]
    );
  };

  const handleReject = async (id: string) => {
    try {
      setActionLoading(id);
      await rejectInvitation(id);
      showToast(t('rejectSuccess'), 'success');
    } catch (error) {
      const msg = (error as Error)?.message?.trim();
      showToast(msg || t('rejectError'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConnection = async (id: string, name: string) => {
    showAlert(
      t('confirmDelete'),
      t('confirmDeleteMsg', { name }),
      [
        { text: tc('cancel'), style: 'cancel' },
        {
          text: tc('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(id);
              await deleteConnection(id);
              showToast(t('deletedMsg'), 'success');
            } catch (error) {
              showToast(t('deleteError'), 'error');
            } finally {
              setActionLoading(null);
            }
          }
        }
      ]
    );
  };

  const handleEditConnection = (connection: any) => {
    setEditConnection(connection);
    const relOption = relationshipOptions.find(
      opt => opt.id === connection.relationship_type || opt.label === connection.relationship_type
    );
    const roleOption = roleOptions.find(
      opt => opt.id === connection.role || opt.label === connection.role
    );
    setEditRelationType(relOption || null);
    setEditRole(roleOption || null);
    setEditPermissions({
      can_view_logs: connection.permissions?.can_view_logs ?? true,
      can_receive_alerts: connection.permissions?.can_receive_alerts ?? true,
      can_ack_escalation: connection.permissions?.can_ack_escalation ?? true,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editConnection) return;
    try {
      setActionLoading(editConnection.id);
      await Promise.all([
        updateConnection(editConnection.id, {
          relationship_type: editRelationType?.id,
          role: editRole?.id,
        }),
        updatePermissions(editConnection.id, editPermissions),
      ]);
      setEditModalVisible(false);
      showToast(t('editSuccess'), 'success');
    } catch {
      showToast(t('editError'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const receivedInvitations = invitations.filter(
    (inv) => String(inv.addressee_id) === String(profile?.id) && inv.status === 'pending'
  );
  const sentInvitations = invitations.filter(
    (inv) => String(inv.requester_id) === String(profile?.id) && inv.status === 'pending'
  );
  const showInitialSkeleton = useInitialLoadingGate(
    !(loading || refreshing),
    650,
    Boolean(connections.length || invitations.length),
  );

  return (
    <>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
      <Stack.Screen options={{ headerShown: false }} />
      <Screen style={styles.screen}>
        {/* Custom Header matching design */}
        <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 20) + 10 }]}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{t('title')}</Text>
            <Text style={styles.headerSubtitle}>{t('headerSubtitle')}</Text>
          </View>
        </View>

        <RippleRefreshScrollView
          refreshing={refreshing}
          onRefresh={refresh}
          style={styles.container}
          contentContainerStyle={{
            paddingTop: spacing.xs,
            paddingBottom: 110,
          }}
          showsVerticalScrollIndicator={false}
        >
          {showInitialSkeleton ? (
            <CareCircleTabSkeleton />
          ) : (
            <>
              {/* Hero Banner Card */}
              <View style={styles.heroCardShadowWrap}>
                <LinearGradient
                  colors={['#F3FCFB', '#E2F6F2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.heroCardContainer}
                >
                  {/* Right: 3D Family Illustration */}
                  <Image
                    source={require('../../assets/images/care-circle/family_3d_art.png')}
                    style={styles.heroFamilyImage}
                    resizeMode="contain"
                  />

                  {/* Left: Native Texts & Calligraphic Quote */}
                  <View style={styles.heroTextContent}>
                    <Text style={styles.heroCardTitle}>{t('title')}</Text>
                    <Text style={styles.heroCardSubtitle}>{t('headerSubtitle')}</Text>
                    <View style={styles.heroQuoteWrapper}>
                      <Image
                        source={
                          language === 'en'
                            ? require('../../assets/images/care-circle/hero_quote_en.png')
                            : require('../../assets/images/care-circle/hero_quote_vi.png')
                        }
                        style={styles.heroQuoteImage}
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                </LinearGradient>
              </View>

              {/* Stats Card: 3 Columns */}
              <View style={styles.statsCard}>
                <View style={styles.statColumn}>
                  <View style={styles.statIconWrap}>
                    <Ionicons name="people" size={26} color="#0D9488" />
                  </View>
                  <Text style={styles.statColLabel}>{t('connections')}</Text>
                  <Text style={styles.statColValue}>{connections.length}</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statColumn}>
                  <View style={styles.statIconWrap}>
                    <Ionicons name="mail" size={24} color="#D97706" />
                  </View>
                  <Text style={styles.statColLabel}>{t('received')}</Text>
                  <Text style={styles.statColValue}>{receivedInvitations.length}</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statColumn}>
                  <View style={styles.statIconWrap}>
                    <Ionicons name="send" size={22} color="#2563EB" />
                  </View>
                  <Text style={styles.statColLabel}>{t('sent')}</Text>
                  <Text style={styles.statColValue}>{sentInvitations.length}</Text>
                </View>
              </View>

              {/* Quick Action Banner: Mời người mới */}
              <TouchableOpacity
                style={styles.inviteBanner}
                activeOpacity={0.88}
                onPress={() => router.push('/care-circle/invite')}
              >
                <Image
                  source={require('../../assets/images/care-circle/invite_girl.png')}
                  style={styles.inviteGirlImage}
                  resizeMode="contain"
                />
                <View style={styles.inviteBannerCopy}>
                  <Text style={styles.inviteBannerTitle}>{t('inviteNew')}</Text>
                  <Text style={styles.inviteBannerSubtitle} numberOfLines={1}>
                    {t('inviteNewSubtitle')}
                  </Text>
                </View>
                <View style={styles.invitePillButton}>
                  <Text style={styles.invitePillText}>{t('inviteNow')}</Text>
                  <Ionicons name="chevron-forward" size={13} color="#FFFFFF" style={{ marginLeft: 2 }} />
                </View>
              </TouchableOpacity>

              {/* Received Invitations (if any) */}
              {receivedInvitations.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="mail-unread" size={18} color="#D97706" />
                    <Text style={styles.sectionTitle}>
                      {t('receivedInvitations', { count: receivedInvitations.length })}
                    </Text>
                  </View>
                  {receivedInvitations.map((invitation) => {
                    const requesterName =
                      invitation.requester_full_name ||
                      invitation.requester_name ||
                      invitation.requester_email ||
                      `#${invitation.requester_id}`;
                    return (
                      <TouchableOpacity
                        key={invitation.id}
                        style={styles.card}
                        onPress={() =>
                          setProfileTarget({
                            name: requesterName,
                            email: invitation.requester_email,
                            phone: invitation.requester_phone,
                            relationship:
                              reverseRelationship(invitation.relationship_type, invitation.requester_gender) ||
                              invitation.relationship_type,
                            role: invitation.role,
                          })
                        }
                        activeOpacity={0.75}
                      >
                        <View style={styles.cardHeader}>
                          <View style={[styles.avatar, { backgroundColor: '#FFF2E8' }]}>
                            <Text style={[styles.avatarText, { color: '#D97706' }]}>
                              {requesterName[0]?.toUpperCase() || '?'}
                            </Text>
                          </View>
                          <View style={styles.cardInfo}>
                            <Text style={styles.cardName}>{requesterName}</Text>
                            <View style={styles.cardBadge}>
                              <Ionicons name="link" size={12} color="#0D9488" />
                              <Text style={styles.cardRelation}>
                                {reverseRelationship(
                                  invitation.relationship_type,
                                  invitation.requester_gender
                                ) ||
                                  invitation.role ||
                                  t('connection')}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.cardActions}>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.acceptButton]}
                            onPress={() => handleAccept(invitation.id)}
                            disabled={actionLoading === invitation.id}
                          >
                            {actionLoading === invitation.id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Ionicons name="checkmark" size={16} color="#fff" />
                                <Text style={styles.acceptButtonText}>{t('accept')}</Text>
                              </>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.rejectButton]}
                            onPress={() => handleReject(invitation.id)}
                            disabled={actionLoading === invitation.id}
                          >
                            <Ionicons name="close" size={16} color={colors.textSecondary} />
                            <Text style={styles.rejectButtonText}>{t('reject')}</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Sent Invitations (if any) */}
              {sentInvitations.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="send" size={16} color="#2563EB" />
                    <Text style={styles.sectionTitle}>
                      {t('sentInvitations', { count: sentInvitations.length })}
                    </Text>
                  </View>
                  {sentInvitations.map((invitation) => {
                    const name =
                      invitation.addressee_full_name ||
                      invitation.addressee_name ||
                      invitation.addressee_email ||
                      `#${invitation.addressee_id}`;
                    return (
                      <TouchableOpacity
                        key={invitation.id}
                        style={[styles.card, styles.cardPending]}
                        onPress={() =>
                          setProfileTarget({
                            name,
                            email: invitation.addressee_email,
                            phone: invitation.addressee_phone,
                            relationship: invitation.relationship_type,
                            role: invitation.role,
                            invitationId: invitation.id,
                          })
                        }
                        activeOpacity={0.75}
                      >
                        <View style={styles.cardHeader}>
                          <View style={[styles.avatar, { backgroundColor: '#EBF3FE' }]}>
                            <Text style={[styles.avatarText, { color: '#2563EB' }]}>
                              {name[0]?.toUpperCase() || '?'}
                            </Text>
                          </View>
                          <View style={styles.cardInfo}>
                            <Text style={styles.cardName}>{name}</Text>
                            <View style={styles.pendingBadge}>
                              <Ionicons name="time" size={12} color="#D97706" />
                              <Text style={styles.cardStatus}>{t('waitingResponse')}</Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => handleCancel(invitation.id)}
                            disabled={actionLoading === invitation.id}
                          >
                            {actionLoading === invitation.id ? (
                              <ActivityIndicator size="small" color={iconColors.danger} />
                            ) : (
                              <Ionicons name="close-circle" size={22} color={iconColors.danger} />
                            )}
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Active Connections Section */}
              <View style={styles.activeSection}>
                <View style={styles.activeSectionHeader}>
                  <Ionicons name="people" size={20} color="#0D9488" />
                  <Text style={styles.activeSectionTitle}>
                    {t('activeConnections', { count: connections.length })}
                  </Text>
                </View>

                {(loading || refreshing) && connections.length === 0 ? (
                  <ActivityIndicator size="large" color="#0D9488" style={styles.loader} />
                ) : connections.length === 0 ? (
                  /* Empty State Card matching design */
                  <View style={styles.emptyCard}>
                    <Image
                      source={require('../../assets/images/care-circle/empty_state_art.png')}
                      style={styles.emptyStateImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.emptyTitle}>{t('noConnections')}</Text>
                    <Text style={styles.emptySubtitle}>{t('noConnectionsHint')}</Text>
                    <TouchableOpacity
                      style={styles.emptyInviteButton}
                      activeOpacity={0.8}
                      onPress={() => router.push('/care-circle/invite')}
                    >
                      <Ionicons name="add" size={18} color="#0D9488" style={{ marginRight: 4 }} />
                      <Text style={styles.emptyInviteButtonText}>{t('inviteMemberNew')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Active Connection Cards */
                  <View style={styles.connectionsList}>
                    {connections.map((connection) => {
                      const isRequester = String(connection.requester_id) === String(profile?.id);
                      const otherUserId = isRequester ? connection.addressee_id : connection.requester_id;
                      const otherUserFullName = isRequester
                        ? connection.addressee_full_name
                        : connection.requester_full_name;
                      const otherUserEmail = isRequester
                        ? connection.addressee_email
                        : connection.requester_email;
                      const otherUserPhone = isRequester
                        ? connection.addressee_phone
                        : connection.requester_phone;

                      const displayRelationship = isRequester
                        ? getRelationshipLabel(connection.relationship_type)
                        : reverseRelationship(connection.relationship_type, connection.requester_gender);

                      const otherName = otherUserFullName || otherUserEmail || `#${otherUserId}`;

                      return (
                        <TouchableOpacity
                          key={connection.id}
                          style={styles.connectionCard}
                          onPress={() =>
                            router.push({
                              pathname: '/care-circle/member/[id]',
                              params: { id: String(otherUserId), name: otherName },
                            })
                          }
                          activeOpacity={0.75}
                        >
                          <View style={styles.connectionCardHeader}>
                            <View style={styles.connectionAvatar}>
                              <Text style={styles.connectionAvatarText}>
                                {otherName[0]?.toUpperCase() || '?'}
                              </Text>
                            </View>

                            <View style={styles.connectionCardInfo}>
                              <Text style={styles.connectionCardName} numberOfLines={1}>
                                {otherName}
                              </Text>

                              {(displayRelationship || connection.role) && (
                                <View style={styles.connectionBadge}>
                                  <Ionicons name="heart" size={11} color="#0D9488" />
                                  <Text style={styles.connectionBadgeText}>
                                    {displayRelationship || connection.role}
                                  </Text>
                                </View>
                              )}

                              {otherUserPhone && (
                                <View style={styles.contactRow}>
                                  <Ionicons name="call-outline" size={12} color={colors.textSecondary} />
                                  <Text style={styles.cardContact}>{otherUserPhone}</Text>
                                </View>
                              )}
                              {otherUserEmail && (
                                <View style={styles.contactRow}>
                                  <Ionicons name="mail-outline" size={12} color={colors.textSecondary} />
                                  <Text style={styles.cardContact} numberOfLines={1}>
                                    {otherUserEmail}
                                  </Text>
                                </View>
                              )}
                            </View>

                            <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityLabel={tc('notificationMoreActions')}
                              onPress={() => {
                                const options: any[] = [];
                                if (isRequester) {
                                  options.push({
                                    text: t('editConnection') || 'Chỉnh sửa kết nối',
                                    onPress: () =>
                                      handleEditConnection({
                                        ...connection,
                                        name: otherUserFullName || `User ${otherUserId}`,
                                      }),
                                  });
                                }
                                options.push(
                                  {
                                    text: tc('delete') || 'Xóa',
                                    style: 'destructive',
                                    onPress: () => handleDeleteConnection(connection.id, otherName),
                                  },
                                  { text: tc('cancel') || 'Hủy', style: 'cancel' }
                                );
                                showAlert('Tùy chọn', `Thao tác với ${otherName}`, options);
                              }}
                              style={styles.moreActionsBtn}
                            >
                              {actionLoading === connection.id ? (
                                <ActivityIndicator size="small" color={colors.textSecondary} />
                              ) : (
                                <Ionicons
                                  name="ellipsis-vertical"
                                  size={18}
                                  color={colors.textSecondary}
                                />
                              )}
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}
        </RippleRefreshScrollView>

        {/* Floating Action Button (+) */}
        <TouchableOpacity
          style={[styles.floatingActionButton, { bottom: Math.max(insets.bottom, 16) + 72 }]}
          activeOpacity={0.85}
          onPress={() => router.push('/care-circle/invite')}
        >
          <FontAwesome name="plus" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Profile Modal */}
        <Modal
          visible={!!profileTarget}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setProfileTarget(null)}
        >
          <View style={styles.profileOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setProfileTarget(null)} />
            <View style={[styles.profileSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
              <View style={styles.profileHandle} />
              <View style={[styles.profileAvatar, { backgroundColor: '#E4F8F4' }]}>
                <Text style={[styles.profileAvatarText, { color: '#0D9488' }]}>
                  {profileTarget?.name?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={styles.profileName}>{profileTarget?.name}</Text>
              {profileTarget?.relationship ? (
                <View style={styles.profileBadge}>
                  <Ionicons name="heart" size={13} color="#0D9488" />
                  <Text style={styles.profileBadgeText}>{profileTarget.relationship}</Text>
                </View>
              ) : null}
              {profileTarget?.role ? (
                <View style={[styles.profileBadge, { backgroundColor: '#FFF2E8' }]}>
                  <Ionicons name="briefcase-outline" size={13} color="#D97706" />
                  <Text style={[styles.profileBadgeText, { color: '#D97706' }]}>
                    {profileTarget.role}
                  </Text>
                </View>
              ) : null}
              <View style={styles.profileInfoList}>
                {profileTarget?.email ? (
                  <View style={styles.profileInfoRow}>
                    <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.profileInfoText}>{profileTarget.email}</Text>
                  </View>
                ) : null}
                {profileTarget?.phone ? (
                  <View style={styles.profileInfoRow}>
                    <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.profileInfoText}>{profileTarget.phone}</Text>
                  </View>
                ) : null}
                {!profileTarget?.email && !profileTarget?.phone ? (
                  <Text style={styles.profileNoInfo}>
                    {t('noContactInfo') || 'Không có thông tin liên hệ'}
                  </Text>
                ) : null}
              </View>
              {profileTarget?.invitationId ? (
                <TouchableOpacity
                  style={styles.cancelInviteBtn}
                  onPress={() => {
                    const id = profileTarget.invitationId!;
                    setProfileTarget(null);
                    handleCancel(id);
                  }}
                >
                  <Ionicons name="close-circle-outline" size={18} color={iconColors.danger} />
                  <Text style={styles.cancelInviteBtnText}>
                    {t('cancelInvite') || 'Huỷ lời mời'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.profileCloseBtn}
                onPress={() => setProfileTarget(null)}
              >
                <Text style={styles.profileCloseBtnText}>{tc('close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Edit Connection Modal */}
        <Modal
          visible={editModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setEditModalVisible(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="person" size={24} color={iconColors.indigo} />
                <Text style={styles.modalTitle}>{t('editConnection')}</Text>
                <Text style={styles.modalSubtitle}>{editConnection?.name}</Text>
              </View>

              <View style={styles.currentInfoBox}>
                <Text style={styles.currentInfoTitle}>{t('currentInfo')}</Text>
                <Text style={styles.currentInfoText}>
                  {t('relationship')}: {editRelationType?.label || t('notSet')}
                </Text>
                <Text style={styles.currentInfoText}>
                  {t('role')}: {editRole?.label || t('notSet')}
                </Text>
              </View>

              <View style={styles.modalSection}>
                <Dropdown
                  label={t('relationship')}
                  placeholder={t('relationshipPlaceholder')}
                  options={relationshipOptions}
                  value={editRelationType}
                  onChange={setEditRelationType}
                  searchable
                />
              </View>

              <View style={styles.modalSection}>
                <Dropdown
                  label={t('role')}
                  placeholder={t('rolePlaceholder')}
                  options={roleOptions}
                  value={editRole}
                  onChange={setEditRole}
                  searchable
                />
              </View>

              <View style={styles.modalSection}>
                <Text style={[styles.currentInfoTitle, { marginBottom: spacing.sm }]}>
                  {t('permissions')}
                </Text>
                {[
                  {
                    key: 'can_view_logs' as const,
                    icon: 'eye-outline',
                    color: '#3b82f6',
                    label: t('permViewLogs'),
                  },
                  {
                    key: 'can_receive_alerts' as const,
                    icon: 'notifications-outline',
                    color: '#f59e0b',
                    label: t('permReceiveAlerts'),
                  },
                  {
                    key: 'can_ack_escalation' as const,
                    icon: 'shield-checkmark-outline',
                    color: '#10b981',
                    label: t('permAckEscalation'),
                  },
                ].map((perm) => (
                  <View key={perm.key} style={styles.permRow}>
                    <Ionicons
                      name={perm.icon as any}
                      size={20}
                      color={perm.color}
                      style={{ marginRight: spacing.sm }}
                    />
                    <Text style={styles.permLabel}>{perm.label}</Text>
                    <Switch
                      value={editPermissions[perm.key]}
                      onValueChange={(val) =>
                        setEditPermissions((prev) => ({ ...prev, [perm.key]: val }))
                      }
                      trackColor={{ false: colors.border, true: perm.color + '55' }}
                      thumbColor={editPermissions[perm.key] ? perm.color : colors.textSecondary}
                    />
                  </View>
                ))}
              </View>

              <View style={styles.buttonGroup}>
                <Button
                  label={tc('cancel')}
                  variant="ghost"
                  onPress={() => setEditModalVisible(false)}
                  style={{ flex: 1, borderColor: colors.textSecondary }}
                  textStyle={{ color: colors.textSecondary }}
                />
                <Button
                  label={tc('save')}
                  variant="primary"
                  onPress={handleSaveEdit}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </Screen>
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  const androidCardSurface = Platform.select({
    android: {
      backgroundColor: '#FFFFFF',
      elevation: 2,
    },
    default: {
      backgroundColor: '#FFFFFF',
    },
  })!;

  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    // Top Header matching design
    topHeader: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: 'transparent',
    },
    headerTitleWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 3,
    },
    // Hero Banner Card
    heroCardShadowWrap: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: 24,
      shadowColor: '#0D7A68',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
    },
    heroCardContainer: {
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#D6F2EB',
      height: 168,
      position: 'relative',
      justifyContent: 'center',
    },
    heroFamilyImage: {
      position: 'absolute',
      right: -2,
      bottom: 0,
      top: 0,
      width: '60%',
      height: '100%',
    },
    heroTextContent: {
      paddingLeft: 18,
      paddingVertical: 14,
      width: '52%',
      justifyContent: 'center',
      zIndex: 2,
    },
    heroCardTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#0D7A68',
      letterSpacing: -0.2,
    },
    heroCardSubtitle: {
      fontSize: 12,
      fontWeight: '500',
      color: '#4B5563',
      marginTop: 4,
      lineHeight: 16,
    },
    heroQuoteWrapper: {
      marginTop: 10,
    },
    heroQuoteImage: {
      width: 140,
      height: 50,
      alignSelf: 'flex-start',
    },
    // Stats Card: 3 Columns
    statsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: 24,
      paddingVertical: 18,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: '#EEF2F4',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      ...androidCardSurface,
    },
    statColumn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statIconWrap: {
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statColLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
      marginTop: 4,
    },
    statColValue: {
      fontSize: 20,
      color: colors.textPrimary,
      fontWeight: '700',
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 44,
      backgroundColor: '#EEF2F4',
    },
    // Quick Action Banner
    inviteBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#E8F7F4',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      borderRadius: 22,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: '#D4F0EA',
    },
    inviteGirlImage: {
      width: 76,
      height: 68,
    },
    inviteBannerCopy: {
      flex: 1,
      paddingHorizontal: 10,
      justifyContent: 'center',
    },
    inviteBannerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#0D5A50',
    },
    inviteBannerSubtitle: {
      fontSize: 12,
      color: '#6B7280',
      marginTop: 2,
    },
    invitePillButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#0D9488',
      borderRadius: 20,
      paddingVertical: 7,
      paddingHorizontal: 14,
    },
    invitePillText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    // Active Connections Section
    activeSection: {
      marginBottom: spacing.lg,
    },
    activeSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      gap: 8,
      marginBottom: spacing.sm + 2,
    },
    activeSectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    emptyCard: {
      marginHorizontal: spacing.lg,
      borderRadius: 24,
      paddingVertical: 32,
      paddingHorizontal: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#EEF2F4',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      ...androidCardSurface,
    },
    emptyStateImage: {
      width: 140,
      height: 100,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 20,
    },
    emptyInviteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F0FAF8',
      borderWidth: 1.5,
      borderColor: '#BFE9E0',
      borderRadius: 24,
      paddingVertical: 10,
      paddingHorizontal: 22,
    },
    emptyInviteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#0D9488',
    },
    // Connections List
    connectionsList: {
      marginHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    connectionCard: {
      borderRadius: 20,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: '#EEF2F4',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      ...androidCardSurface,
    },
    connectionCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    connectionAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#E4F8F4',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#D0F2E9',
    },
    connectionAvatarText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#0D9488',
    },
    connectionCardInfo: {
      flex: 1,
    },
    connectionCardName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    connectionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#E6F8F5',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      alignSelf: 'flex-start',
      marginTop: 4,
      marginBottom: 2,
    },
    connectionBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#0D9488',
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    cardContact: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    moreActionsBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Generic Section & Cards (Invitations)
    section: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm + 2,
    },
    sectionTitle: {
      fontSize: typography.size.md,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    card: {
      borderRadius: 18,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: '#EEF2F4',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      ...androidCardSurface,
      gap: spacing.xs,
    },
    cardPending: {
      backgroundColor: '#FAFAFA',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: typography.size.md,
      fontWeight: '700',
    },
    cardInfo: {
      flex: 1,
    },
    cardName: {
      fontSize: typography.size.md,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    cardBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
      backgroundColor: '#E6F8F5',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      alignSelf: 'flex-start',
    },
    cardRelation: {
      fontSize: typography.size.xs,
      color: '#0D9488',
      fontWeight: '500',
    },
    pendingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    cardStatus: {
      fontSize: typography.size.xs,
      color: '#D97706',
      fontWeight: '500',
    },
    cancelBtn: {
      padding: 4,
      marginLeft: spacing.sm,
    },
    cardActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 12,
      minHeight: 38,
    },
    acceptButton: {
      backgroundColor: '#0D9488',
    },
    acceptButtonText: {
      color: '#fff',
      fontSize: typography.size.sm,
      fontWeight: '600',
    },
    rejectButton: {
      backgroundColor: colors.surfaceMuted,
    },
    rejectButtonText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: '600',
    },
    loader: {
      marginVertical: spacing.xl,
    },
    // Floating Action Button (+)
    floatingActionButton: {
      position: 'absolute',
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#0D9488',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: '#0D9488',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      zIndex: 99,
    },
    // Profile modal
    profileOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    profileSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      alignItems: 'center',
    },
    profileHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: spacing.lg,
    },
    profileAvatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    profileAvatarText: {
      fontSize: 30,
      fontWeight: '700',
      color: '#0D9488',
    },
    profileName: {
      fontSize: typography.size.lg,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    profileBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#E6F8F5',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      marginBottom: spacing.xs,
    },
    profileBadgeText: {
      fontSize: typography.size.sm,
      color: '#0D9488',
      fontWeight: '600',
    },
    profileInfoList: {
      width: '100%',
      gap: spacing.sm,
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    profileInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6',
    },
    profileInfoText: {
      fontSize: typography.size.md,
      color: colors.textPrimary,
      flex: 1,
    },
    profileNoInfo: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
    cancelInviteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderWidth: 1.5,
      borderColor: colors.danger + '60',
      borderRadius: 12,
      marginBottom: spacing.sm,
      width: '100%',
      justifyContent: 'center',
    },
    cancelInviteBtnText: {
      fontSize: typography.size.md,
      color: colors.danger,
      fontWeight: '600',
    },
    profileCloseBtn: {
      paddingVertical: spacing.md,
      width: '100%',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    profileCloseBtnText: {
      fontSize: typography.size.md,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    modalContent: {
      padding: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
    },
    modalHeader: {
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalSubtitle: {
      fontSize: typography.size.md,
      color: colors.textSecondary,
    },
    modalSection: {
      marginBottom: spacing.lg,
    },
    buttonGroup: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    permRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    permLabel: {
      flex: 1,
      fontSize: typography.size.md,
      color: colors.textPrimary,
    },
    currentInfoBox: {
      backgroundColor: brandColors.cyan + '18',
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderWidth: 1.5,
      borderColor: '#bae6fd',
    },
    currentInfoTitle: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: '#0369a1',
      marginBottom: spacing.xs,
    },
    currentInfoText: {
      fontSize: typography.size.sm,
      color: '#0c4a6e',
      marginTop: spacing.xs / 2,
    },
  });
}
