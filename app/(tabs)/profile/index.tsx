import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { RippleRefreshScrollView } from '../../../src/components/RippleRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { Screen } from '../../../src/components/Screen';
import { authApi } from '../../../src/features/auth/auth.api';
import { showToast } from '../../../src/stores/toast.store';
import { useAuthStore } from '../../../src/features/auth/auth.store';
import { useLogsStore } from '../../../src/features/logs/logs.store';
import { useMissionsStore } from '../../../src/features/missions/missions.store';
import { useScaledTypography } from '../../../src/hooks/useScaledTypography';
import { ApiError, apiClient } from '../../../src/lib/apiClient';
import { brandColors, categoryColors, colors, iconColors, spacing } from '../../../src/styles';
import { useThemeColors } from '../../../src/hooks/useThemeColors';

type SubStatus = { tier: 'free' | 'premium'; isPremium: boolean; expiresAt: string | null };

export default function ProfileScreen() {
  const { t } = useTranslation('profile');
  const { t: tc } = useTranslation('common');
  const profile = useAuthStore((state) => state.profile);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const padTop = insets.top + spacing.lg;

  // Fetch real data from stores
  const logs = useLogsStore((state) => state.recent);
  const fetchLogs = useLogsStore((state) => state.fetchRecent);
  const missions = useMissionsStore((state) => state.missions);
  const fetchMissions = useMissionsStore((state) => state.fetchMissions);

  // Edit profile state
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editGender, setEditGender] = useState<'Nam' | 'Nữ' | ''>('');
  const [editHeight, setEditHeight] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editBloodType, setEditBloodType] = useState('');
  const [editChronicDiseases, setEditChronicDiseases] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);

  // Removed dropdown - use direct input instead

  // Fetch subscription status
  useEffect(() => {
    apiClient<SubStatus>('/api/subscriptions/status')
      .then(setSubStatus)
      .catch(() => {});
  }, []);

  // Fetch full profile + data on focus (throttled)
  const lastFetchRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchRef.current < 3000) return;
      lastFetchRef.current = now;
      const controller = new AbortController();
      fetchLogs(controller.signal);
      fetchMissions(controller.signal);
      authApi.fetchProfile().then((fullProfile) => {
        if (fullProfile) {
          useAuthStore.setState({ profile: fullProfile });
        }
      }).catch(() => {});
      return () => controller.abort();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    lastFetchRef.current = 0; // reset throttle so focus effect re-fetches next time
    const controller = new AbortController();
    await Promise.all([
      fetchLogs(controller.signal),
      fetchMissions(controller.signal),
      authApi.fetchProfile().then((p) => { if (p) useAuthStore.setState({ profile: p }); }).catch(() => {}),
    ]);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute health overview from real data
  const healthOverview = useMemo(() => {
    const latestGlucose = logs.find((log) => log.type === 'glucose');
    const latestBP = logs.find((log) => log.type === 'blood-pressure');
    
    const glucoseText = latestGlucose?.value
      ? `${latestGlucose.value} mg/dL`
      : tc('noData');
    
    const bpText = latestBP?.systolic && latestBP?.diastolic
      ? `${latestBP.systolic}/${latestBP.diastolic} mmHg`
      : tc('noData');
    
    const activeMissions = missions.filter((m) => m.status === 'active');
    const todayTasksText = activeMissions.length > 0
      ? t('activeMissions', { count: activeMissions.length })
      : t('noMissions');
    
    // Check glucose level status
    const glucoseValue = latestGlucose?.value;
    let glucoseStatus: 'normal' | 'warning' | 'danger' = 'normal';
    if (glucoseValue) {
      if (glucoseValue > 180 || glucoseValue < 70) glucoseStatus = 'danger';
      else if (glucoseValue > 140 || glucoseValue < 80) glucoseStatus = 'warning';
    }
    
    return { glucoseText, bpText, todayTasksText, glucoseStatus };
  }, [logs, missions]);

  const name = profile?.name?.trim() ?? '';
  const phone = profile?.phone?.trim() ?? '';
  const hasProfile = Boolean(profile);
  const identityTitle = hasProfile
    ? name || tc('notUpdated')
    : phone
      ? t('newCustomer')
      : t('notLoggedIn');
  const statusText = hasProfile ? t('active') : t('notLoggedIn');

  const handleEditProfile = () => {
    setPhoneError('');
    setEditName(name);
    setEditPhone(phone);
    setEditAge(profile?.age ? String(Math.round(profile.age)) : '');
    setEditGender((profile?.gender as 'Nam' | 'Nữ' | '') || '');
    setEditHeight(profile?.heightCm ? String(Math.round(profile.heightCm)) : '');
    setEditWeight(profile?.weightKg ? String(Math.round(profile.weightKg)) : '');
    setEditBloodType(profile?.bloodType || '');
    setEditChronicDiseases(profile?.chronicDiseases?.join(', ') || '');
    setEditModalVisible(true);
  };

  const handleCloseEditModal = () => {
    setEditModalVisible(false);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      showToast(t('nameRequired'), 'error');
      return;
    }

    if (editHeight && (isNaN(parseFloat(editHeight)) || parseFloat(editHeight) <= 0)) {
      showToast(t('heightPositive'), 'error');
      return;
    }

    if (editWeight && (isNaN(parseFloat(editWeight)) || parseFloat(editWeight) <= 0)) {
      showToast(t('weightPositive'), 'error');
      return;
    }

    if (editAge && (isNaN(Number(editAge)) || Number(editAge) <= 0 || Number(editAge) > 150)) {
      showToast(t('ageValid'), 'error');
      return;
    }

    const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    if (editBloodType && !validBloodTypes.includes(editBloodType)) {
      showToast(t('bloodTypeInvalid'), 'error');
      return;
    }
    
    setIsSaving(true);
    try {
      let dateOfBirth = null;
      if (editAge && !isNaN(Number(editAge))) {
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - Number(editAge);
        dateOfBirth = `${birthYear}-01-01`;
      }

      const updateData: any = {
        name: editName.trim(),
        phone: editPhone.trim(),
      };

      if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
      if (editGender) updateData.gender = editGender;
      if (editHeight) updateData.heightCm = parseFloat(editHeight);
      if (editWeight) updateData.weightKg = parseFloat(editWeight);
      if (editBloodType) updateData.bloodType = editBloodType;
      // Always send chronicDiseases (even empty array) so clearing works
      updateData.chronicDiseases = editChronicDiseases.trim()
        ? editChronicDiseases.split(',').map((d: string) => d.trim()).filter((d: string) => d.length > 0)
        : [];

      const updatedProfile = await authApi.updateProfile(updateData);
      useAuthStore.setState({ profile: updatedProfile });
      
      handleCloseEditModal();
      showToast(t('profileUpdated'), 'success');
    } catch (error) {

      if (error instanceof ApiError && error.statusCode === 409) {
        setPhoneError(t('phoneAlreadyUsed'));
      } else {
        showToast((error as Error).message || t('profileUpdateError'), 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const { glucoseText, bpText, todayTasksText, glucoseStatus } = healthOverview;

  return (
    <Screen>
      <RippleRefreshScrollView
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={[styles.container, { paddingTop: padTop, paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header Card */}
        <Animated.View entering={FadeIn.delay(0).duration(400)}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeaderCard}
        >
          <Text style={styles.profileName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{identityTitle}</Text>
          <Text style={styles.profileStatus}>{statusText}</Text>
          <TouchableOpacity
            style={[styles.planChip, subStatus?.isPremium ? styles.planChipPremium : styles.planChipFree, !subStatus && { opacity: 0 }]}
            onPress={() => router.push('/subscription')}
            activeOpacity={0.8}
            disabled={!subStatus}
          >
            <MaterialCommunityIcons
              name={subStatus?.isPremium ? 'crown' : 'account-outline'}
              size={13}
              color={subStatus?.isPremium ? colors.premiumDark : 'rgba(255,255,255,0.9)'}
            />
            <Text style={[styles.planChipText, subStatus?.isPremium ? styles.planChipTextPremium : styles.planChipTextFree]}>
              {subStatus?.isPremium ? t('planPremium') : t('planFree')}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
        </Animated.View>

        {/* User Info Card */}
        <Animated.View entering={FadeIn.delay(80).duration(350)}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-circle-outline" size={22} color={iconColors.primary} />
          <Text style={styles.sectionTitle}>{t('personalInfo')}</Text>
        </View>
        <View style={styles.infoList}>
          {hasProfile ? (
            <>
              <View style={styles.infoItemCard}>
                <Ionicons name="person-outline" size={22} color={iconColors.primary} style={styles.infoIcon} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t('fullName')}</Text>
                  <Text style={styles.infoValue}>{name || tc('notUpdated')}</Text>
                </View>
              </View>

              <View style={styles.infoItemCard}>
                <Ionicons name="call-outline" size={22} color={iconColors.emerald} style={styles.infoIcon} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t('phone')}</Text>
                  <Text style={styles.infoValue}>{phone || tc('notUpdated')}</Text>
                </View>
              </View>

              {profile?.gender ? (
                <View style={styles.infoItemCard}>
                  <Ionicons
                    name={profile.gender === 'Nam' ? 'male-outline' : 'female-outline'}
                    size={22}
                    color={profile.gender === 'Nam' ? iconColors.glucose : iconColors.pink}
                    style={styles.infoIcon}
                  />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('gender')}</Text>
                    <Text style={styles.infoValue}>{profile.gender === 'Nam' ? tc('male') : tc('female')}</Text>
                  </View>
                </View>
              ) : null}

              {profile?.age ? (
                <View style={styles.infoItemCard}>
                  <MaterialCommunityIcons name="cake-variant-outline" size={22} color={iconColors.premium} style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('age')}</Text>
                    <Text style={styles.infoValue}>{Math.round(profile.age)} {t('ageUnit')}</Text>
                  </View>
                </View>
              ) : null}

              {profile?.heightCm ? (
                <View style={styles.infoItemCard}>
                  <MaterialCommunityIcons name="human-male-height" size={22} color={iconColors.violet} style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('height')}</Text>
                    <Text style={styles.infoValue}>{t('heightValue', { value: Math.round(profile.heightCm) })}</Text>
                  </View>
                </View>
              ) : null}

              {profile?.weightKg ? (
                <View style={styles.infoItemCard}>
                  <MaterialCommunityIcons name="scale-bathroom" size={22} color={iconColors.cyan} style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('weight')}</Text>
                    <Text style={styles.infoValue}>{t('weightValue', { value: Math.round(profile.weightKg) })}</Text>
                  </View>
                </View>
              ) : null}

              {profile?.bloodType ? (
                <View style={styles.infoItemCard}>
                  <MaterialCommunityIcons name="water-outline" size={22} color={iconColors.danger} style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('bloodType')}</Text>
                    <Text style={styles.infoValue}>{profile.bloodType}</Text>
                  </View>
                </View>
              ) : null}

              {profile?.chronicDiseases && profile.chronicDiseases.length > 0 ? (
                <View style={styles.infoItemCard}>
                  <MaterialCommunityIcons name="medical-bag" size={22} color={iconColors.orange} style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{t('chronicDiseases')}</Text>
                    <Text style={styles.infoValue}>{profile.chronicDiseases.join(', ')}</Text>
                  </View>
                </View>
              ) : null}
            </>
          ) : phone ? (
            <View style={styles.infoItemCard}>
              <Ionicons name="call-outline" size={22} color={iconColors.emerald} style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('phone')}</Text>
                <Text style={styles.infoValue}>{phone}</Text>
              </View>
            </View>
          ) : null}
        </View>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeIn.delay(160).duration(350)}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash-outline" size={22} color={iconColors.warning} />
          <Text style={styles.sectionTitle}>{t('quickActions')}</Text>
        </View>
        <View style={styles.quickActionsGrid}>
          {([
            { icon: 'people-outline',    color: iconColors.emerald,  label: t('careCircle'),      onPress: () => router.push('/care-circle') },
            { icon: 'settings-outline',  color: iconColors.primary,  label: t('settings'),        onPress: () => router.push('/settings') },
            { icon: 'create-outline',    color: iconColors.indigo,   label: t('editProfile'),     onPress: handleEditProfile },
            { icon: 'journal-outline',   color: iconColors.pink,     label: t('logEntry'),        onPress: () => router.push('/logs') },
            { icon: 'wallet-outline',    color: iconColors.cyan,     label: t('wallet'),          onPress: () => router.push('/wallet') },
            { icon: 'star-outline',      color: iconColors.premium,  label: t('subscription'),    onPress: () => router.push('/subscription') },
            { icon: 'bookmark-outline',  color: iconColors.violet,   label: tc('aiNotes'),        onPress: () => router.push('/chat-notes') },
            { icon: 'alarm-outline',     color: iconColors.orange,   label: tc('reminderConfig'), onPress: () => router.push('/reminder-config') },
          ] as const).map((item, i) => (
            <Pressable key={i} style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]} onPress={item.onPress}>
              <Ionicons name={item.icon as any} size={22} color={item.color} style={styles.actionIcon} />
              <Text style={styles.actionLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={styles.actionChevron} />
            </Pressable>
          ))}
        </View>
        </Animated.View>

        {/* Health Overview */}
        <Animated.View entering={FadeIn.delay(240).duration(350)}>
        <View style={styles.sectionHeader}>
          <Ionicons name="heart-circle-outline" size={22} color={iconColors.danger} />
          <Text style={styles.sectionTitle}>{t('healthOverview')}</Text>
        </View>
        <View style={styles.healthCardsGrid}>
          <View style={[styles.healthCard, styles.healthCardGlucose]}>
            <View style={styles.healthCardHeader}>
              <MaterialCommunityIcons name="water" size={20} color={iconColors.glucose} />
              <Text style={styles.healthCardTitle}>{t('glucose')}</Text>
            </View>
            <Text style={[styles.healthCardValue, glucoseStatus === 'warning' && styles.healthValueWarning, glucoseStatus === 'danger' && styles.healthValueDanger]}>{glucoseText}</Text>
            {glucoseStatus !== 'normal' && (
              <View style={styles.healthAlert}>
                <Ionicons name="alert-circle" size={16} color={glucoseStatus === 'danger' ? iconColors.danger : iconColors.premium} />
                <Text style={[styles.healthAlertText, { color: glucoseStatus === 'danger' ? colors.danger : colors.premium }]}>
                  {glucoseStatus === 'danger' ? t('needsAttention') : t('slightlyHigh')}
                </Text>
              </View>
            )}
          </View>
          
          <View style={[styles.healthCard, styles.healthCardBP]}>
            <View style={styles.healthCardHeader}>
              <MaterialCommunityIcons name="heart-pulse" size={20} color={iconColors.bp} />
              <Text style={styles.healthCardTitle}>{t('bloodPressure')}</Text>
            </View>
            <Text style={styles.healthCardValue}>{bpText}</Text>
          </View>
          
          <View style={[styles.healthCard, styles.healthCardMissions]}>
            <View style={styles.healthCardHeader}>
              <Ionicons name="checkbox-outline" size={20} color={iconColors.emerald} />
              <Text style={styles.healthCardTitle}>{t('missions')}</Text>
            </View>
            <Text style={styles.healthCardValue}>{todayTasksText}</Text>
          </View>
        </View>
        </Animated.View>
      </RippleRefreshScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseEditModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('editProfileTitle')}</Text>
            </View>
            
            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Ionicons name="person-outline" size={16} color={iconColors.primary} />
                  <Text style={styles.inputLabel}>{t('fullName')}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t('enterName')}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Ionicons name="call-outline" size={16} color={iconColors.emerald} />
                  <Text style={styles.inputLabel}>{t('phone')}</Text>
                </View>
                <TextInput
                  style={[styles.input, phoneError ? styles.inputError : null]}
                  value={editPhone}
                  onChangeText={(text) => { setEditPhone(text); setPhoneError(''); }}
                  placeholder={t('enterPhone')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                />
                {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <FontAwesome5 name="birthday-cake" size={14} color={iconColors.premium} />
                  <Text style={styles.inputLabel}>{t('age')}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={editAge}
                  onChangeText={setEditAge}
                  placeholder={t('enterAge')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Ionicons name="male-female" size={16} color={iconColors.violet} />
                  <Text style={styles.inputLabel}>{t('gender')}</Text>
                </View>
                <View style={styles.genderButtonsRow}>
                  <Pressable
                    style={[styles.genderButton, editGender === 'Nam' && styles.genderButtonActive]}
                    onPress={() => setEditGender('Nam')}
                  >
                    <Ionicons 
                      name="male" 
                      size={20} 
                      color={editGender === 'Nam' ? '#fff' : categoryColors.glucose}
                    />
                    <Text style={[styles.genderButtonText, editGender === 'Nam' && styles.genderButtonTextActive]}>{tc('male')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.genderButton, editGender === 'Nữ' && styles.genderButtonActive]}
                    onPress={() => setEditGender('Nữ')}
                  >
                    <Ionicons 
                      name="female" 
                      size={20} 
                      color={editGender === 'Nữ' ? '#fff' : brandColors.pink} 
                    />
                    <Text style={[styles.genderButtonText, editGender === 'Nữ' && styles.genderButtonTextActive]}>{tc('female')}</Text>
                  </Pressable>
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <MaterialCommunityIcons name="human-male-height" size={16} color={iconColors.cyan} />
                  <Text style={styles.inputLabel}>{t('heightCm')}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={editHeight}
                  onChangeText={setEditHeight}
                  placeholder={t('enterHeight')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <MaterialCommunityIcons name="scale-bathroom" size={16} color={iconColors.weight} />
                  <Text style={styles.inputLabel}>{t('weightKg')}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={editWeight}
                  onChangeText={setEditWeight}
                  placeholder={t('enterWeight')}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <FontAwesome5 name="tint" size={14} color={iconColors.danger} />
                  <Text style={styles.inputLabel}>{t('bloodType')}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={editBloodType}
                  onChangeText={setEditBloodType}
                  placeholder={t('bloodTypeExample')}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <MaterialCommunityIcons name="medical-bag" size={16} color={iconColors.medication} />
                  <Text style={styles.inputLabel}>{t('chronicDiseases')}</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textAreaInput]}
                  value={editChronicDiseases}
                  onChangeText={setEditChronicDiseases}
                  placeholder={t('chronicDiseasesExample')}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <Pressable style={styles.cancelButton} onPress={handleCloseEditModal}>
                <Text style={styles.cancelButtonText}>{tc('cancel')}</Text>
              </Pressable>
              <Pressable 
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                <LinearGradient
                  colors={isSaving ? ['#9ca3af', '#9ca3af'] : [colors.primary, colors.primaryDark]}
                  style={styles.saveButtonGradient}
                >
                  {isSaving ? (
                    <Text style={styles.saveButtonText}>{tc('saving')}</Text>
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.saveButtonText}>{tc('save')}</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.background
  },
  // Profile Header
  profileHeaderCard: {
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 2
  },
  profileName: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: '#fff',
    marginBottom: spacing.xs,
    width: '100%',
    textAlign: 'center',
  },
  profileStatus: {
    fontSize: typography.size.sm,
    color: 'rgba(255,255,255,0.9)'
  },
  planChip: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  planChipFree: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  planChipPremium: {
    backgroundColor: colors.premiumLight,
    borderWidth: 1.5,
    borderColor: colors.premium,
  },
  planChipText: {
    fontSize: typography.size.xs,
    fontWeight: '700',
  },
  planChipTextFree: {
    color: 'rgba(255,255,255,0.95)',
  },
  planChipTextPremium: {
    color: colors.premiumDark,
  },
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  // Info Card
  infoList: {
    gap: spacing.sm,
  },
  infoItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  infoIcon: {
    flexShrink: 0,
    width: 28,
    textAlign: 'center',
  },
  infoContent: {
    flex: 1
  },
  infoLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginBottom: 2
  },
  infoValue: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  // Quick Actions
  quickActionsGrid: {
    gap: spacing.sm
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  actionCardPressed: {
    opacity: 0.75,
  },
  actionIcon: {
    flexShrink: 0,
    width: 26,
    textAlign: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.textPrimary
  },
  actionChevron: {
    flexShrink: 0,
  },
  // Health Cards
  healthCardsGrid: {
    gap: spacing.md
  },
  healthCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  healthCardGlucose: {
    borderColor: categoryColors.glucose + '40',
    backgroundColor: categoryColors.glucoseBg,
  },
  healthCardBP: {
    borderColor: categoryColors.bloodPressure + '30',
    backgroundColor: categoryColors.bloodPressureBg,
  },
  healthCardMissions: {
    borderColor: colors.emerald + '40',
    backgroundColor: colors.emeraldLight,
  },
  healthCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  healthCardTitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  healthCardValue: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.textPrimary
  },
  healthValueWarning: {
    color: colors.premium
  },
  healthValueDanger: {
    color: colors.danger
  },
  healthAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  healthAlertText: {
    fontSize: typography.size.xs,
    fontWeight: '600'
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xl
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  modalTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.textPrimary
  },
  inputGroup: {
    marginBottom: spacing.md
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs
  },
  inputLabel: {
    fontSize: typography.size.sm,
    color: colors.textSecondary
  },
  genderButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface
  },
  genderButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  genderButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary
  },
  genderButtonTextActive: {
    color: '#fff'
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    backgroundColor: colors.background
  },
  inputError: {
    borderColor: colors.danger
  },
  fieldError: {
    fontSize: typography.size.sm,
    color: colors.danger,
    marginTop: spacing.xs
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center'
  },
  cancelButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textSecondary
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden'
  },
  saveButtonDisabled: {
    opacity: 0.7
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md
  },
  saveButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: '#fff'
  },
  textAreaInput: {
    minHeight: 80,
    paddingTop: spacing.md
  },
});
}
