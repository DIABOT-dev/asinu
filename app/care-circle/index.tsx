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
import { ModalToastHost } from '../../src/components/GlobalToastHost';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Avatar } from '../../src/components/Avatar';
import { Screen } from '../../src/components/Screen';
import { CareCircleTabSkeleton } from '../../src/components/state/MainScreenSkeletons';
import { useInitialLoadingGate } from '../../src/hooks/useInitialLoadingGate';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { showToast } from '../../src/stores/toast.store';
import { careCircleApi, useCareCircle, type CareCircleConnection } from '../../src/features/care-circle';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, getBottomTabBarHeight, iconColors, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { getApiErrorMessage } from '../../src/lib/apiClient';
import { tokenStore } from '../../src/lib/tokenStore';
import { getConnectionHealthAccess } from '../../src/features/care-circle/health-access';
import { getFamilyRoleLabel } from '../../src/features/care-circle/family-roles';
import {
  findFamilyRelationship,
  getFamilyRelationshipLabel,
  getFamilyRelationshipOptions,
  getReverseFamilyRelationshipLabel,
} from '../../src/features/care-circle/family-relationships';
import { getConnectionEditChanges, type ConnectionEditValues } from '../../src/features/care-circle/connection-edit';
import { CareCircleQrActions } from '../../src/features/care-circle/components/CareCircleQrActions';
import { CareCircleMemberStrip } from '../../src/features/care-circle/components/CareCircleMemberStrip';
import { HomeProfileAvatar } from '../../src/components/HomeProfileAvatar';
import { useFamilyFeatures } from '../../src/features/care-circle/useMemberOverview';
import { HealthJournalCalendar } from '../../src/components/HealthJournalCalendar';
import { GuideScrollScope } from '../../src/features/guidance/GuidanceProvider';

type ConnectionEditTarget = {
  id: string;
  name: string;
  role?: string;
  accountId: string;
  token: string;
  isRequester: boolean;
};

