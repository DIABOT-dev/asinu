import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Dropdown, DropdownOption } from '../../src/components/Dropdown';
import { Screen } from '../../src/components/Screen';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useCareCircle } from '../../src/features/care-circle';
import { colors, spacing, typography } from '../../src/styles';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';

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
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <H1SectionHeader title="Vòng kết nối" />
          <Text style={styles.subtitle}>Quản lý người thân và người chăm sóc</Text>
        </View>

        <View style={styles.section}>
          <Button
            label="+ Mời người mới"
            onPress={() => router.push('/care-circle/invite')}
            style={styles.inviteButton}
          />
        </View>

        {/* Received Invitations */}
        {receivedInvitations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lời mời đã nhận ({receivedInvitations.length})</Text>
            {receivedInvitations.map((invitation) => (
              <View key={invitation.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {invitation.requester_name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>
                      {invitation.requester_name || `User ${invitation.requester_id}`}
                    </Text>
                    <Text style={styles.cardRelation}>
                      {invitation.relationship_type || invitation.role || 'Kết nối'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAccept(invitation.id)}
                    disabled={actionLoading === invitation.id}
                  >
                    {actionLoading === invitation.id ? (
                      <ActivityIndicator size="small" color={colors.surface} />
                    ) : (
                      <Text style={styles.acceptButtonText}>Chấp nhận</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleReject(invitation.id)}
                    disabled={actionLoading === invitation.id}
                  >
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
            <Text style={styles.sectionTitle}>Lời mời đã gửi ({sentInvitations.length})</Text>
            {sentInvitations.map((invitation) => (
              <View key={invitation.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {invitation.addressee_name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>
                      {invitation.addressee_name || `User ${invitation.addressee_id}`}
                    </Text>
                    <Text style={styles.cardStatus}>Đang chờ phản hồi...</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Active Connections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Kết nối đang hoạt động ({connections.length})
          </Text>
          {loading && connections.length === 0 ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : connections.length === 0 ? (
            <View style={styles.emptyState}>
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

              return (
                <View key={connection.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {otherUserFullName?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName}>
                          {otherUserFullName || `User ${otherUserId}`}
                        </Text>
                        {otherUserEmail && (
                          <Text style={styles.cardContact} numberOfLines={1}>
                            {otherUserEmail}
                          </Text>
                        )}
                        {otherUserPhone && (
                          <Text style={styles.cardContact} numberOfLines={1}>
                            {otherUserPhone}
                          </Text>
                        )}
                        {(connection.relationship_type || connection.role) && (
                          <Text style={styles.cardRelation}>
                            {connection.relationship_type || connection.role}
                          </Text>
                        )}
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleEditConnection({ ...connection, name: otherUserFullName || `User ${otherUserId}` })}
                      style={{ padding: spacing.sm }}
                    >
                      <Ionicons name="pencil" size={18} color={colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteConnection(connection.id, otherUserFullName || 'người này')}
                      disabled={actionLoading === connection.id}
                      style={{ padding: spacing.sm }}
                    >
                      {actionLoading === connection.id ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Ionicons name="trash" size={18} color={colors.danger} />
                      )}
                    </TouchableOpacity>
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
              <H1SectionHeader title={`Chỉnh sửa: ${editConnection?.name}`} />
              
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
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md
  },
  inviteButton: {
    backgroundColor: colors.primary
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
  },
  avatarText: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.surface
  },
  cardInfo: {
    flex: 1
  },
  cardName: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2
  },
  cardContact: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2
  },
  cardRelation: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2
  },
  cardStatus: {
    fontSize: typography.size.sm,
    color: colors.warning,
    fontStyle: 'italic'
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40
  },
  acceptButton: {
    backgroundColor: colors.primary
  },
  acceptButtonText: {
    color: colors.surface,
    fontSize: typography.size.sm,
    fontWeight: '600'
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border
  },
  rejectButtonText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    fontWeight: '600'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl
  },
  emptyText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    marginBottom: spacing.xs
  },
  emptySubtext: {
    fontSize: typography.size.sm,
    color: colors.textSecondary
  },
  loader: {
    marginVertical: spacing.xl
  },
  inputLabel: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface
  },
  modalContent: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl
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
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary
  },
  currentInfoTitle: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs
  },
  currentInfoText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2
  }
});
