import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dropdown, type DropdownOption } from '../../src/components/Dropdown';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { ScaledTextInput as TextInput } from '../../src/components/ScaledTextInput';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { showToast } from '../../src/stores/toast.store';
import { careCircleApi, type CareCircleQrPreview, useCareCircle } from '../../src/features/care-circle';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, iconColors, radius, spacing, brandColors} from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { normalizeVietnamesePhone } from '../../src/lib/validation';
import { getApiErrorMessage } from '../../src/lib/apiClient';
import { DEFAULT_FAMILY_ROLE } from '../../src/features/care-circle/family-roles';
import { getFamilyRelationshipOptions } from '../../src/features/care-circle/family-relationships';
import { GuideScrollScope, GuideTarget } from '../../src/features/guidance/GuidanceProvider';

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
    icon: 'document-text-outline' as const,
  },
  {
    key: 'can_receive_alerts' as const,
    titleKey: 'permReceiveAlerts',
    descKey: 'permReceiveAlertsDesc',
    icon: 'notifications-outline' as const,
  },
  {
    key: 'can_ack_escalation' as const,
    titleKey: 'permAckEscalation',
    descKey: 'permAckEscalationDesc',
    icon: 'shield-outline' as const,
  },
];

export default function InviteScreen() {
  const guideScrollRef = useRef<ScrollView>(null);
  const guideScrollOffset = useRef(0);
  const router = useRouter();
  const params = useLocalSearchParams<{ qrToken?: string | string[] }>();
  const qrToken = Array.isArray(params.qrToken) ? params.qrToken[0] : params.qrToken;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const profile = useAuthStore(state => state.profile);
  const {
    createInvitation,
    createInvitationFromQr,
    loading,
    invitations,
    connections,
    fetchInvitations,
    fetchConnections,
  } = useCareCircle();

  const [phoneQuery, setPhoneQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchedUser, setSearchedUser] = useState<SearchUser | null>(null);
  const [searchError, setSearchError] = useState('');
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [qrPreview, setQrPreview] = useState<CareCircleQrPreview | null>(null);
  const [qrLoading, setQrLoading] = useState(Boolean(qrToken));
  const [selectedRelationship, setSelectedRelationship] = useState<DropdownOption | null>(null);
  const [customRelationship, setCustomRelationship] = useState('');
  const [permissions, setPermissions] = useState({
    can_view_logs: true,
    can_receive_alerts: true,
    can_ack_escalation: true,
  });

  const hasFormProgress = Boolean(
    phoneQuery.trim() ||
    searchedUser ||
    selectedUser ||
    qrPreview ||
    selectedRelationship ||
    customRelationship.trim() ||
    !permissions.can_view_logs || !permissions.can_receive_alerts || !permissions.can_ack_escalation
  );

  const handleExit = () => {
    if (!hasFormProgress) {
      router.back();
      return;
    }

    showAlert(t('discardInviteTitle'), t('discardInviteMessage'), [
      { text: t('continueEditing'), style: 'cancel' },
      { text: t('leaveWithoutSaving'), style: 'destructive', onPress: () => router.back() },
    ], { name: 'logout-variant', color: iconColors.danger });
  };

  const relationshipOptions = getFamilyRelationshipOptions(t);

  const handleSearchByPhone = async () => {
    const phone = normalizeVietnamesePhone(phoneQuery);
    if (!phone) {
      setSearchError(t('phoneQueryTooShort'));
      setSearchedUser(null);
      setSelectedUser(null);
      return;
    }

    const currentPhone = normalizeVietnamesePhone(profile?.phone ?? '');
    if (currentPhone === phone) {
      setSearchError(t('cannotInviteSelf'));
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
    } catch (err: any) {
      // Backend now caps phone search per user/day (FIX #5). Surface a
      // specific error for the limit hit so users know to come back later
      // instead of thinking the network is broken.
      if (err?.code === 'PHONE_SEARCH_LIMIT' || err?.statusCode === 429) {
        setSearchError(t('phoneSearchLimit'));
      } else {
        setSearchError(t('cannotLoadUsers'));
      }
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

  useEffect(() => {
    if (!qrToken) return;
    let active = true;
    setQrLoading(true);
    setSearchError('');
    careCircleApi.previewQrToken(qrToken)
      .then((preview) => {
        if (active) setQrPreview(preview);
      })
      .catch((error) => {
        if (active) setSearchError(getApiErrorMessage(error, t, 'qrPreviewError'));
      })
      .finally(() => {
        if (active) setQrLoading(false);
      });
    return () => { active = false; };
  }, [qrToken, t]);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleSend = async () => {
    if (!selectedUser && !qrPreview) {
      const message = phoneQuery.trim()
        ? t('pleaseSearchAndSelectRecipient')
        : t('pleaseEnterPhoneToInvite');
      setSearchError(message);
      return;
    }
    try {
      const invitationData = {
        relationship_type: selectedRelationship?.id || customRelationship || undefined,
        role: DEFAULT_FAMILY_ROLE,
        permissions,
      };
      if (qrToken && qrPreview) {
        await createInvitationFromQr({ token: qrToken, ...invitationData });
      } else if (selectedUser) {
        await createInvitation({ addressee_id: selectedUser.id, ...invitationData });
      }
      showToast(t('inviteSentSuccess'), 'success');
      setTimeout(() => router.back(), 1500);
    } catch (error: any) {
      // Connection limit exceeded → show the An Tam plan screen.
      if (error.statusCode === 403 || error.code === 'CARE_CIRCLE_LIMIT') {
        setShowUpgradeModal(true);
      } else {
        showToast(getApiErrorMessage(error, t, 'cannotSendInvite'), 'error');
      }
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={[styles.screenHeader, { paddingTop: insets.top }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tc('back')}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={handleExit}
        >
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </Pressable>
        <Text style={styles.screenHeaderTitle}>{t('inviteTitle')}</Text>
        <View style={styles.screenHeaderSpacer} />
      </View>
      <View style={{ flex: 1, backgroundColor: '#F3FBF8' }}>
        <GuideScrollScope scrollRef={guideScrollRef} offset={guideScrollOffset}>
        <ScrollView
          ref={guideScrollRef}
          onScroll={event => { guideScrollOffset.current = event.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={32}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: (selectedUser || qrPreview) ? insets.bottom + 96 : insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
        >
        <Animated.View entering={FadeIn.duration(250)} style={{ gap: spacing.md }}>
        {/* ─── Hero ─── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>{t('inviteSubtitle')}</Text>
            <Text style={styles.heroSubtitle}>{t('inviteHeroDesc')}</Text>
          </View>
          <Image
            source={require('../../assets/images/care-circle/family_3d_art.png')}
            style={styles.heroArt}
            resizeMode="contain"
          />
        </View>

        {/* ─── Recipient ─── */}
        <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.headerLeftRow}>
                <Ionicons
                  name={qrToken ? 'qr-code-outline' : 'call'}
                  size={18}
                  color="#0D9488"
                />
                <Text style={styles.cardTitle}>{qrToken ? t('qrRecipient') : t('searchByPhone')}</Text>
              </View>
            </View>

            {qrToken ? (
              <>
                {qrLoading ? (
                  <View style={styles.qrRecipientLoading}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.foundUserPhone}>{t('qrChecking')}</Text>
                  </View>
                ) : qrPreview ? (
                  <View style={styles.selectedUserCard}>
                    <View style={styles.selectedAvatar}>
                      <Ionicons name="checkmark-circle" size={24} color="#0D9488" />
                    </View>
                    <View style={styles.foundUserInfo}>
                      <Text style={styles.foundUserName}>{qrPreview.name}</Text>
                      <Text style={styles.foundUserPhone}>{t('qrVerifiedPerson')}</Text>
                    </View>
                    <Ionicons name="shield-checkmark" size={22} color="#0D9488" />
                  </View>
                ) : null}
                {!qrLoading && !qrPreview ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('scanAgain')}
                    onPress={() => router.replace('/care-circle/scan' as never)}
                    style={({ pressed }) => [styles.scanAgainButton, pressed && { opacity: 0.82 }]}
                  >
                    <Ionicons name="scan" size={19} color="#0D9488" />
                    <Text style={styles.scanAgainText}>{t('scanAgain')}</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
            <>
            <GuideTarget step="circle.phone">
            <View style={styles.phoneInputRow}>
              <TextInput
                style={[styles.phoneInput, { fontSize: 22, minHeight: 56 }]}
                allowFontScaling
                value={phoneQuery}
                onChangeText={text => {
                  setPhoneQuery(text);
                  setSearchedUser(null);
                  setSelectedUser(null);
                  setSearchError('');
                }}
                placeholder={t('enterPhoneNumber')}
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                returnKeyType="search"
                onSubmitEditing={handleSearchByPhone}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('search')}
                style={({ pressed }) => [styles.searchBtn, searchLoading && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
                onPress={handleSearchByPhone}
                disabled={searchLoading}
              >
                {searchLoading
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Ionicons name="search" size={18} color="#FFFFFF" />
                }
              </Pressable>
            </View>
            </GuideTarget>

            {/* Search result */}
            {searchedUser && !selectedUser && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('selectThisUser')}
                style={({ pressed }) => [styles.foundUserCard, pressed && { opacity: 0.85 }]}
                onPress={handleSelectSearchedUser}
              >
                <View style={styles.foundUserAvatar}>
                  <Ionicons name="person" size={20} color="#0D9488" />
                </View>
                <View style={styles.foundUserInfo}>
                  <Text style={styles.foundUserName}>{searchedUser.name}</Text>
                  {searchedUser.phone && (
                    <Text style={styles.foundUserPhone}>{searchedUser.phone}</Text>
                  )}
                </View>
                <View style={styles.selectBtnWrap}>
                  <Ionicons name="checkmark-circle-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.selectBtnText}>{t('selectThisUser')}</Text>
                </View>
              </Pressable>
            )}

            {/* Selected user */}
            {selectedUser && (
              <View style={styles.selectedUserCard}>
                <View style={styles.selectedAvatar}>
                  <Ionicons name="checkmark-circle" size={24} color="#0D9488" />
                </View>
                <View style={styles.foundUserInfo}>
                  <Text style={styles.foundUserName}>{selectedUser.name}</Text>
                  {selectedUser.phone && (
                    <Text style={styles.foundUserPhone}>{selectedUser.phone}</Text>
                  )}
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={tc('close')}
                  onPress={() => { setSelectedUser(null); setSearchedUser(null); }}
                  style={styles.clearBtn}
                >
                  <Ionicons name="close" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            )}
            </>
            )}

            {searchError ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{searchError}</Text>
              </View>
            ) : null}
          </View>

        {/* ─── Relationship ─── */}
          <GuideTarget step="circle.relationship" enabled={Boolean(normalizeVietnamesePhone(phoneQuery) || qrPreview)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.headerLeftRow}>
                <Ionicons name="heart-outline" size={19} color="#EF4444" />
                <Text style={styles.cardTitle}>{t('relationship')}</Text>
              </View>
              <View style={styles.optionalBadge}>
                <Text style={styles.optionalBadgeText}>{t('optional')}</Text>
              </View>
            </View>
            <Dropdown
              accessibilityLabel={t('relationship')}
              placeholder={t('relationshipPlaceholder')}
              options={relationshipOptions}
              value={selectedRelationship}
              onChange={option => {
                setSelectedRelationship(option);
                setCustomRelationship('');
              }}
              loading={loading}
              searchable
              containerStyle={styles.relationshipDropdown}
            />
          </View>
          </GuideTarget>

        {/* ─── Permissions ─── */}
          <View style={styles.card}>
            <View style={styles.permHeader}>
              <View style={styles.headerLeftRow}>
                <Ionicons name="shield-outline" size={20} color="#0D9488" />
                <Text style={styles.cardTitle}>{t('permissions')}</Text>
              </View>
              <Text style={styles.permHeaderSubtitle}>{t('permissionsDesc')}</Text>
            </View>

            {PERM_META.map((perm, i) => (
              <View
                key={perm.key}
                style={[styles.permissionRow, i === PERM_META.length - 1 && { borderBottomWidth: 0 }]}
              >
                <Ionicons name={perm.icon} size={22} color="#0D9488" style={styles.permIcon} />
                <View style={styles.permissionInfo}>
                  <Text style={styles.permissionTitle}>{t(perm.titleKey)}</Text>
                  <Text style={styles.permissionDesc}>{t(perm.descKey)}</Text>
                </View>
                <Switch
                  value={permissions[perm.key]}
                  onValueChange={(value) => setPermissions(prev => ({ ...prev, [perm.key]: value }))}
                  trackColor={{ false: '#CBD5E1', true: '#0D9488' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#CBD5E1"
                />
              </View>
            ))}
          </View>

        </Animated.View>
      </ScrollView>
      </GuideScrollScope>
      </View>

      {(selectedUser || qrPreview) && (
        <View style={[styles.stickyActions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <GuideTarget step="circle.send" enabled={Boolean(selectedRelationship || customRelationship.trim()) && !loading}>
          <Pressable
            style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.88 }]}
            onPress={handleSend}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t('sendInvite')}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                <Text allowFontScaling style={[styles.sendBtnText, { fontSize: 22 }]}>{t('sendInvite')}</Text>
              </>
            )}
          </Pressable>
          </GuideTarget>
        </View>
      )}

      {/* An Tam upgrade modal — connection limit */}
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
              <MaterialCommunityIcons name="shield-check" size={16} color="#fff" />
              <Text style={styles.modalUpgradeText}>{t('viewAnTamPlans')}</Text>
            </Pressable>
            <Pressable style={styles.modalCancelBtn} onPress={() => setShowUpgradeModal(false)}>
              <Text style={styles.modalCancelText}>{tc('later')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    scrollContent: {
      padding: 16,
      gap: 14,
    },
    screenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: '#F3FBF8',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E2E8F0',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
      zIndex: 10,
    },
    screenHeaderTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: typography.size.lg,
      fontWeight: '700',
      color: '#0F172A',
    },
    screenHeaderSpacer: {
      width: 40,
      height: 40,
    },
    // ── Hero ──
    heroCard: {
      borderRadius: 24,
      paddingHorizontal: 18,
      paddingVertical: 18,
      backgroundColor: '#E8F7F4',
      borderWidth: 1,
      borderColor: '#D4F0EA',
      position: 'relative',
      minHeight: 112,
      justifyContent: 'center',
    },
    heroTextWrap: {
      flex: 1,
      paddingRight: 124,
    },
    heroTitle: {
      fontSize: 15.5,
      fontWeight: '700',
      color: '#0F172A',
      lineHeight: 22,
    },
    heroSubtitle: {
      fontSize: 12.5,
      color: '#475569',
      lineHeight: 18,
      marginTop: 6,
    },
    heroArt: {
      position: 'absolute',
      right: 2,
      bottom: 0,
      width: 135,
      height: 112,
    },

    // ── Card ──
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    headerLeftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#0F172A',
    },
    optionalBadge: {
      backgroundColor: '#F1F5F9',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
    },
    optionalBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#64748B',
    },

    // ── Phone Search ──
    phoneInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F8FAFC',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      paddingLeft: 14,
      paddingRight: 5,
      paddingVertical: 4,
      height: 50,
    },
    phoneInput: {
      flex: 1,
      fontSize: 14.5,
      color: '#0F172A',
      paddingVertical: 0,
    },
    searchBtn: {
      width: 40,
      height: 40,
      backgroundColor: '#0D9488',
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Found User ──
    foundUserCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#CCFBF1',
      backgroundColor: '#F0FDFA',
      gap: 12,
    },
    foundUserAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#CCFBF1',
      alignItems: 'center',
      justifyContent: 'center',
    },
    foundUserInfo: {
      flex: 1,
    },
    foundUserName: {
      fontSize: 14.5,
      fontWeight: '700',
      color: '#0F172A',
    },
    foundUserPhone: {
      fontSize: 12.5,
      color: '#64748B',
      marginTop: 2,
    },
    selectBtnWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#0D9488',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    selectBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // ── Selected User ──
    selectedUserCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#0D9488',
      backgroundColor: '#F0FDFA',
      gap: 12,
    },
    selectedAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#CCFBF1',
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrRecipientLoading: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 64,
      paddingHorizontal: spacing.sm,
    },
    scanAgainButton: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexDirection: 'row',
      gap: spacing.xs,
      minHeight: 44,
      paddingHorizontal: spacing.sm,
    },
    scanAgainText: {
      color: '#0D9488',
      fontSize: 14,
      fontWeight: '700',
    },
    clearBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Error ──
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    errorText: {
      fontSize: 12.5,
      color: '#EF4444',
      flex: 1,
    },

    // ── Relationship selector ──
    relationshipDropdown: {
      marginBottom: 0,
    },

    // ── Permissions ──
    permHeader: {
      marginBottom: 14,
    },
    permHeaderSubtitle: {
      fontSize: 12.5,
      color: '#64748B',
      marginTop: 4,
      lineHeight: 18,
    },
    permIcon: {
      marginRight: 12,
    },
    permissionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#F1F5F9',
    },
    permissionInfo: {
      flex: 1,
      paddingRight: 8,
    },
    permissionTitle: {
      fontSize: 14.5,
      fontWeight: '700',
      color: '#0F172A',
    },
    permissionDesc: {
      fontSize: 12.5,
      color: '#64748B',
      marginTop: 3,
      lineHeight: 17,
    },

    // ── Sticky action ──
    stickyActions: {
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor: '#E2E8F0',
    },
    sendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      backgroundColor: '#0D9488',
      borderRadius: 16,
    },
    sendBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
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
