import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
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
      setToastMessage(t('cannotLoadUsers'));
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
      setToastMessage(t('pleaseSelectRecipient'));
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
      setToastMessage(t('inviteSentSuccess'));
      setToastType('success');
      setShowToast(true);
      setTimeout(() => router.back(), 1500);
    } catch (error: any) {
      console.log('[invite] Error sending invitation:', error);
      setToastMessage(error.message || t('cannotSendInvite'));
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
          <H1SectionHeader title={t('inviteTitle')} />
          <Text style={styles.subtitle}>{t('inviteSubtitle')}</Text>
        </View>

        <View style={styles.section}>
          <Dropdown
            label={t('selectUser')}
            placeholder={usersLoading ? t('loadingUsers') : (allUsers.length === 0 ? t('noUsersAvailable') : t('selectRecipient'))}
            options={userOptions}
            value={selectedUser}
            onChange={setSelectedUser}
            searchable
            loading={usersLoading}
          />
          {!usersLoading && allUsers.length === 0 && (
            <Text style={styles.errorText}>{t('noUsersToInvite')}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Dropdown
            label={t('relationship')}
            placeholder={t('selectRelationship')}
            options={relationshipOptions}
            value={selectedRelationship}
            onChange={setSelectedRelationship}
            searchable
          />
        </View>

        <View style={styles.section}>
          <Dropdown
            label={t('role')}
            placeholder={t('selectRole')}
            options={roleOptions}
            value={selectedRole}
            onChange={setSelectedRole}
            searchable
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('permissions')}</Text>

          <View style={styles.permissionRow}>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>{t('permViewLogs')}</Text>
              <Text style={styles.permissionDesc}>{t('permViewLogsDesc')}</Text>
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
              <Text style={styles.permissionTitle}>{t('permReceiveAlerts')}</Text>
              <Text style={styles.permissionDesc}>{t('permReceiveAlertsDesc')}</Text>
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
              <Text style={styles.permissionTitle}>{t('permAckEscalation')}</Text>
              <Text style={styles.permissionDesc}>{t('permAckEscalationDesc')}</Text>
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
            label={loading ? t('sending') : t('sendInvite')}
            onPress={handleSend}
            disabled={loading || !selectedUser}
          />
          <Button
            label={tc('cancel')}
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
