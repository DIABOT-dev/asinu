import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Dropdown, DropdownOption } from '../../src/components/Dropdown';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useCareCircle } from '../../src/features/care-circle';
import { colors, spacing, typography } from '../../src/styles';

export default function CareCircleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((state) => state.profile);
  
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
    { id: 'vo', label: 'Vợ', subtitle: 'Người phối ngẫu' },
    { id: 'chong', label: 'Chồng', subtitle: 'Người phối ngẫu' },
    { id: 'con-trai', label: 'Con trai', subtitle: 'Con ruột' },
    { id: 'con-gai', label: 'Con gái', subtitle: 'Con ruột' },
    { id: 'me', label: 'Mẹ', subtitle: 'Cha mẹ' },
    { id: 'bo', label: 'Bố', subtitle: 'Cha mẹ' },
    { id: 'anh-trai', label: 'Anh trai', subtitle: 'Anh chị em ruột' },
    { id: 'chi-gai', label: 'Chị gái', subtitle: 'Anh chị em ruột' },
    { id: 'em-trai', label: 'Em trai', subtitle: 'Anh chị em ruột' },
    { id: 'em-gai', label: 'Em gái', subtitle: 'Anh chị em ruột' },
    { id: 'ong-noi', label: 'Ông nội', subtitle: 'Ông bà nội' },
    { id: 'ba-noi', label: 'Bà nội', subtitle: 'Ông bà nội' },
    { id: 'ong-ngoai', label: 'Ông ngoại', subtitle: 'Ông bà ngoại' },
    { id: 'ba-ngoai', label: 'Bà ngoại', subtitle: 'Ông bà ngoại' },
    { id: 'ban-than', label: 'Bạn thân', subtitle: 'Bạn bè thân thiết' },
    { id: 'nguoi-yeu', label: 'Người yêu', subtitle: 'Bạn đời' },
  ];

  // Role options
  const roleOptions: DropdownOption[] = [
    { id: 'nguoi-cham-soc', label: 'Người chăm sóc chính', subtitle: 'Chăm sóc hàng ngày' },
    { id: 'bac-si', label: 'Bác sĩ gia đình', subtitle: 'Chuyên gia y tế' },
    { id: 'y-ta', label: 'Y tá', subtitle: 'Hỗ trợ y tế' },
    { id: 'duoc-si', label: 'Dược sĩ', subtitle: 'Quản lý thuốc' },
    { id: 'chuyen-gia-dinh-duong', label: 'Chuyên gia dinh dưỡng', subtitle: 'Tư vấn chế độ ăn' },
    { id: 'huan-luyen-vien', label: 'Huấn luyện viên', subtitle: 'Tập luyện & vận động' },
    { id: 'nguoi-ho-tro', label: 'Người hỗ trợ', subtitle: 'Hỗ trợ thêm' },
    { id: 'than-nhan', label: 'Thân nhân', subtitle: 'Người thân trong gia đình' },
    { id: 'nguoi-giup-viec', label: 'Người giúp việc', subtitle: 'Hỗ trợ sinh hoạt' },
    { id: 'tu-van-tam-ly', label: 'Tư vấn tâm lý', subtitle: 'Chăm sóc sức khỏe tinh thần' },
  ];

  // Hàm đảo ngược mối quan hệ: nếu người khác gọi mình là "Bố" thì mình gọi họ là "Con"
  const reverseRelationship = (relationshipType: string | undefined): string => {
    if (!relationshipType) return '';
    
    const reverseMap: Record<string, string> = {
      // Cha mẹ <-> Con cái
      'bo': 'Con',
      'Bố': 'Con',
      'me': 'Con',
      'Mẹ': 'Con',
      'con-trai': 'Bố/Mẹ',
      'Con trai': 'Bố/Mẹ',
      'con-gai': 'Bố/Mẹ',
      'Con gái': 'Bố/Mẹ',
      
      // Vợ chồng (đối xứng)
      'vo': 'Chồng',
      'Vợ': 'Chồng',
      'chong': 'Vợ',
      'Chồng': 'Vợ',
      
      // Anh chị em
      'anh-trai': 'Em',
      'Anh trai': 'Em',
      'chi-gai': 'Em',
      'Chị gái': 'Em',
      'em-trai': 'Anh/Chị',
      'Em trai': 'Anh/Chị',
      'em-gai': 'Anh/Chị',
      'Em gái': 'Anh/Chị',
      
      // Ông bà <-> Cháu
      'ong-noi': 'Cháu',
      'Ông nội': 'Cháu',
      'ba-noi': 'Cháu',
      'Bà nội': 'Cháu',
      'ong-ngoai': 'Cháu',
      'Ông ngoại': 'Cháu',
      'ba-ngoai': 'Cháu',
      'Bà ngoại': 'Cháu',
      
      // Bạn bè, người yêu (đối xứng)
      'ban-than': 'Bạn thân',
      'Bạn thân': 'Bạn thân',
      'nguoi-yeu': 'Người yêu',
      'Người yêu': 'Người yêu',
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
      Alert.alert('Thành công', 'Đã chấp nhận lời mời');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể chấp nhận lời mời');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setActionLoading(id);
      await rejectInvitation(id);
      Alert.alert('Đã từ chối', 'Lời mời đã bị từ chối');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể từ chối lời mời');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConnection = async (id: string, name: string) => {
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc muốn xóa kết nối với ${name}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(id);
              await deleteConnection(id);
              Alert.alert('Đã xóa', 'Kết nối đã được xóa');
            } catch (error) {
              Alert.alert('Lỗi', 'Không thể xóa kết nối');
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
      Alert.alert('Thông báo', 'Chỉnh sửa thông tin thành công');
    } catch (error) {
      console.error('Failed to update connection:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật thông tin. Vui lòng thử lại.');
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
    <Screen>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ 
          paddingTop: insets.top,
          paddingBottom: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* Hero Header - Full Width */}
        <LinearGradient
          colors={['#10b981', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroIconBg}>
            <MaterialCommunityIcons name="account-group" size={36} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Vòng kết nối</Text>
          <Text style={styles.heroSubtitle}>Quản lý người thân và người chăm sóc</Text>
        </LinearGradient>
        
        {/* Stats Row - With Horizontal Padding */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#d1fae5' }]}>
                <Ionicons name="people" size={18} color="#10b981" />
              </View>
              <Text style={styles.statValue}>{connections.length}</Text>
              <Text style={styles.statLabel}>Kết nối</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="mail" size={18} color="#f59e0b" />
              </View>
              <Text style={styles.statValue}>{receivedInvitations.length}</Text>
              <Text style={styles.statLabel}>Đã nhận</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="send" size={18} color="#3b82f6" />
              </View>
              <Text style={styles.statValue}>{sentInvitations.length}</Text>
              <Text style={styles.statLabel}>Đã gửi</Text>
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
              <Text style={styles.inviteButtonText}>Mời người mới</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Received Invitations */}
        {receivedInvitations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="mail-unread" size={16} color="#f59e0b" />
              </View>
              <Text style={styles.sectionTitle}>Lời mời đã nhận ({receivedInvitations.length})</Text>
            </View>
            {receivedInvitations.map((invitation) => (
              <View key={invitation.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <LinearGradient
                    colors={['#f59e0b', '#d97706']}
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
                        {invitation.relationship_type || invitation.role || 'Kết nối'}
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
                        <Text style={styles.acceptButtonText}>Chấp nhận</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleReject(invitation.id)}
                    disabled={actionLoading === invitation.id}
                  >
                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                    <Text style={styles.rejectButtonText}>Từ chối</Text>
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
              <Text style={styles.sectionTitle}>Lời mời đã gửi ({sentInvitations.length})</Text>
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
                      <Ionicons name="time" size={12} color="#f59e0b" />
                      <Text style={styles.cardStatus}>Đang chờ phản hồi</Text>
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
            <View style={[styles.sectionIconBg, { backgroundColor: '#d1fae5' }]}>
              <Ionicons name="people" size={16} color="#10b981" />
            </View>
            <Text style={styles.sectionTitle}>
              Kết nối đang hoạt động ({connections.length})
            </Text>
          </View>
          {loading && connections.length === 0 ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : connections.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBg}>
                <MaterialCommunityIcons name="account-group-outline" size={48} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyText}>Chưa có kết nối nào</Text>
              <Text style={styles.emptySubtext}>Mời người thân hoặc người chăm sóc để bắt đầu</Text>
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
                        colors={['#10b981', '#059669']}
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
                        onPress={() => handleDeleteConnection(connection.id, otherUserFullName || 'người này')}
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
                <Text style={styles.modalTitle}>Chỉnh sửa kết nối</Text>
                <Text style={styles.modalSubtitle}>{editConnection?.name}</Text>
              </View>
              
              <View style={styles.currentInfoBox}>
                <Text style={styles.currentInfoTitle}>Thông tin hiện tại:</Text>
                <Text style={styles.currentInfoText}>
                  Mối quan hệ: {editRelationType?.label || 'Chưa có'}
                </Text>
                <Text style={styles.currentInfoText}>
                  Vai trò: {editRole?.label || 'Chưa có'}
                </Text>
              </View>
              
              <View style={styles.modalSection}>
                <Dropdown
                  label="Mối quan hệ"
                  placeholder="Chọn mối quan hệ..."
                  options={relationshipOptions}
                  value={editRelationType}
                  onChange={setEditRelationType}
                  searchable
                />
              </View>
              
              <View style={styles.modalSection}>
                <Dropdown
                  label="Vai trò"
                  placeholder="Chọn vai trò..."
                  options={roleOptions}
                  value={editRole}
                  onChange={setEditRole}
                  searchable
                />
              </View>
              
              <View style={styles.buttonGroup}>
                <Button
                  label="Hủy"
                  variant="ghost"
                  onPress={() => setEditModalVisible(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Lưu"
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
  );
}

const styles = StyleSheet.create({
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
    fontSize: 22,
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
    borderColor: '#fef3c7',
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
    color: '#f59e0b',
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
