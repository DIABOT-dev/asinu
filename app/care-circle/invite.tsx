import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DropdownOption } from '../../src/components/Dropdown';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { showToast } from '../../src/stores/toast.store';
import { careCircleApi, useCareCircle } from '../../src/features/care-circle';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, iconColors, radius, spacing, brandColors} from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

type SearchUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

const PERM_META = [
  {
    key: 'can_view_logs' as const,
    titleKey: 'permViewLogs',
    descKey: 'permViewLogsDesc',
    icon: 'file-document-outline' as const,
    color: '#3b82f6',
    bg: '#eff6ff',
  },
  {
    key: 'can_receive_alerts' as const,
    titleKey: 'permReceiveAlerts',
    descKey: 'permReceiveAlertsDesc',
    icon: 'bell-ring-outline' as const,
    color: '#f59e0b',
    bg: '#fffbeb',
  },
  {
    key: 'can_ack_escalation' as const,
    titleKey: 'permAckEscalation',
    descKey: 'permAckEscalationDesc',
    icon: 'shield-check-outline' as const,
    color: '#10b981',
    bg: '#ecfdf5',
  },
];

export default function InviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const profile = useAuthStore(state => state.profile);
  const { createInvitation, loading, invitations, connections, fetchInvitations, fetchConnections } = useCareCircle();

  const [phoneQuery, setPhoneQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchedUser, setSearchedUser] = useState<SearchUser | null>(null);
  const [searchError, setSearchError] = useState('');
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<DropdownOption | null>(null);
  const [selectedRole, setSelectedRole] = useState<DropdownOption | null>(null);
  const [customRelationship, setCustomRelationship] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [showRelDropdown, setShowRelDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [permissions, setPermissions] = useState({
    can_view_logs: true,
    can_receive_alerts: true,
    can_ack_escalation: true,
  });

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

  const handleSearchByPhone = async () => {
    const phone = phoneQuery.trim();
    const isValidPhone = /^(0[0-9]{9}|\+84[0-9]{9})$/.test(phone);
    if (!isValidPhone) {
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
    } catch {
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
    fetchInvitations(true);
    fetchConnections(true);
  }, []);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleSend = async () => {
    if (!selectedUser) {
      showToast(t('pleaseSelectRecipient'), 'error');
      return;
    }
    try {
      await createInvitation({
        addressee_id: selectedUser.id,
        relationship_type: selectedRelationship?.label || customRelationship || undefined,
        role: selectedRole?.label || customRole || undefined,
        permissions,
      });
      showToast(t('inviteSentSuccess'), 'success');
      setTimeout(() => router.back(), 1500);
    } catch (error: any) {
      // Connection limit exceeded → show premium upgrade modal
      if (error.statusCode === 403 || error.message?.includes('premium') || error.message?.includes('Premium')) {
        setShowUpgradeModal(true);
      } else {
        showToast(error.message || t('cannotSendInvite'), 'error');
      }
    }
  };

  const canSend = !!selectedUser && !loading;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('inviteTitle'),
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 160 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeIn.duration(250)} style={{ gap: spacing.md }}>
        {/* ─── Hero ─── */}
        <View style={styles.heroCard}>
            <MaterialCommunityIcons name="account-plus-outline" size={28} color={iconColors.primary} />
            <Text style={styles.heroTitle}>{t('inviteTitle')}</Text>
            <Text style={styles.heroSubtitle}>{t('inviteSubtitle')}</Text>
          </View>

        {/* ─── Phone Search ─── */}
        <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="phone-outline" size={18} color={iconColors.indigo} />
              <Text style={styles.cardTitle}>{t('searchByPhone')}</Text>
            </View>

            <View style={styles.phoneSearchRow}>
              <View style={styles.phoneInputWrap}>
                <TextInput
                  style={styles.comboInput}
                  value={phoneQuery}
                  onChangeText={text => {
                    setPhoneQuery(text);
                    setSearchedUser(null);
                    setSelectedUser(null);
                    setSearchError('');
                  }}
                  placeholder={t('enterPhoneNumber')}
                  placeholderTextColor={colors.textSecondary + '88'}
                  keyboardType="phone-pad"
                  returnKeyType="search"
                  onSubmitEditing={handleSearchByPhone}
                />
              </View>
              <Pressable
                style={({ pressed }) => [styles.searchBtn, searchLoading && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
                onPress={handleSearchByPhone}
                disabled={searchLoading}
              >
                {searchLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="search" size={20} color="#fff" />
                }
              </Pressable>
            </View>

            {/* Search result */}
            {searchedUser && !selectedUser && (
              <Pressable
                style={({ pressed }) => [styles.foundUserCard, pressed && { opacity: 0.85 }]}
                onPress={handleSelectSearchedUser}
              >
                <View style={styles.foundUserAvatar}>
                  <MaterialCommunityIcons name="account-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.foundUserInfo}>
                  <Text style={styles.foundUserName}>{searchedUser.name}</Text>
                  {searchedUser.phone && (
                    <Text style={styles.foundUserPhone}>{searchedUser.phone}</Text>
                  )}
                </View>
                <View style={styles.selectBtnWrap}>
                  <MaterialCommunityIcons name="plus-circle" size={14} color={colors.primary} />
                  <Text style={styles.selectBtnText}>{t('selectThisUser')}</Text>
                </View>
              </Pressable>
            )}

            {/* Selected user */}
            {selectedUser && (
              <View style={styles.selectedUserCard}>
                <View style={styles.selectedUserAvatar}>
                  <MaterialCommunityIcons name="account-check" size={22} color="#fff" />
                </View>
                <View style={styles.foundUserInfo}>
                  <Text style={styles.foundUserName}>{selectedUser.name}</Text>
                  {selectedUser.phone && (
                    <Text style={styles.foundUserPhone}>{selectedUser.phone}</Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => { setSelectedUser(null); setSearchedUser(null); }}
                  style={styles.clearBtn}
                >
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {searchError ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{searchError}</Text>
              </View>
            ) : null}
          </View>

        {/* ─── Relationship & Role ─── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="heart-outline" size={18} color={iconColors.pink} />
              <Text style={styles.cardTitle}>{t('relationship')}</Text>
              <Text style={styles.optionalBadge}>{t('optional')}</Text>
            </View>
            <View style={styles.comboInputRow}>
              <TextInput
                style={styles.comboInput}
                value={selectedRelationship ? selectedRelationship.label : customRelationship}
                onChangeText={text => { setCustomRelationship(text); setSelectedRelationship(null); }}
                placeholder={t('relPlaceholder')}
                placeholderTextColor={colors.textSecondary + '88'}
              />
              <Pressable style={styles.comboDropBtn} onPress={() => setShowRelDropdown(v => !v)}>
                <Ionicons name={showRelDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
              </Pressable>
            </View>
            {showRelDropdown && (
              <ScrollView style={styles.suggestionList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {relationshipOptions.map(opt => (
                  <Pressable key={opt.id} style={styles.suggestionItem} onPress={() => {
                    setSelectedRelationship(opt);
                    setCustomRelationship('');
                    setShowRelDropdown(false);
                  }}>
                    <Text style={styles.suggestionText}>{opt.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="badge-account-horizontal-outline" size={18} color={iconColors.violet} />
              <Text style={styles.cardTitle}>{t('role')}</Text>
              <Text style={styles.optionalBadge}>{t('optional')}</Text>
            </View>
            <View style={styles.comboInputRow}>
              <TextInput
                style={styles.comboInput}
                value={selectedRole ? selectedRole.label : customRole}
                onChangeText={text => { setCustomRole(text); setSelectedRole(null); }}
                placeholder={t('rolePlaceholder')}
                placeholderTextColor={colors.textSecondary + '88'}
              />
              <Pressable style={styles.comboDropBtn} onPress={() => setShowRoleDropdown(v => !v)}>
                <Ionicons name={showRoleDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
              </Pressable>
            </View>
            {showRoleDropdown && (
              <ScrollView style={styles.suggestionList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {roleOptions.map(opt => (
                  <Pressable key={opt.id} style={styles.suggestionItem} onPress={() => {
                    setSelectedRole(opt);
                    setCustomRole('');
                    setShowRoleDropdown(false);
                  }}>
                    <Text style={styles.suggestionText}>{opt.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

        {/* ─── Permissions ─── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="lock-open-outline" size={18} color={iconColors.emerald} />
              <Text style={styles.cardTitle}>{t('permissions')}</Text>
            </View>

            {PERM_META.map((perm, i) => (
              <View
                key={perm.key}
                style={[styles.permissionRow, i === PERM_META.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={styles.permIconWrap}>
                  <MaterialCommunityIcons name={perm.icon} size={18} color={perm.color} />
                </View>
                <View style={styles.permissionInfo}>
                  <Text style={styles.permissionTitle}>{t(perm.titleKey)}</Text>
                  <Text style={styles.permissionDesc}>{t(perm.descKey)}</Text>
                </View>
                <Switch
                  value={permissions[perm.key]}
                  onValueChange={(value) => setPermissions(prev => ({ ...prev, [perm.key]: value }))}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>
            ))}
          </View>

        {/* ─── Actions ─── */}
          <View style={styles.actionsWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleSend}
            disabled={!canSend || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Text style={styles.sendBtnText}>{t('sendInvite')}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelBtnText}>{tc('cancel')}</Text>
          </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Premium upgrade modal — connection limit */}
      <Modal visible={showUpgradeModal} transparent animationType="fade" onRequestClose={() => setShowUpgradeModal(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowUpgradeModal(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="account-group" size={36} color={colors.premium} />
            </View>
            <Text style={styles.modalTitle}>{tc('connectionLimitTitle')}</Text>
            <Text style={styles.modalDesc}>{tc('connectionLimitDesc')}</Text>
            <Pressable
              style={styles.modalUpgradeBtn}
              onPress={() => {
                setShowUpgradeModal(false);
                router.push('/subscription');
              }}
            >
              <MaterialCommunityIcons name="crown" size={16} color="#fff" />
              <Text style={styles.modalUpgradeText}>{tc('voiceUpgrade')}</Text>
            </Pressable>
            <Pressable style={styles.modalCancelBtn} onPress={() => setShowUpgradeModal(false)}>
              <Text style={styles.modalCancelText}>{tc('later')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    scrollContent: {
      padding: spacing.xl,
      gap: spacing.md,
    },

    // ── Hero ──
    heroCard: {
      borderRadius: radius.xl,
      padding: spacing.xl,
      alignItems: 'center',
      backgroundColor: colors.primaryLight,
      borderWidth: 1.5,
      borderColor: colors.primary + '22',
      gap: spacing.sm,
    },
    heroTitle: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    heroSubtitle: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },

    // ── Card ──
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    cardTitle: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    // ── Phone Search ──
    phoneSearchRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
    },
    phoneInputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    phoneInput: {
      flex: 1,
      paddingHorizontal: spacing.sm,
      paddingRight: spacing.md,
      paddingVertical: 0,
      fontSize: typography.size.sm,
      color: colors.textPrimary,
      height: 48,
      textAlignVertical: 'center',
    },
    searchBtn: {
      width: 48,
      height: 48,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },

    // ── Found User ──
    foundUserCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.primary + '33',
      backgroundColor: colors.primaryLight,
      gap: spacing.md,
    },
    foundUserAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    foundUserInfo: {
      flex: 1,
    },
    foundUserName: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    foundUserPhone: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
    selectBtnWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary + '15',
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 2,
    },
    selectBtnText: {
      fontSize: typography.size.xxs,
      fontWeight: '700',
      color: colors.primary,
    },

    // ── Selected User ──
    selectedUserCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
      gap: spacing.md,
    },
    selectedUserAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Error ──
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.sm,
    },
    errorText: {
      fontSize: typography.size.xs,
      color: colors.danger,
      flex: 1,
    },

    // ── Permissions ──
    permissionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    permIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    permissionInfo: {
      flex: 1,
    },
    permissionTitle: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    permissionDesc: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },

    // ── Actions ──
    actionsWrap: {
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    sendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      backgroundColor: colors.primary,
      borderRadius: 14,
      shadowColor: colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    sendBtnText: {
      color: '#ffffff',
      fontSize: typography.size.md,
      fontWeight: '700',
    },
    cancelBtn: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.danger + '60',
      backgroundColor: colors.danger + '0d',
    },
    cancelBtnText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.danger,
    },
    optionalBadge: {
      fontSize: typography.size.xxs,
      color: colors.textSecondary,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 6,
      marginLeft: 'auto' as any,
    },
    comboInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    comboInput: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: typography.size.sm,
      color: colors.textPrimary,
    },
    comboDropBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },
    suggestionList: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      maxHeight: 200,
    },
    suggestionItem: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    suggestionText: {
      fontSize: typography.size.sm,
      color: colors.textPrimary,
    },

    // Premium modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    modalCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: spacing.xxl,
      alignItems: 'center',
      gap: spacing.md,
    },
    modalIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.premiumLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: typography.size.md,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    modalDesc: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },
    modalUpgradeBtn: {
      backgroundColor: colors.premium,
      borderRadius: radius.full,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xxl,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      alignSelf: 'stretch',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    modalUpgradeText: {
      color: '#fff',
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
    modalCancelBtn: {
      paddingVertical: spacing.sm,
    },
    modalCancelText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: '600',
    },
  });
}
