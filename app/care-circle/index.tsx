import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { RippleRefreshScrollView } from '../../src/components/RippleRefresh';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Dropdown, DropdownOption } from '../../src/components/Dropdown';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { showToast } from '../../src/stores/toast.store';
import { useCareCircle } from '../../src/features/care-circle';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, iconColors, spacing, brandColors} from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

export default function CareCircleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((state) => state.profile);
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();

  const screenOptions = useMemo(() => ({
    headerShown: true,
    title: t('title'),
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' as const },
    headerShadowVisible: false,
    headerLeft: () => (
      <TouchableOpacity onPress={() => router.back()} style={{ padding: 10, marginLeft: 0 }}>
        <Ionicons name="arrow-back" size={26} color={iconColors.primary} />
      </TouchableOpacity>
    ),
  }), [router, t]);
  
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
    refresh
  } = useCareCircle();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editConnection, setEditConnection] = useState<{ id: string; relationship_type?: string; role?: string; name: string; permissions?: { can_view_logs: boolean; can_receive_alerts: boolean; can_ack_escalation: boolean } } | null>(null);
  const [editRelationType, setEditRelationType] = useState<DropdownOption | null>(null);
  const [editRole, setEditRole] = useState<DropdownOption | null>(null);
  const [editPermissions, setEditPermissions] = useState({ can_view_logs: true, can_receive_alerts: true, can_ack_escalation: true });

  // Profile modal
  type ProfileTarget = {
    name: string; email?: string; phone?: string;
    relationship?: string; role?: string;
    invitationId?: string; // nếu là lời mời đã gửi
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

  // Hàm đảo ngược mối quan hệ: nếu người khác gọi mình là "Bố" thì mình gọi họ là "Con"
  const reverseRelationship = (relationshipType: string | undefined): string => {
    if (!relationshipType) return '';
    
    const reverseMap: Record<string, string> = {
      // Cha mẹ <-> Con cái
      'bo': t('reverseChild'),
      'Bố': t('reverseChild'),
      'me': t('reverseChild'),
      'Mẹ': t('reverseChild'),
      'con-trai': t('reverseParent'),
      'Con trai': t('reverseParent'),
      'con-gai': t('reverseParent'),
      'Con gái': t('reverseParent'),

      // Vợ chồng (đối xứng)
      'vo': t('relHusband'),
      'Vợ': t('relHusband'),
      'chong': t('relWife'),
      'Chồng': t('relWife'),

      // Anh chị em
      'anh-trai': t('reverseYoungerSibling'),
      'Anh trai': t('reverseYoungerSibling'),
      'chi-gai': t('reverseYoungerSibling'),
      'Chị gái': t('reverseYoungerSibling'),
      'em-trai': t('reverseOlderSibling'),
      'Em trai': t('reverseOlderSibling'),
      'em-gai': t('reverseOlderSibling'),
      'Em gái': t('reverseOlderSibling'),

      // Ông bà <-> Cháu
      'ong-noi': t('reverseGrandchild'),
      'Ông nội': t('reverseGrandchild'),
      'ba-noi': t('reverseGrandchild'),
      'Bà nội': t('reverseGrandchild'),
      'ong-ngoai': t('reverseGrandchild'),
      'Ông ngoại': t('reverseGrandchild'),
      'ba-ngoai': t('reverseGrandchild'),
      'Bà ngoại': t('reverseGrandchild'),

      // Bạn bè, người yêu (đối xứng)
      'ban-than': t('relBestFriend'),
      'Bạn thân': t('relBestFriend'),
      'nguoi-yeu': t('relPartner'),
      'Người yêu': t('relPartner'),
    };
    
    return reverseMap[relationshipType] || relationshipType;
  };

  // Lấy label hiển thị của relationship
  const getRelationshipLabel = (relationshipType: string | undefined): string => {
    if (!relationshipType) return '';
    
    const option = relationshipOptions.find(
      opt => opt.id === relationshipType || opt.label === relationshipType
    );
    return option?.label || relationshipType;
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAccept = async (id: string) => {
    try {
      setActionLoading(id);
      await acceptInvitation(id);
      showToast(t('acceptSuccess'), 'success');
    } catch (error) {
      showToast(t('acceptError'), 'error');
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
      showToast(t('rejectError'), 'error');
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
    // Tìm theo id hoặc label (vì backend có thể lưu label thay vì id)
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
    } catch (error) {

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

  return (
    <>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
      <Stack.Screen options={screenOptions} />
      <Screen>
      <RippleRefreshScrollView
        refreshing={refreshing}
        onRefresh={refresh}
        style={styles.container}
        contentContainerStyle={{
          paddingTop: spacing.sm,
          paddingBottom: 96,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header - Full Width */}
        <View style={styles.heroBanner}>
          <MaterialCommunityIcons name="account-group" size={36} color={iconColors.emerald} />
          <Text style={styles.heroTitle}>{t('title')}</Text>
          <Text style={styles.heroSubtitle}>{t('subtitle')}</Text>
        </View>
        
        {/* Stats — 3 rows */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={20} color={iconColors.emerald} />
            <Text style={styles.statLabel}>{t('connections')}</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.statValue}>{connections.length}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="mail-unread" size={20} color={iconColors.premium} />
            <Text style={styles.statLabel}>{t('received')}</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.statValue}>{receivedInvitations.length}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="send" size={18} color={iconColors.glucose} />
            <Text style={styles.statLabel}>{t('sent')}</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.statValue}>{sentInvitations.length}</Text>
          </View>
        </View>

        {/* Invite Button */}
        <View style={styles.section}>
          <Pressable
            onPress={() => router.push('/care-circle/invite')}
            style={({ pressed }) => [styles.inviteButton, pressed && styles.inviteButtonPressed]}
          >
            <LinearGradient
              colors={['#5ba8a0', '#3d8f87']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.inviteButtonGradient}
            >
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.inviteButtonText}>{t('inviteNew')}</Text>
              <Ionicons name="arrow-forward-circle" size={22} color="rgba(255,255,255,0.8)" style={{ marginLeft: 'auto' }} />
            </LinearGradient>
          </Pressable>
        </View>

        {/* Received Invitations */}
        {receivedInvitations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="mail-unread" size={16} color={iconColors.premium} />
              <Text style={styles.sectionTitle}>{t('receivedInvitations', { count: receivedInvitations.length })}</Text>
            </View>
            {receivedInvitations.map((invitation) => {
              const requesterName = invitation.requester_full_name || invitation.requester_name || invitation.requester_email || `#${invitation.requester_id}`;
              return (
              <TouchableOpacity
                key={invitation.id}
                style={styles.card}
                onPress={() => setProfileTarget({
                  name: requesterName,
                  email: invitation.requester_email,
                  phone: invitation.requester_phone,
                  relationship: reverseRelationship(invitation.relationship_type) || invitation.relationship_type,
                  role: invitation.role,
                })}
                activeOpacity={0.75}
              >
                <View style={styles.cardHeader}>
                  <LinearGradient
                    colors={[colors.premium, colors.premiumDark]}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarText}>
                      {requesterName[0]?.toUpperCase() || '?'}
                    </Text>
                  </LinearGradient>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{requesterName}</Text>
                    <View style={styles.cardBadge}>
                      <Ionicons name="link" size={12} color={iconColors.primary} />
                      <Text style={styles.cardRelation}>
                        {reverseRelationship(invitation.relationship_type) || invitation.role || t('connection')}
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

        {/* Sent Invitations */}
        {sentInvitations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="send" size={16} color={iconColors.glucose} />
              <Text style={styles.sectionTitle}>{t('sentInvitations', { count: sentInvitations.length })}</Text>
            </View>
            {sentInvitations.map((invitation) => {
              const name = invitation.addressee_full_name || invitation.addressee_name || invitation.addressee_email || `#${invitation.addressee_id}`;
              return (
              <TouchableOpacity
                key={invitation.id}
                style={[styles.card, styles.cardPending]}
                onPress={() => setProfileTarget({
                  name,
                  email: invitation.addressee_email,
                  phone: invitation.addressee_phone,
                  relationship: invitation.relationship_type,
                  role: invitation.role,
                  invitationId: invitation.id,
                })}
                activeOpacity={0.75}
              >
                <View style={styles.cardHeader}>
                  <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.avatar}>
                    <Text style={styles.avatarText}>{name[0]?.toUpperCase() || '?'}</Text>
                  </LinearGradient>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{name}</Text>
                    <View style={styles.pendingBadge}>
                      <Ionicons name="time" size={12} color={iconColors.premium} />
                      <Text style={styles.cardStatus}>{t('waitingResponse')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => handleCancel(invitation.id)}
                    disabled={actionLoading === invitation.id}
                  >
                    {actionLoading === invitation.id
                      ? <ActivityIndicator size="small" color={iconColors.danger} />
                      : <Ionicons name="close-circle" size={22} color={iconColors.danger} />}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Active Connections */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={16} color={iconColors.emerald} />
            <Text style={styles.sectionTitle}>
              {t('activeConnections', { count: connections.length })}
            </Text>
          </View>
          {(loading || refreshing) && connections.length === 0 ? (
            <ActivityIndicator size="large" color={iconColors.primary} style={styles.loader} />
          ) : connections.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBg}>
                <MaterialCommunityIcons name="account-group-outline" size={48} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyText}>{t('noConnections')}</Text>
              <Text style={styles.emptySubtext}>{t('noConnectionsHint')}</Text>
            </View>
          ) : (
            connections.map((connection) => {
              const isRequester = String(connection.requester_id) === String(profile?.id);
              const otherUserId = isRequester ? connection.addressee_id : connection.requester_id;
              const otherUserFullName = isRequester ? connection.addressee_full_name : connection.requester_full_name;
              const otherUserEmail = isRequester ? connection.addressee_email : connection.requester_email;
              const otherUserPhone = isRequester ? connection.addressee_phone : connection.requester_phone;
              
              // Xác định mối quan hệ hiển thị:
              // - Nếu mình là requester: hiển thị relationship_type như đã đặt
              // - Nếu mình là addressee: đảo ngược relationship_type
              const displayRelationship = isRequester 
                ? getRelationshipLabel(connection.relationship_type)
                : reverseRelationship(connection.relationship_type);

              const otherName = otherUserFullName || otherUserEmail || `#${otherUserId}`;
              return (
                <TouchableOpacity
                  key={connection.id}
                  style={styles.card}
                  onPress={() => router.push({
                    pathname: '/care-circle/member/[id]',
                    params: { id: String(otherUserId), name: otherName }
                  })}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName} numberOfLines={2}>{otherName}</Text>
                    <View style={styles.cardActionsSmall}>
                      <TouchableOpacity
                        onPress={() => handleEditConnection({ ...connection, name: otherUserFullName || `User ${otherUserId}` })}
                        style={styles.iconBtn}
                      >
                        <Ionicons name="pencil" size={18} color={iconColors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteConnection(connection.id, otherName)}
                        disabled={actionLoading === connection.id}
                        style={styles.iconBtn}
                      >
                        {actionLoading === connection.id ? (
                          <ActivityIndicator size="small" color={iconColors.danger} />
                        ) : (
                          <Ionicons name="trash" size={18} color={iconColors.danger} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  {otherUserEmail && (
                    <View style={styles.contactRow}>
                      <Ionicons name="mail-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.cardContact}>{otherUserEmail}</Text>
                    </View>
                  )}
                  {otherUserPhone && (
                    <View style={styles.contactRow}>
                      <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.cardContact}>{otherUserPhone}</Text>
                    </View>
                  )}
                  {(displayRelationship || connection.role) && (
                    <View style={styles.cardBadge}>
                      <Ionicons name="heart" size={12} color={iconColors.primary} />
                      <Text style={styles.cardRelation}>
                        {displayRelationship || connection.role}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

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
              <LinearGradient colors={[colors.emerald, colors.emeraldDark]} style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{profileTarget?.name?.[0]?.toUpperCase() || '?'}</Text>
              </LinearGradient>
              <Text style={styles.profileName}>{profileTarget?.name}</Text>
              {profileTarget?.relationship ? (
                <View style={styles.profileBadge}>
                  <Ionicons name="heart" size={13} color={iconColors.primary} />
                  <Text style={styles.profileBadgeText}>{profileTarget.relationship}</Text>
                </View>
              ) : null}
              {profileTarget?.role ? (
                <View style={[styles.profileBadge, { backgroundColor: colors.premiumLight }]}>
                  <Ionicons name="briefcase-outline" size={13} color={iconColors.premium} />
                  <Text style={[styles.profileBadgeText, { color: colors.premiumDark }]}>{profileTarget.role}</Text>
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
                  <Text style={styles.profileNoInfo}>{t('noContactInfo') || 'Không có thông tin liên hệ'}</Text>
                ) : null}
              </View>
              {profileTarget?.invitationId ? (
                <TouchableOpacity
                  style={styles.cancelInviteBtn}
                  onPress={() => { setProfileTarget(null); handleCancel(profileTarget.invitationId!); }}
                >
                  <Ionicons name="close-circle-outline" size={18} color={iconColors.danger} />
                  <Text style={styles.cancelInviteBtnText}>{t('cancelInvite') || 'Huỷ lời mời'}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.profileCloseBtn} onPress={() => setProfileTarget(null)}>
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
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalContent}
            >
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
                <Text style={[styles.currentInfoTitle, { marginBottom: spacing.sm }]}>{t('permissions')}</Text>
                {[
                  { key: 'can_view_logs' as const, icon: 'eye-outline', color: '#3b82f6', label: t('permViewLogs') },
                  { key: 'can_receive_alerts' as const, icon: 'notifications-outline', color: '#f59e0b', label: t('permReceiveAlerts') },
                  { key: 'can_ack_escalation' as const, icon: 'shield-checkmark-outline', color: '#10b981', label: t('permAckEscalation') },
                ].map(perm => (
                  <View key={perm.key} style={styles.permRow}>
                    <Ionicons name={perm.icon as any} size={20} color={perm.color} style={{ marginRight: spacing.sm }} />
                    <Text style={styles.permLabel}>{perm.label}</Text>
                    <Switch
                      value={editPermissions[perm.key]}
                      onValueChange={(val) => setEditPermissions(prev => ({ ...prev, [perm.key]: val }))}
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
      </RippleRefreshScrollView>
    </Screen>
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  heroBanner: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.emeraldLight,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  statsContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  heroTitle: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inviteButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  inviteButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  inviteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: typography.size.md,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  cardPending: {
    borderColor: colors.premium,
    backgroundColor: colors.premiumLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: '#fff'
  },
  cardInfo: {
    flex: 1
  },
  cardName: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
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
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  cardRelation: {
    fontSize: typography.size.xs,
    color: colors.primary,
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
    color: colors.premium,
    fontWeight: '500',
  },
  cardActionsSmall: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 40
  },
  acceptButton: {
    backgroundColor: colors.primary
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: typography.size.sm,
    fontWeight: '600'
  },
  rejectButton: {
    backgroundColor: colors.surfaceMuted,
  },
  rejectButtonText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: '600'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  emptyIconBg: {
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.size.md,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs
  },
  emptySubtext: {
    fontSize: typography.size.sm,
    color: colors.textSecondary
  },
  loader: {
    marginVertical: spacing.xl
  },
  cancelBtn: {
    padding: 4,
    marginLeft: spacing.sm,
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
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, marginBottom: spacing.lg,
  },
  profileAvatar: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileAvatarText: {
    fontSize: 30, fontWeight: '700', color: '#fff',
  },
  profileName: {
    fontSize: typography.size.lg, fontWeight: '700',
    color: colors.textPrimary, marginBottom: spacing.sm,
    textAlign: 'center',
  },
  profileBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primaryLight, paddingHorizontal: 12,
    paddingVertical: 5, borderRadius: 20, marginBottom: spacing.xs,
  },
  profileBadgeText: {
    fontSize: typography.size.sm, color: colors.primary, fontWeight: '600',
  },
  profileInfoList: {
    width: '100%', gap: spacing.sm,
    marginTop: spacing.md, marginBottom: spacing.md,
  },
  profileInfoRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  profileInfoText: {
    fontSize: typography.size.md, color: colors.textPrimary, flex: 1,
  },
  profileNoInfo: {
    fontSize: typography.size.sm, color: colors.textSecondary,
    textAlign: 'center', paddingVertical: spacing.md,
  },
  cancelInviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    borderWidth: 1.5, borderColor: colors.danger + '60',
    borderRadius: 12, marginBottom: spacing.sm, width: '100%',
    justifyContent: 'center',
  },
  cancelInviteBtnText: {
    fontSize: typography.size.md, color: colors.danger, fontWeight: '600',
  },
  profileCloseBtn: {
    paddingVertical: spacing.md, width: '100%',
    backgroundColor: colors.surfaceMuted, borderRadius: 12,
    alignItems: 'center', marginTop: spacing.xs,
  },
  profileCloseBtnText: {
    fontSize: typography.size.md, color: colors.textSecondary, fontWeight: '600',
  },
  modalContent: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl
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
    marginBottom: spacing.lg
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg
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
    marginBottom: spacing.xs
  },
  currentInfoText: {
    fontSize: typography.size.sm,
    color: '#0c4a6e',
    marginTop: spacing.xs / 2
  }
});
}
