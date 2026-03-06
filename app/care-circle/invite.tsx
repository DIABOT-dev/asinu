import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Dropdown, DropdownOption } from '../../src/components/Dropdown';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { Toast } from '../../src/components/Toast';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { careCircleApi, useCareCircle } from '../../src/features/care-circle';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, spacing } from '../../src/styles';
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
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);
  const profile = useAuthStore(state => state.profile);
  const { createInvitation, loading, invitations, connections, fetchInvitations, fetchConnections } = useCareCircle();

  const [phoneQuery, setPhoneQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchedUser, setSearchedUser] = useState<SearchUser | null>(null);
  const [searchError, setSearchError] = useState('');
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
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

  const handleSearchByPhone = async () => {
    const phone = phoneQuery.trim();
    if (phone.length < 3) {
      setSearchError(t('phoneQueryTooShort'));
      setSearchedUser(null);
      setSelectedUser(null);
      return;
    }
    setSearchError('');
    setSearchLoading(true);
    setSearchedUser(null);
    setSelectedUser(null);
    try {
      const users = await careCircleApi.searchUsers(phone);
      if (!users || users.length === 0) {
        setSearchError(t('noUserFoundByPhone'));
      } else {
        setSearchedUser(users[0]);
      }
    } catch (error) {
      setSearchError(t('cannotLoadUsers'));
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSearchedUser = () => {
    if (!searchedUser) return;
    if (searchedUser.id === profile?.id) {
      setSearchError(t('cannotInviteSelf'));
      return;
    }
    const hasInvitation = invitations?.some(
      inv => String(inv.requester_id) === searchedUser.id || String(inv.addressee_id) === searchedUser.id
    );
    const hasConnection = connections?.some(
      conn => String(conn.requester_id) === searchedUser.id || String(conn.addressee_id) === searchedUser.id
    );
    if (hasInvitation || hasConnection) {
      setSearchError(t('alreadyConnected'));
      return;
    }
    setSelectedUser(searchedUser);
    setSearchError('');
  };

  useEffect(() => {
    fetchInvitations();
    fetchConnections();
  }, []);

  const handleSend = async () => {

    if (!selectedUser) {
      setToastMessage(t('pleaseSelectRecipient'));
      setToastType('error');
      setShowToast(true);
      return;
    }

    try {
      await createInvitation({
        addressee_id: selectedUser.id,
        relationship_type: selectedRelationship?.label || undefined,
        role: selectedRole?.label || undefined,
        permissions
      });

      setToastMessage(t('inviteSentSuccess'));
      setToastType('success');
      setShowToast(true);
      setTimeout(() => router.back(), 1500);
    } catch (error: any) {

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

        {/* Phone number search section */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('searchByPhone')}</Text>
          <View style={styles.phoneSearchRow}>
            <TextInput
              style={styles.phoneInput}
              value={phoneQuery}
              onChangeText={text => {
                setPhoneQuery(text);
                setSearchedUser(null);
                setSelectedUser(null);
                setSearchError('');
              }}
              placeholder={t('enterPhoneNumber')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              returnKeyType="search"
              onSubmitEditing={handleSearchByPhone}
            />
            <TouchableOpacity
              style={[styles.searchBtn, searchLoading && { opacity: 0.6 }]}
              onPress={handleSearchByPhone}
              disabled={searchLoading}
            >
              {searchLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.searchBtnText}>{t('search')}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Search result */}
          {searchedUser && !selectedUser && (
            <TouchableOpacity style={styles.foundUserCard} onPress={handleSelectSearchedUser}>
              <View style={styles.foundUserInfo}>
                <Text style={styles.foundUserName}>{searchedUser.name}</Text>
                {searchedUser.phone && (
                  <Text style={styles.foundUserPhone}>{searchedUser.phone}</Text>
                )}
              </View>
              <Text style={styles.selectBtn}>{t('selectThisUser')}</Text>
            </TouchableOpacity>
          )}

          {/* Selected user */}
          {selectedUser && (
            <View style={[styles.foundUserCard, styles.selectedUserCard]}>
              <View style={styles.foundUserInfo}>
                <Text style={styles.foundUserName}>{selectedUser.name}</Text>
                {selectedUser.phone && (
                  <Text style={styles.foundUserPhone}>{selectedUser.phone}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => { setSelectedUser(null); setSearchedUser(null); }}>
                <Text style={styles.clearBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
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

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
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
  },
  phoneSearchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  searchBtn: {
    height: 48,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: typography.size.md,
  },
  foundUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectedUserCard: {
    borderColor: colors.primary,
    backgroundColor: '#f0fdfa',
  },
  foundUserInfo: {
    flex: 1,
  },
  foundUserName: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  foundUserPhone: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectBtn: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  clearBtn: {
    fontSize: 18,
    color: colors.textSecondary,
    paddingLeft: spacing.sm,
  },
});
}
