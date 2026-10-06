import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { Dropdown, DropdownOption } from '../../src/components/Dropdown';
import { AppAlertModal, useAppAlert, type AlertButton } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { CareCircleTabSkeleton } from '../../src/components/state/MainScreenSkeletons';
import { useInitialLoadingGate } from '../../src/hooks/useInitialLoadingGate';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useLanguageStore } from '../../src/stores/language.store';
import { showToast } from '../../src/stores/toast.store';
import { useCareCircle } from '../../src/features/care-circle';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, iconColors, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { getApiErrorMessage } from '../../src/lib/apiClient';
import { getConnectionHealthAccess } from '../../src/features/care-circle/health-access';
import { getFamilyRoleLabel, getFamilyRoleOptions } from '../../src/features/care-circle/family-roles';
import { getConnectionEditChanges, type ConnectionEditValues } from '../../src/features/care-circle/connection-edit';
import { CareCircleQrActions } from '../../src/features/care-circle/components/CareCircleQrActions';
import Svg, { Path } from 'react-native-svg';

function ShieldXIcon({ color = '#475569', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m14.5 9.5-5 5m0-5 5 5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ShieldCheckIcon({ color = '#0D9488', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m9 12 2 2 4-4"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function CareCircleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((state) => state.profile);
  const { language } = useLanguageStore();
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography, isDark), [scaledTypography, isDark]);
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
  const [savedEditValues, setSavedEditValues] = useState<ConnectionEditValues | null>(null);
  const editSaveInFlight = useRef(false);
  const editValues: ConnectionEditValues = {
    relationship_type: editRelationType?.id,
    role: editRole?.id,
    permissions: editPermissions,
  };
  const editChanges = savedEditValues && getConnectionEditChanges(savedEditValues, editValues);
  const isEditSaving = actionLoading === editConnection?.id;
  const editSaveDisabled = !editConnection || !editChanges?.hasChanges || actionLoading !== null;

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
  const roleOptions = getFamilyRoleOptions(t);

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
      t('cancelInviteTitle'),
      t('cancelInviteMsg'),
      [
        { text: tc('cancel'), style: 'cancel' },
        {
          text: t('cancelInvite'),
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(id);
              await cancelInvitation(id);
              showToast(t('cancelSuccess'), 'success');
            } catch {
              showToast(t('cancelError'), 'error');
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
    if (editSaveInFlight.current) {
      return;
    }
    setEditConnection(connection);
    const relOption = relationshipOptions.find(
      opt => opt.id === connection.relationship_type || opt.label === connection.relationship_type
    );
    const roleOption = roleOptions.find(
      opt => opt.label === getFamilyRoleLabel(connection.role, t)
    );
    setEditRelationType(relOption || null);
    setEditRole(roleOption || null);
    const permissions = {
      can_view_logs: connection.permissions?.can_view_logs === true,
      can_receive_alerts: connection.permissions?.can_receive_alerts ?? true,
      can_ack_escalation: connection.permissions?.can_ack_escalation ?? true,
    };
    setEditPermissions(permissions);
    setSavedEditValues({
      relationship_type: relOption?.id,
      role: roleOption?.id,
      permissions,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editConnection || editSaveDisabled || !editChanges || editSaveInFlight.current) {
      return;
    }
    editSaveInFlight.current = true;
    try {
      setActionLoading(editConnection.id);
      if (Object.keys(editChanges.updates).length > 0) {
        await updateConnection(editConnection.id, editChanges.updates);
        // Retain successful changes if the permission update fails, so retry
        // only sends the portion that is still unsaved.
        setSavedEditValues(previous => previous && { ...previous, ...editChanges.updates });
      }
      if (editChanges.permissionsChanged) {
        await updatePermissions(editConnection.id, editValues.permissions);
        setSavedEditValues(previous => previous && { ...previous, permissions: editValues.permissions });
      }
      setEditModalVisible(false);
      showToast(t('editSuccess'), 'success');
    } catch {
      showToast(t('editError'), 'error');
    } finally {
      editSaveInFlight.current = false;
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
      <AppAlertModal {...alertState} queued onDismiss={dismissAlert} />
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
                  <Text style={styles.inviteBannerSubtitle} numberOfLines={2}>
                    {t('inviteNewSubtitle')}
                  </Text>
                </View>
                <View style={styles.invitePillButton}>
                  <Text style={styles.invitePillText}>{t('inviteNow')}</Text>
                  <Ionicons name="chevron-forward" size={13} color="#FFFFFF" style={{ marginLeft: 2 }} />
                </View>
              </TouchableOpacity>

              <CareCircleQrActions
                onShowQr={() => router.push('/care-circle/qr' as never)}
                onScanQr={() => router.push('/care-circle/scan' as never)}
              />

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
                            role: getFamilyRoleLabel(invitation.role, t),
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
                                  getFamilyRoleLabel(invitation.role, t) ||
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
                            role: getFamilyRoleLabel(invitation.role, t),
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
                      const healthAccess = getConnectionHealthAccess(connection, profile?.id);
                      const displayRole = getFamilyRoleLabel(connection.role, t);
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

                      const otherName = otherUserFullName || otherUserEmail || t('thisPerson');

                      return (
                        <View
                          key={connection.id}
                          style={styles.connectionCard}
                        >
                          {/* Header: Avatar, Name, Relationship Badge & 3-Dots */}
                          <View style={styles.connectionCardHeader}>
                            <TouchableOpacity
                              style={styles.connectionHeaderLeft}
                              activeOpacity={0.75}
                              onPress={() =>
                                healthAccess.canViewTheirs
                                  ? router.push({
                                      pathname: '/care-circle/member/[id]',
                                      params: { id: String(otherUserId), name: otherName },
                                    })
                                  : showAlert(t('healthProfilePrivate'), t('healthAccessRequired'))
                              }
                            >
                              <View style={styles.connectionAvatar}>
                                <Text style={styles.connectionAvatarText}>
                                  {otherName[0]?.toUpperCase() || '?'}
                                </Text>
                              </View>

                              <View style={styles.connectionCardInfo}>
                                <Text style={styles.connectionCardName} numberOfLines={1}>
                                  {otherName}
                                </Text>

                                {(displayRelationship || displayRole) && (
                                  <View style={styles.connectionBadge}>
                                    <Ionicons name="heart" size={13} color={isDark ? '#5EEAD4' : '#0D9488'} />
                                    <Text style={styles.connectionBadgeText}>
                                      {displayRelationship || displayRole}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityLabel={tc('notificationMoreActions')}
                              onPress={() => {
                                const options: AlertButton[] = [];
                                if (isRequester) {
                                  options.push({
                                    text: t('editConnection'),
                                    icon: 'pencil-outline',
                                    onPress: () =>
                                      handleEditConnection({
                                        ...connection,
                                        name: otherName,
                                      }),
                                  });
                                }
                                options.push(
                                  {
                                    text: t('deleteConnection'),
                                    style: 'destructive',
                                    icon: 'trash-can-outline',
                                    onPress: () => handleDeleteConnection(connection.id, otherName),
                                  },
                                  { text: tc('cancel'), style: 'cancel', icon: 'close' }
                                );
                                showAlert(t('connectionActionsTitle'), t('connectionActionsMessage', { name: otherName }), options, undefined, { layout: 'actions' });
                              }}
                              style={styles.moreActionsBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              {actionLoading === connection.id ? (
                                <ActivityIndicator size="small" color={colors.textSecondary} />
                              ) : (
                                <Ionicons
                                  name="ellipsis-horizontal"
                                  size={18}
                                  color={isDark ? colors.textSecondary : '#1E293B'}
                                />
                              )}
                            </TouchableOpacity>
                          </View>

                          {/* Contact Info Section */}
                          {(otherUserPhone || otherUserEmail) && (
                            <View style={styles.contactSection}>
                              {otherUserPhone && (
                                <View style={styles.contactRow}>
                                  <Ionicons name="call-outline" size={19} color={isDark ? colors.textSecondary : '#475569'} />
                                  <Text style={styles.cardContactText}>{otherUserPhone}</Text>
                                </View>
                              )}
                              {otherUserEmail && (
                                <View style={styles.contactRow}>
                                  <Ionicons name="mail-outline" size={19} color={isDark ? colors.textSecondary : '#475569'} />
                                  <Text style={styles.cardContactText} numberOfLines={1}>
                                    {otherUserEmail}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}

                          {/* Health Profile Permission Banner */}
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() =>
                              healthAccess.canViewTheirs
                                ? router.push({
                                    pathname: '/care-circle/member/[id]',
                                    params: { id: String(otherUserId), name: otherName },
                                  })
                                : showAlert(t('healthProfilePrivate'), t('healthAccessRequired'))
                            }
                            style={[
                              styles.healthProfileBanner,
                              healthAccess.canViewTheirs && styles.healthProfileBannerAllowed,
                            ]}
                          >
                            {healthAccess.canViewTheirs ? (
                              <ShieldCheckIcon color={isDark ? '#6EE7B7' : '#0D9488'} size={24} />
                            ) : (
                              <ShieldXIcon color={isDark ? '#94A3B8' : '#475569'} size={24} />
                            )}
                            <View
                              style={[
                                styles.healthProfileDivider,
                                healthAccess.canViewTheirs && styles.healthProfileDividerAllowed,
                              ]}
                            />
                            <Text
                              style={[
                                styles.healthProfileBannerText,
                                healthAccess.canViewTheirs && styles.healthProfileBannerTextAllowed,
                              ]}
                              numberOfLines={1}
                            >
                              {t(healthAccess.canViewTheirs ? 'viewHealthProfile' : 'healthProfilePrivate')}
                            </Text>
                            {healthAccess.canViewTheirs && (
                              <Ionicons name="chevron-forward" size={18} color={isDark ? '#6EE7B7' : '#0D9488'} />
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}
        </RippleRefreshScrollView>

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
                    {t('noContactInfo')}
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
                    {t('cancelInvite')}
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
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalBgWrapper} pointerEvents="none">
              <Image
                source={require('../../assets/images/care-circle/header_cross_leaves_left.png')}
                style={styles.modalHeaderDecoLeft}
                resizeMode="contain"
              />
              <Image
                source={require('../../assets/images/missions/header_cross_heart.png')}
                style={styles.modalHeaderDecoRight}
                resizeMode="contain"
              />
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <Ionicons name="person" size={28} color="#0D9488" />
                <Text style={styles.modalTitle}>{t('editConnection')}</Text>
                <Text style={styles.modalSubtitle}>{editConnection?.name}</Text>
              </View>

              <View style={styles.currentInfoBox}>
                <View style={styles.currentInfoTextWrap}>
                  <Text style={styles.currentInfoTitle}>{t('currentInfo')}</Text>
                  <Text style={styles.currentInfoText}>
                    {t('relationship')}: {editRelationType?.label || t('notSet')}
                  </Text>
                  <Text style={styles.currentInfoText}>
                    {t('role')}: {editRole?.label || t('notSet')}
                  </Text>
                </View>
                <Image
                  source={require('../../assets/images/care-circle/edit_connection_card_art.png')}
                  style={styles.currentInfoArt}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.modalSection}>
                <Dropdown
                  label={t('relationship')}
                  placeholder={t('relationshipPlaceholder')}
                  options={relationshipOptions}
                  value={editRelationType}
                  onChange={setEditRelationType}
                  loading={isEditSaving}
                  searchable
                  leftIcon={
                    <Ionicons
                      name="people"
                      size={20}
                      color="#0D9488"
                      style={styles.dropdownLeftIcon}
                    />
                  }
                  showDivider
                  chevronColor="#64748B"
                  chevronSize={18}
                  containerStyle={styles.dropdownContainer}
                  labelStyle={styles.sectionLabel}
                  triggerStyle={styles.dropdownTrigger}
                  triggerTextStyle={styles.dropdownTriggerText}
                />
              </View>

              <View style={styles.modalSection}>
                <Dropdown
                  label={t('role')}
                  placeholder={t('rolePlaceholder')}
                  options={roleOptions}
                  value={editRole}
                  onChange={setEditRole}
                  loading={isEditSaving}
                  searchable
                  leftIcon={
                    <MaterialCommunityIcons
                      name="account-heart"
                      size={20}
                      color="#0D9488"
                      style={styles.dropdownLeftIcon}
                    />
                  }
                  showDivider
                  chevronColor="#64748B"
                  chevronSize={18}
                  containerStyle={styles.dropdownContainer}
                  labelStyle={styles.sectionLabel}
                  triggerStyle={styles.dropdownTrigger}
                  triggerTextStyle={styles.dropdownTriggerText}
                />
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionLabel}>
                  {t('permissions')}
                </Text>
                <View style={styles.permCard}>
                  {[
                    {
                      key: 'can_view_logs' as const,
                      icon: 'eye-outline',
                      iconColor: '#0284C7',
                      label: t('permViewLogs'),
                    },
                    {
                      key: 'can_receive_alerts' as const,
                      icon: 'notifications-outline',
                      iconColor: '#0D9488',
                      label: t('permReceiveAlerts'),
                    },
                    {
                      key: 'can_ack_escalation' as const,
                      icon: 'shield-checkmark-outline',
                      iconColor: '#0D9488',
                      label: t('permAckEscalation'),
                    },
                  ].map((perm, index, arr) => (
                    <React.Fragment key={perm.key}>
                      <View style={styles.permRow}>
                        <Ionicons
                          name={perm.icon as any}
                          size={22}
                          color={perm.iconColor}
                          style={styles.permIcon}
                        />
                        <Text style={styles.permLabel}>{perm.label}</Text>
                        <Switch
                          value={editPermissions[perm.key]}
                          disabled={isEditSaving}
                          onValueChange={(val) =>
                            setEditPermissions((prev) => ({ ...prev, [perm.key]: val }))
                          }
                          trackColor={{ false: '#E2E8F0', true: '#0D9488' }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#E2E8F0"
                        />
                      </View>
                      {index < arr.length - 1 && <View style={styles.permDivider} />}
                    </React.Fragment>
                  ))}
                </View>
              </View>

              <View style={styles.modalButtonGroup}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditModalVisible(false)}
                  disabled={isEditSaving}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelBtnText}>{tc('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, editSaveDisabled && styles.modalSaveBtnDisabled]}
                  onPress={handleSaveEdit}
                  disabled={editSaveDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={tc('save')}
                  accessibilityState={{ disabled: editSaveDisabled, busy: isEditSaving }}
                  activeOpacity={0.7}
                >
                  {isEditSaving ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                  ) : (
                    <Text style={[styles.modalSaveBtnText, editSaveDisabled && styles.modalSaveBtnTextDisabled]}>{tc('save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </Screen>
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>, isDark = false) {
  const androidCardSurface = Platform.select({
    android: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      elevation: 2,
    },
    default: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
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
      minHeight: 168,
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
      marginBottom: spacing.sm,
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
      minWidth: 0,
      paddingHorizontal: 10,
      justifyContent: 'center',
    },
    inviteBannerTitle: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '700',
      color: '#0D5A50',
      lineHeight: 19,
    },
    inviteBannerSubtitle: {
      flexShrink: 1,
      fontSize: 12,
      color: '#6B7280',
      marginTop: 2,
      lineHeight: 16,
    },
    invitePillButton: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
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
      gap: spacing.md,
    },
    connectionCard: {
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#EEF2F6',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 10,
      ...androidCardSurface,
    },
    connectionCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    connectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flex: 1,
    },
    connectionAvatar: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: isDark ? '#134E48' : '#E0F4F0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    connectionAvatarText: {
      fontSize: 24,
      fontWeight: '700',
      color: isDark ? '#5EEAD4' : '#0F766E',
    },
    connectionCardInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    connectionCardName: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? colors.textPrimary : '#0F172A',
      lineHeight: 24,
    },
    connectionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? '#134E48' : '#E6F8F5',
      paddingHorizontal: 12,
      paddingVertical: 4.5,
      borderRadius: 16,
      alignSelf: 'flex-start',
      marginTop: 6,
    },
    connectionBadgeText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#5EEAD4' : '#0D9488',
    },
    moreActionsBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? colors.surfaceMuted : '#F1F7F6',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
    },
    contactSection: {
      marginTop: 16,
      gap: 12,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    cardContactText: {
      fontSize: 15.5,
      fontWeight: '500',
      color: isDark ? colors.textPrimary : '#1E293B',
      flex: 1,
    },
    healthProfileBanner: {
      marginTop: 18,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1E293B' : '#F4FAF8',
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 16,
    },
    healthProfileBannerAllowed: {
      backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
    },
    healthProfileDivider: {
      width: 1,
      height: 20,
      backgroundColor: isDark ? '#475569' : '#CBD5E1',
      marginHorizontal: 14,
    },
    healthProfileDividerAllowed: {
      backgroundColor: isDark ? '#047857' : '#A7F3D0',
    },
    healthProfileBannerText: {
      flex: 1,
      fontSize: 14.5,
      fontWeight: '500',
      color: isDark ? '#94A3B8' : '#475569',
    },
    healthProfileBannerTextAllowed: {
      fontWeight: '600',
      color: isDark ? '#6EE7B7' : '#0D9488',
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
    modalSafeArea: {
      flex: 1,
      backgroundColor: isDark ? colors.background : '#F3FBF8',
    },
    modalBgWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 220,
      overflow: 'hidden',
    },
    modalHeaderDecoLeft: {
      position: 'absolute',
      top: -10,
      left: 0,
      width: 140,
      height: 180,
      opacity: 0.85,
    },
    modalHeaderDecoRight: {
      position: 'absolute',
      top: -20,
      right: -20,
      width: 220,
      height: 190,
      opacity: 0.85,
    },
    modalContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
    },
    modalHeader: {
      alignItems: 'center',
      marginBottom: spacing.md,
      marginTop: spacing.xs,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: spacing.xs,
    },
    modalSubtitle: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 2,
    },
    currentInfoBox: {
      backgroundColor: isDark ? colors.surface : '#EBF7F5',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#CCFBF1',
      paddingLeft: spacing.lg,
      paddingVertical: spacing.md,
      paddingRight: spacing.sm,
      marginBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      position: 'relative',
      minHeight: 96,
    },
    currentInfoTextWrap: {
      flex: 1,
      zIndex: 1,
      paddingRight: spacing.sm,
    },
    currentInfoTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#0F766E',
      marginBottom: 4,
    },
    currentInfoText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#0D5A50',
      marginTop: 2,
    },
    currentInfoArt: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 140,
      height: '100%',
    },
    modalSection: {
      marginBottom: spacing.md,
    },
    sectionLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    dropdownContainer: {
      marginBottom: 0,
    },
    dropdownTrigger: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#E2E8F0',
      paddingHorizontal: spacing.md,
      minHeight: 56,
      height: 56,
    },
    dropdownTriggerText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    dropdownLeftIcon: {
      marginRight: spacing.sm,
    },
    permCard: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#E2E8F0',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    permRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    permIcon: {
      marginRight: spacing.md,
    },
    permLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    permDivider: {
      height: 1,
      backgroundColor: isDark ? colors.border : '#F1F5F9',
    },
    modalButtonGroup: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    modalCancelBtn: {
      flex: 1,
      height: 50,
      borderRadius: 25,
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderWidth: 1.5,
      borderColor: isDark ? colors.border : '#CBD5E1',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCancelBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    modalSaveBtn: {
      flex: 1,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#0D9488',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalSaveBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    modalSaveBtnDisabled: {
      backgroundColor: colors.border,
    },
    modalSaveBtnTextDisabled: {
      color: colors.textSecondary,
    },
  });
}
