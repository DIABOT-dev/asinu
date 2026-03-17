import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Dropdown, DropdownOption } from '../../src/components/Dropdown';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useCareCircle } from '../../src/features/care-circle';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, spacing } from '../../src/styles';

export default function CareCircleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((state) => state.profile);
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();

  const screenOptions = useMemo(() => ({
    headerShown: true,
    title: t('title'),
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' as const },
    headerShadowVisible: false,
    headerLeft: () => (
      <TouchableOpacity onPress={() => router.back()} style={{ padding: 10, marginLeft: 0 }}>
        <Ionicons name="arrow-back" size={26} color={colors.primary} />
      </TouchableOpacity>
    ),
  }), [router, t]);
  
  const {
    invitations,
    connections,
    loading,
    refreshing,
    fetchInvitations,
    fetchConnections,
    acceptInvitation,
    rejectInvitation,
    deleteConnection,
    updateConnection,
    refresh
  } = useCareCircle();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editConnection, setEditConnection] = useState<{ id: string; relationship_type?: string; role?: string; name: string } | null>(null);
  const [editRelationType, setEditRelationType] = useState<DropdownOption | null>(null);
  const [editRole, setEditRole] = useState<DropdownOption | null>(null);

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
    fetchInvitations();
    fetchConnections();
  }, []);

  const handleAccept = async (id: string) => {
    try {
      setActionLoading(id);
      await acceptInvitation(id);
      showAlert(tc('success'), t('acceptSuccess'));
    } catch (error) {
      showAlert(tc('error'), t('acceptError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setActionLoading(id);
      await rejectInvitation(id);
      showAlert(tc('success'), t('rejectSuccess'));
    } catch (error) {
      showAlert(tc('error'), t('rejectError'));
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
              showAlert(t('deleted'), t('deletedMsg'));
            } catch (error) {
              showAlert(tc('error'), t('deleteError'));
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
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editConnection) return;
    
    try {
      setActionLoading(editConnection.id);
      
      await updateConnection(editConnection.id, {
        relationship_type: editRelationType?.id,
        role: editRole?.id
      });
      
      setEditModalVisible(false);
      showAlert(tc('success'), t('editSuccess'));
    } catch (error) {

      showAlert(tc('error'), t('editError'));
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* Hero Header - Full Width */}
        <LinearGradient
          colors={[colors.emerald, colors.emeraldDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroIconBg}>
            <MaterialCommunityIcons name="account-group" size={36} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>{t('title')}</Text>
          <Text style={styles.heroSubtitle}>{t('subtitle')}</Text>
        </LinearGradient>
        
        {/* Stats Row - With Horizontal Padding */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: colors.emeraldLight }]}>
                <Ionicons name="people" size={18} color={colors.emerald} />
              </View>
              <Text style={styles.statValue}>{connections.length}</Text>
              <Text style={styles.statLabel}>{t('connections')}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: colors.premiumLight }]}>
                <Ionicons name="mail" size={18} color={colors.premium} />
              </View>
              <Text style={styles.statValue}>{receivedInvitations.length}</Text>
              <Text style={styles.statLabel}>{t('received')}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="send" size={18} color="#3b82f6" />
              </View>
              <Text style={styles.statValue}>{sentInvitations.length}</Text>
              <Text style={styles.statLabel}>{t('sent')}</Text>
            </View>
          </View>
        </View>

        {/* Invite Button */}
        <View style={styles.section}>
          <Pressable style={styles.inviteButton} onPress={() => router.push('/care-circle/invite')}>
            <LinearGradient
              colors={[colors.primary, '#0ea18f']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.inviteButtonGradient}
            >
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.inviteButtonText}>{t('inviteNew')}</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Received Invitations */}
        {receivedInvitations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: colors.premiumLight }]}>
                <Ionicons name="mail-unread" size={16} color={colors.premium} />
              </View>
              <Text style={styles.sectionTitle}>{t('receivedInvitations', { count: receivedInvitations.length })}</Text>
            </View>
            {receivedInvitations.map((invitation) => (
              <View key={invitation.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <LinearGradient
                    colors={[colors.premium, colors.premiumDark]}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarText}>
                      {invitation.requester_name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </LinearGradient>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>
                      {invitation.requester_name || `User ${invitation.requester_id}`}
                    </Text>
                    <View style={styles.cardBadge}>
                      <Ionicons name="link" size={12} color={colors.primary} />
                      <Text style={styles.cardRelation}>
                        {invitation.relationship_type || invitation.role || t('connection')}
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
              </View>
            ))}
          </View>
        )}

        {/* Sent Invitations */}
        {sentInvitations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="send" size={16} color="#3b82f6" />
              </View>
              <Text style={styles.sectionTitle}>{t('sentInvitations', { count: sentInvitations.length })}</Text>
            </View>
            {sentInvitations.map((invitation) => (
              <View key={invitation.id} style={[styles.card, styles.cardPending]}>
                <View style={styles.cardHeader}>
                  <LinearGradient
                    colors={['#3b82f6', '#2563eb']}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarText}>
                      {invitation.addressee_name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </LinearGradient>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>
                      {invitation.addressee_name || `User ${invitation.addressee_id}`}
                    </Text>
                    <View style={styles.pendingBadge}>
                      <Ionicons name="time" size={12} color={colors.premium} />
                      <Text style={styles.cardStatus}>{t('waitingResponse')}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Active Connections */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBg, { backgroundColor: colors.emeraldLight }]}>
              <Ionicons name="people" size={16} color={colors.emerald} />
            </View>
            <Text style={styles.sectionTitle}>
              {t('activeConnections', { count: connections.length })}
            </Text>
          </View>
          {loading && connections.length === 0 ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
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
              const isRequester = connection.requester_id === profile?.id;
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

              return (
                <View key={connection.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                      <LinearGradient
                        colors={[colors.emerald, colors.emeraldDark]}
                        style={styles.avatar}
                      >
                        <Text style={styles.avatarText}>
                          {otherUserFullName?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </LinearGradient>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName}>
                          {otherUserFullName || `User ${otherUserId}`}
                        </Text>
                        {otherUserEmail && (
                          <View style={styles.contactRow}>
                            <Ionicons name="mail-outline" size={12} color={colors.textSecondary} />
                            <Text style={styles.cardContact} numberOfLines={1}>
                              {otherUserEmail}
                            </Text>
                          </View>
                        )}
                        {otherUserPhone && (
                          <View style={styles.contactRow}>
                            <Ionicons name="call-outline" size={12} color={colors.textSecondary} />
                            <Text style={styles.cardContact} numberOfLines={1}>
                              {otherUserPhone}
                            </Text>
                          </View>
                        )}
                        {(displayRelationship || connection.role) && (
                          <View style={styles.cardBadge}>
                            <Ionicons name="heart" size={12} color={colors.primary} />
                            <Text style={styles.cardRelation}>
                              {displayRelationship || connection.role}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.cardActionsSmall}>
                      <TouchableOpacity
                        onPress={() => handleEditConnection({ ...connection, name: otherUserFullName || `User ${otherUserId}` })}
                        style={styles.iconBtn}
                      >
                        <Ionicons name="pencil" size={18} color={colors.primary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeleteConnection(connection.id, otherUserFullName || t('thisPerson'))}
                        disabled={actionLoading === connection.id}
                        style={styles.iconBtn}
                      >
                        {actionLoading === connection.id ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <Ionicons name="trash" size={18} color={colors.danger} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Edit Connection Modal */}
        <Modal
          visible={editModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setEditModalVisible(false)}
        >
          <Screen>
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <LinearGradient
                  colors={['#6366f1', '#8b5cf6']}
                  style={styles.modalIconBg}
                >
                  <Ionicons name="person" size={24} color="#fff" />
                </LinearGradient>
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
              
              <View style={styles.buttonGroup}>
                <Button
                  label={tc('cancel')}
                  variant="ghost"
                  onPress={() => setEditModalVisible(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  label={tc('save')}
                  variant="primary"
                  onPress={handleSaveEdit}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </Screen>
        </Modal>
      </ScrollView>
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
    overflow: 'hidden',
  },
  statsContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: typography.size.md,
    color: 'rgba(255,255,255,0.85)',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
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
  sectionIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inviteButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  inviteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: typography.size.md,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  cardPending: {
    borderColor: colors.premiumLight,
    backgroundColor: '#fffbeb',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
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
    marginBottom: 2,
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
    backgroundColor: '#f0fdfa',
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
    backgroundColor: '#f3f4f6',
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
    backgroundColor: '#f3f4f6',
  },
  rejectButtonText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: '600'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
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
  modalContent: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
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
  currentInfoBox: {
    backgroundColor: '#f0f9ff',
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
