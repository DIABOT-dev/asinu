import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dropdown, DropdownOption } from '../../src/components/Dropdown';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { Toast } from '../../src/components/Toast';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { careCircleApi, useCareCircle } from '../../src/features/care-circle';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, radius, spacing } from '../../src/styles';

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
    can_ack_escalation: false,
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
        permissions,
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
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
        }}
      />
      <Toast
        visible={showToast}
        message={toastMessage}
        type={toastType}
        position="center"
        onHide={() => setShowToast(false)}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Hero ─── */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.heroCard}>
            <LinearGradient
              colors={[colors.primaryLight, '#fff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroIconWrap}>
              <MaterialCommunityIcons name="account-plus-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.heroTitle}>{t('inviteTitle')}</Text>
            <Text style={styles.heroSubtitle}>{t('inviteSubtitle')}</Text>
          </View>
        </Animated.View>

        {/* ─── Phone Search ─── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: '#eff6ff' }]}>
                <MaterialCommunityIcons name="phone-outline" size={18} color="#3b82f6" />
              </View>
              <Text style={styles.cardTitle}>{t('searchByPhone')}</Text>
            </View>

            <View style={styles.phoneSearchRow}>
              <View style={styles.phoneInputWrap}>
                <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginLeft: spacing.md }} />
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
        </Animated.View>

        {/* ─── Relationship & Role ─── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: '#fdf2f8' }]}>
                <MaterialCommunityIcons name="heart-outline" size={18} color="#ec4899" />
              </View>
              <Text style={styles.cardTitle}>{t('relationship')}</Text>
            </View>
            <Dropdown
              placeholder={t('selectRelationship')}
              options={relationshipOptions}
              value={selectedRelationship}
              onChange={setSelectedRelationship}
              searchable
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: '#f5f3ff' }]}>
                <MaterialCommunityIcons name="badge-account-horizontal-outline" size={18} color="#8b5cf6" />
              </View>
              <Text style={styles.cardTitle}>{t('role')}</Text>
            </View>
            <Dropdown
              placeholder={t('selectRole')}
              options={roleOptions}
              value={selectedRole}
              onChange={setSelectedRole}
              searchable
            />
          </View>
        </Animated.View>

        {/* ─── Permissions ─── */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: '#ecfdf5' }]}>
                <MaterialCommunityIcons name="lock-open-outline" size={18} color="#10b981" />
              </View>
              <Text style={styles.cardTitle}>{t('permissions')}</Text>
            </View>

            {PERM_META.map((perm, i) => (
              <View
                key={perm.key}
                style={[styles.permissionRow, i === PERM_META.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={[styles.permIconWrap, { backgroundColor: perm.bg }]}>
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
        </Animated.View>

        {/* ─── Actions ─── */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.actionsWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              !canSend && styles.sendBtnDisabled,
              pressed && canSend && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleSend}
            disabled={!canSend}
          >
            <LinearGradient
              colors={canSend ? [colors.primary, colors.primaryDark] : [colors.border, colors.border]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sendBtnGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={20} color={canSend ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.sendBtnText, !canSend && { color: colors.textSecondary }]}>
                    {t('sendInvite')}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelBtnText}>{tc('cancel')}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    scrollContent: {
      padding: spacing.lg,
      gap: spacing.md,
    },

    // ── Hero ──
    heroCard: {
      borderRadius: radius.xl,
      padding: spacing.xl,
      alignItems: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.primary + '22',
      gap: spacing.sm,
    },
    heroIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
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
      borderWidth: 1,
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
    cardIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
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
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      height: 48,
    },
    phoneInput: {
      flex: 1,
      paddingHorizontal: spacing.sm,
      paddingRight: spacing.md,
      fontSize: typography.size.sm,
      color: colors.textPrimary,
      height: 48,
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
      borderRadius: radius.full,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 5,
    },
    sendBtnDisabled: {
      shadowOpacity: 0,
    },
    sendBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md + 2,
    },
    sendBtnText: {
      color: '#fff',
      fontSize: typography.size.md,
      fontWeight: '700',
    },
    cancelBtn: {
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    cancelBtnText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
}
