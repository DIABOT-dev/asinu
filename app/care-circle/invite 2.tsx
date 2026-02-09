import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Dropdown, DropdownOption } from '../../src/components/Dropdown';
import { Screen } from '../../src/components/Screen';
import { Toast } from '../../src/components/Toast';
import { careCircleApi, useCareCircle } from '../../src/features/care-circle';
import { colors, spacing, typography } from '../../src/styles';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';

type SearchUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export default function InviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createInvitation, loading, invitations, connections, fetchInvitations, fetchConnections } = useCareCircle();

  const [allUsers, setAllUsers] = useState<SearchUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<DropdownOption | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<DropdownOption | null>(null);
  const [selectedRole, setSelectedRole] = useState<DropdownOption | null>(null);
  const [permissions, setPermissions] = useState({
    can_view_logs: false,
    can_receive_alerts: false,
    can_ack_escalation: false
  });

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

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const users = await careCircleApi.searchUsers('');
      console.log('Loaded users:', users);
      if (!users || users.length === 0) {
        console.warn('No users returned from API');
      }
      setAllUsers(users || []);
    } catch (error) {
      console.error('Load users error:', error);
      setToastMessage('Không thể tải danh sách người dùng');
      setToastType('error');
      setShowToast(true);
    } finally {
      setUsersLoading(false);
    }
  };

  // Load all users on mount
  useEffect(() => {
    fetchInvitations();
    fetchConnections();
    loadUsers();
  }, []);

  const userOptions: DropdownOption[] = allUsers.map(user => {
    // Check if user already has a connection (sent or received invitation, or existing connection)
    const hasInvitation = invitations?.some(inv => 
      inv.requester_id === user.id || inv.addressee_id === user.id
    );
    const hasConnection = connections?.some(conn => 
      conn.requester_id === user.id || conn.addressee_id === user.id
    );
    const isDisabled = hasInvitation || hasConnection;

    return {
      id: user.id,
      label: user.name,
      subtitle: user.email || user.phone || undefined,
      disabled: isDisabled
    };
  });

  const handleSend = async () => {
    console.log('[invite] handleSend called');
    if (!selectedUser) {
      console.log('[invite] No user selected');
      setToastMessage('Vui lòng chọn người nhận');
      setToastType('error');
      setShowToast(true);
      return;
    }

    console.log('[invite] Sending invitation with payload:', {
      addressee_id: selectedUser.id,
      relationship_type: selectedRelationship?.label,
      role: selectedRole?.label,
      permissions
    });

    try {
      await createInvitation({
        addressee_id: selectedUser.id,
        relationship_type: selectedRelationship?.label || undefined,
        role: selectedRole?.label || undefined,
        permissions
      });
      console.log('[invite] Invitation sent successfully');
      setToastMessage('Lời mời đã được gửi thành công!');
      setToastType('success');
      setShowToast(true);
      setTimeout(() => router.back(), 1500);
    } catch (error: any) {
      console.log('[invite] Error sending invitation:', error);
      setToastMessage(error.message || 'Không thể gửi lời mời');
      setToastType('error');
      setShowToast(true);
    }
  };

  return (
    <Screen>
      <Toast 
        visible={showToast} 
        message={toastMessage} 
        type={toastType} 
        position="center"
        onHide={() => setShowToast(false)} 
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <H1SectionHeader title="Mời kết nối" />
          <Text style={styles.subtitle}>Tìm và thêm người thân hoặc người chăm sóc vào vòng kết nối</Text>
        </View>

        <View style={styles.section}>
          <Dropdown
            label="Chọn người dùng *"
            placeholder={usersLoading ? 'Đang tải...' : (allUsers.length === 0 ? 'Chưa có người dùng nào' : 'Chọn người nhận lời mời...')}
            options={userOptions}
            value={selectedUser}
            onChange={setSelectedUser}
            searchable
            loading={usersLoading}
          />
          {!usersLoading && allUsers.length === 0 && (
            <Text style={styles.errorText}>Không có người dùng nào để mời. Vui lòng liên hệ quản trị viên.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Dropdown
            label="Mối quan hệ"
            placeholder="Chọn mối quan hệ..."
            options={relationshipOptions}
            value={selectedRelationship}
            onChange={setSelectedRelationship}
            searchable
          />
        </View>

        <View style={styles.section}>
          <Dropdown
            label="Vai trò"
            placeholder="Chọn vai trò..."
            options={roleOptions}
            value={selectedRole}
            onChange={setSelectedRole}
            searchable
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quyền truy cập</Text>
          
          <View style={styles.permissionRow}>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Xem nhật ký sức khỏe</Text>
              <Text style={styles.permissionDesc}>Cho phép xem các chỉ số và nhật ký</Text>
            </View>
            <Switch
              value={permissions.can_view_logs}
              onValueChange={(value) =>
                setPermissions({ ...permissions, can_view_logs: value })
              }
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.permissionRow}>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Nhận cảnh báo</Text>
              <Text style={styles.permissionDesc}>Nhận thông báo khi có vấn đề sức khỏe</Text>
            </View>
            <Switch
              value={permissions.can_receive_alerts}
              onValueChange={(value) =>
                setPermissions({ ...permissions, can_receive_alerts: value })
              }
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.permissionRow}>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Xác nhận cảnh báo</Text>
              <Text style={styles.permissionDesc}>Có thể xác nhận và xử lý cảnh báo</Text>
            </View>
            <Switch
              value={permissions.can_ack_escalation}
              onValueChange={(value) =>
                setPermissions({ ...permissions, can_ack_escalation: value })
              }
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Button 
            label={loading ? 'Đang gửi...' : 'Gửi lời mời'}
            onPress={handleSend} 
            disabled={loading || !selectedUser}
          />
          <Button
            label="Hủy"
            variant="secondary"
            onPress={() => router.back()}
            style={styles.cancelButton}
          />
        </View>
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
  label: {
    fontSize: typography.size.sm,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: spacing.xs
  },
  input: {
    marginBottom: 0
  },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.danger,
    marginTop: spacing.xs,
    textAlign: 'center'
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  permissionInfo: {
    flex: 1,
    marginRight: spacing.md
  },
  permissionTitle: {
    fontSize: typography.size.md,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2
  },
  permissionDesc: {
    fontSize: typography.size.sm,
    color: colors.textSecondary
  },
  cancelButton: {
    marginTop: spacing.sm
  }
});