export default function CareCircleScreen() {
  const guideScrollRef = useRef<ScrollView>(null);
  const guideScrollOffset = useRef(0);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((state) => state.profile);
  const token = useAuthStore((state) => state.token);
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { colors: themeColors, isDark } = useThemeColors();
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
    updateNotificationAccess,
    refresh,
    fetchInvitations,
    fetchConnections,
  } = useCareCircle();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const familyFeatures = useFamilyFeatures(focused && connections.length > 0, calendarRefreshKey);
  const currentConnectionContext = useRef({ connections, familyFeatures });
  currentConnectionContext.current = { connections, familyFeatures };
  const [editConnection, setEditConnection] = useState<ConnectionEditTarget | null>(null);
  const editTarget = useRef<ConnectionEditTarget | null>(null);
  const editModalVisible = !!editConnection && editConnection.accountId === profile?.id && editConnection.token === token;
  const [editRelationType, setEditRelationType] = useState<DropdownOption | null>(null);
  const [editPermissions, setEditPermissions] = useState({
    can_view_logs: true,
    can_receive_alerts: true,
    can_ack_escalation: true,
  });
  const [savedEditValues, setSavedEditValues] = useState<ConnectionEditValues | null>(null);
  const [shareNotifications, setShareNotifications] = useState(false);
  const editSaveInFlight = useRef(false);
  const editValues: ConnectionEditValues = {
    relationship_type: editRelationType?.id,
    role: editConnection?.role,
    permissions: editPermissions,
    shareNotifications,
  };
  const editChanges = savedEditValues && getConnectionEditChanges(savedEditValues, editValues);
  const isEditSaving = editModalVisible && actionLoading === editConnection?.id;
  const editSaveDisabled = !editModalVisible || !editChanges?.hasChanges || actionLoading !== null;

  // Profile modal
  type ProfileTarget = {
    name: string;
    avatarUrl?: string;
    email?: string;
    phone?: string;
    relationship?: string;
    role?: string;
    invitationId?: string;
  };
  const [profileTarget, setProfileTarget] = useState<ProfileTarget | null>(null);

  // Relationship options
  const relationshipOptions = getFamilyRelationshipOptions(t);

  const reverseRelationship = (relationshipType: string | undefined, otherGender?: string): string => {
    return getReverseFamilyRelationshipLabel(relationshipType, otherGender, t);
  };

  const getRelationshipLabel = (relationshipType: string | undefined): string => {
    return getFamilyRelationshipLabel(relationshipType, t);
  };

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setCalendarRefreshKey(value => value + 1);
      fetchInvitations(true);
      fetchConnections(true);
      return () => setFocused(false);
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

  const isCurrentAccount = (accountId: string, sessionToken: string) => {
    const auth = useAuthStore.getState();
    return auth.profile?.id === accountId && auth.token === sessionToken && tokenStore.getToken() === sessionToken;
  };

  const getAccountConnection = (id: string, accountId: string, sessionToken: string) => {
    if (!isCurrentAccount(accountId, sessionToken)) return undefined;
    return currentConnectionContext.current.connections.find(connection => connection.id === id &&
      connection.status === 'accepted' &&
      (String(connection.requester_id) === accountId || String(connection.addressee_id) === accountId));
  };

  const closeEdit = () => {
    editTarget.current = null;
    setEditConnection(null);
  };

  const handleEditConnection = (connection: CareCircleConnection, memberName: string, accountId: string, sessionToken: string) => {
    if (editSaveInFlight.current) {
      return;
    }
    const target = {
      id: connection.id, name: memberName, role: connection.role, accountId, token: sessionToken,
      isRequester: String(connection.requester_id) === accountId,
    };
    editTarget.current = target;
    setEditConnection(target);
    const relationshipId = findFamilyRelationship(connection.relationship_type)?.id;
    const relOption = relationshipOptions.find(opt => opt.id === relationshipId) ||
      (connection.relationship_type ? { id: connection.relationship_type, label: connection.relationship_type } : null);
    setEditRelationType(relOption || null);
    const permissions = {
      can_view_logs: connection.permissions?.can_view_logs === true,
      can_receive_alerts: connection.permissions?.can_receive_alerts ?? true,
      can_ack_escalation: connection.permissions?.can_ack_escalation ?? true,
    };
    const sharesNotifications = target.isRequester
      ? connection.requester_shares_notifications === true
      : connection.addressee_shares_notifications === true;
    setEditPermissions(permissions);
    setShareNotifications(sharesNotifications);
    setSavedEditValues({
      relationship_type: relOption?.id,
      role: connection.role,
      permissions,
      shareNotifications: sharesNotifications,
    });
  };

  const handleSaveEdit = async () => {
    if (!editConnection || editSaveDisabled || !editChanges || editSaveInFlight.current) {
      return;
    }
    const { id, accountId, token: sessionToken } = editConnection;
    const currentConnection = () => editTarget.current === editConnection
      ? getAccountConnection(id, accountId, sessionToken)
      : undefined;
    const connection = currentConnection();
    if (!connection) return;
    const isRequester = String(connection.requester_id) === accountId;
    editSaveInFlight.current = true;
    let savingNotificationAccess = false;
    try {
      setActionLoading(id);
      if (isRequester && Object.keys(editChanges.updates).length > 0) {
        await updateConnection(id, editChanges.updates);
        if (!currentConnection()) return;
        // Retain successful changes if the permission update fails, so retry
        // only sends the portion that is still unsaved.
        setSavedEditValues(previous => previous && { ...previous, ...editChanges.updates });
      }
      if (isRequester && editChanges.permissionsChanged) {
        await updatePermissions(id, editValues.permissions);
        if (!currentConnection()) return;
        setSavedEditValues(previous => previous && { ...previous, permissions: editValues.permissions });
      }
      if (editChanges.notificationAccessChanged) {
        savingNotificationAccess = true;
        await updateNotificationAccess(id, editValues.shareNotifications);
        if (!currentConnection()) return;
      }
      closeEdit();
      showToast(t(savingNotificationAccess
        ? editValues.shareNotifications ? 'familyNotificationsShared' : 'familyNotificationsUnshared'
        : 'editSuccess'), 'success');
    } catch (error) {
      if (currentConnection()) {
        showToast(savingNotificationAccess
          ? getApiErrorMessage(error, t, 'familyNotificationShareError')
          : t('editError'), 'error');
      }
    } finally {
      editSaveInFlight.current = false;
      setActionLoading(previous => previous === id ? null : previous);
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
  const members = connections.map(connection => {
    const isRequester = String(connection.requester_id) === String(profile?.id);
    return {
      id: connection.id,
      userId: String(isRequester ? connection.addressee_id : connection.requester_id),
      name: (isRequester ? connection.addressee_name : connection.requester_name)?.trim()
        || (isRequester ? connection.addressee_full_name : connection.requester_full_name)?.trim() || t('thisPerson'),
      avatarUrl: (isRequester ? connection.addressee_avatar_url : connection.requester_avatar_url) || undefined,
      relationship: isRequester ? getRelationshipLabel(connection.relationship_type)
        : reverseRelationship(connection.relationship_type, connection.requester_gender),
    };
  });
  const selectedMember = members.find(member => member.id === selectedConnectionId) || members[0];
  const selectedConnection = connections.find(connection => connection.id === selectedMember?.id);
  const canViewSelected = selectedConnection && getConnectionHealthAccess(selectedConnection, profile?.id).canViewTheirs;
  const guidedMemberId = connections.find(connection => getConnectionHealthAccess(connection, profile?.id).canViewTheirs)?.id;
  const selectedUserId = selectedMember?.userId;
  const loadMemberCalendar = useCallback((month: string) =>
    careCircleApi.getMemberHealthCalendar(selectedUserId!, month), [selectedUserId]);

  const showMemberChoices = (id: string) => {
    const accountId = profile?.id;
    if (!accountId || !token) return;
    const currentConnection = () => getAccountConnection(id, accountId, token);
    const member = members.find(person => person.id === id);
    const connection = currentConnection();
    if (!member || !connection) return;
    setSelectedConnectionId(id);
    const layout = { layout: 'actions' as const };
    const cancel: AlertButton = { text: tc('cancel'), style: 'cancel', icon: 'close' };
    const canManageMedication = () => {
      const flags = currentConnectionContext.current.familyFeatures;
      return !!flags?.medication && flags.patients.some(person => String(person.id) === member.userId);
    };
    const canViewHealth = getConnectionHealthAccess(connection, accountId).canViewTheirs;
    const openMemberNotifications = () => {
      if (currentConnection()) router.push({
        pathname: '/care-circle/notifications/[id]', params: { id: member.userId },
      });
    };
    showAlert(member.name, undefined, [
      {
        text: t('familyHealthTitle'), icon: canViewHealth ? 'file-document-outline' : 'lock-outline',
        disabled: !canViewHealth, accessibilityHint: canViewHealth ? undefined : t('healthAccessRequired'),
        onPress: () => {
          const current = currentConnection();
          if (!current) return;
          if (!getConnectionHealthAccess(current, accountId).canViewTheirs) {
            showAlert(t('healthProfilePrivate'), t('healthAccessRequired'));
            return;
          }
          router.push({ pathname: '/care-circle/member/[id]', params: { id: member.userId, name: member.name } });
        },
      },
      {
        text: t('familyNotifications'), icon: 'bell-outline',
        onPress: openMemberNotifications,
      },
      {
        text: t('familyTaskSetup'), icon: 'calendar-clock',
        onPress: () => {
          if (!currentConnection()) return;
          if (!canManageMedication()) {
            showAlert(t('familyTaskSetup'), t('familyMedicationUnavailable'));
            return;
          }
          showAlert(t('familyTaskSetup'), undefined, [{
            text: t('familyMedicationSetup'), icon: 'pill',
            onPress: () => {
              if (currentConnection() && canManageMedication()) {
                router.push({ pathname: '/medication', params: { patientId: member.userId } });
              }
            },
          }, cancel], undefined, layout);
        },
      },
      {
        text: t('connectionActionsTitle'), icon: 'account-cog-outline',
        onPress: () => {
          if (!currentConnection()) return;
          showAlert(t('connectionActionsTitle'), t('connectionActionsMessage', { name: member.name }), [
            {
              text: t('editConnection'), icon: 'pencil-outline',
              onPress: () => {
                const latest = currentConnection();
                if (latest) handleEditConnection(latest, member.name, accountId, token);
              },
            },
            {
              text: t('deleteConnection'), style: 'destructive', icon: 'trash-can-outline',
              onPress: () => { if (currentConnection()) handleDeleteConnection(id, member.name); },
            },
            cancel,
          ], undefined, layout);
        },
      },
      cancel,
    ], undefined, layout);
  };

  return (
    <>
      <AppAlertModal {...alertState} queued onDismiss={dismissAlert} />
      <Stack.Screen options={{ headerShown: false }} />
      <Screen style={[styles.screen, { paddingTop: Math.max(insets.top, 20) }]}>
        <GuideScrollScope scrollRef={guideScrollRef} offset={guideScrollOffset}>
        <RippleRefreshScrollView
          nativeScrollRef={guideScrollRef}
          onScroll={event => { guideScrollOffset.current = event.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={32}
          refreshing={refreshing}
          onRefresh={() => { void refresh(); setCalendarRefreshKey(value => value + 1); }}
          style={styles.container}
          contentContainerStyle={{
            paddingTop: 10,
            paddingBottom: getBottomTabBarHeight(insets.bottom) + spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.familyHeader}>
            {profile ? <HomeProfileAvatar profile={profile} /> : <View style={styles.familyHeaderSide} />}
            <Text accessibilityRole="header" style={styles.familyTitle}>{t('familyConnectionsTitle')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('scanQr')}
              style={({ pressed }) => [styles.familyHeaderSide, pressed && styles.familyScanPressed]}
              onPress={() => router.push('/care-circle/scan')}>
              <LinearGradient
                colors={[themeColors.primaryLight, themeColors.emeraldLight]}
                start={{ x: 0, y: 0.15 }}
                end={{ x: 1, y: 0.85 }}
                style={styles.familyScanTile}
              >
                <MaterialCommunityIcons name="qrcode-scan" size={29} color={themeColors.primaryText} accessible={false} />
              </LinearGradient>
            </Pressable>
          </View>
          {!showInitialSkeleton && <CareCircleMemberStrip members={members} selectedId={selectedMember?.id} guidedMemberId={guidedMemberId} hideHeading
            onSelect={showMemberChoices} onAdd={() => router.push('/care-circle/invite')} />}
          {!showInitialSkeleton && selectedMember && canViewSelected && focused && (
            <View style={styles.familyReport}>
              <Text accessibilityRole="header" style={styles.familyReportTitle}>{t('familyHealthReport')}</Text>
              <HealthJournalCalendar key={`${profile?.id}:${selectedUserId}`} plain
                loadReport={loadMemberCalendar} subjectName={selectedMember.name} refreshKey={calendarRefreshKey} />
            </View>
          )}
          <CareCircleQrActions />
          {showInitialSkeleton ? (
            <CareCircleTabSkeleton />
          ) : (
            <>
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
                            relationship: getRelationshipLabel(invitation.relationship_type),
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

            </>
          )}
        </RippleRefreshScrollView>
        </GuideScrollScope>

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
              <Avatar name={profileTarget?.name || t('thisPerson')} imageUrl={profileTarget?.avatarUrl} size={80} />
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
          onRequestClose={() => { if (!editSaveInFlight.current) closeEdit(); }}
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

              {editConnection?.isRequester && <>
              <View style={styles.currentInfoBox}>
                <View style={styles.currentInfoTextWrap}>
                  <Text style={styles.currentInfoTitle}>{t('currentInfo')}</Text>
                  <Text style={styles.currentInfoText}>
                    {t('relationship')}: {editRelationType?.label || t('notSet')}
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
              </>}

              <View style={styles.modalSection}>
                <Text style={styles.sectionLabel}>
                  {t('permissions')}
                </Text>
                <View style={styles.permCard}>
                  {editConnection?.isRequester && [
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
                  ].map(perm => (
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
                          accessibilityLabel={perm.label}
                          disabled={isEditSaving}
                          onValueChange={(val) =>
                            setEditPermissions((prev) => ({ ...prev, [perm.key]: val }))
                          }
                          trackColor={{ false: '#E2E8F0', true: '#0D9488' }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#E2E8F0"
                        />
                      </View>
                      <View style={styles.permDivider} />
                    </React.Fragment>
                  ))}
                  <View style={styles.permRow}>
                    <Ionicons name="mail-outline" size={22} color={themeColors.primaryDark} style={styles.permIcon} />
                    <View style={styles.permCopy}>
                      <Text style={[styles.permLabel, styles.permShareLabel]}>{t('familyShareMyNotifications')}</Text>
                      <Text style={styles.permDescription}>{t('familyShareNotificationsDescription')}</Text>
                    </View>
                    <Switch
                      value={shareNotifications}
                      disabled={isEditSaving}
                      accessibilityLabel={t('familyShareMyNotifications')}
                      accessibilityHint={t('familyShareNotificationsDescription')}
                      onValueChange={setShareNotifications}
                      trackColor={{ false: '#E2E8F0', true: '#0D9488' }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor="#E2E8F0"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.modalButtonGroup}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={closeEdit}
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
            {editModalVisible && <ModalToastHost />}
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
    familyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
    familyHeaderSide: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    familyScanTile: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    familyScanPressed: { opacity: 0.75 },
    familyTitle: { flex: 1, textAlign: 'center', fontSize: 21, fontWeight: '700', color: colors.textPrimary },
    familyReport: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
    familyReportTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    screen: {
      flex: 1,
    },
    container: {
      flex: 1,
      backgroundColor: 'transparent',
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
    permCopy: {
      flex: 1,
      gap: spacing.xs,
      paddingRight: spacing.sm,
    },
    permShareLabel: {
      flex: 0,
    },
    permDescription: {
      fontSize: 13,
      color: colors.textSecondary,
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
