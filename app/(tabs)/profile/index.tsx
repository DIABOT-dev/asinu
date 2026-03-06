import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../../src/components/ScaledText';
import { Screen } from '../../../src/components/Screen';
import { Toast } from '../../../src/components/Toast';
import { authApi } from '../../../src/features/auth/auth.api';
import { useAuthStore } from '../../../src/features/auth/auth.store';
import { useLogsStore } from '../../../src/features/logs/logs.store';
import { useMissionsStore } from '../../../src/features/missions/missions.store';
import { useScaledTypography } from '../../../src/hooks/useScaledTypography';
import { ApiError, apiClient } from '../../../src/lib/apiClient';
import { colors, spacing } from '../../../src/styles';

type SubStatus = { tier: 'free' | 'premium'; isPremium: boolean; expiresAt: string | null };

export default function ProfileScreen() {
  const { t } = useTranslation('profile');
  const { t: tc } = useTranslation('common');
  const profile = useAuthStore((state) => state.profile);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);
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
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);

  // Removed dropdown - use direct input instead

  // Fetch subscription status
  useEffect(() => {
    apiClient<SubStatus>('/api/subscriptions/status')
      .then(setSubStatus)
      .catch(() => {});
  }, []);

  // Fetch data on mount
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      fetchLogs(controller.signal);
      fetchMissions(controller.signal);
      return () => controller.abort();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleRefresh = useCallback(() => {
    const controller = new AbortController();
    fetchLogs(controller.signal);
    fetchMissions(controller.signal);
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
      setToastMessage(t('nameRequired'));
      setToastType('error');
      setToastVisible(true);
      return;
    }

    if (editHeight && (isNaN(parseFloat(editHeight)) || parseFloat(editHeight) <= 0)) {
      setToastMessage(t('heightPositive'));
      setToastType('error');
      setToastVisible(true);
      return;
    }

    if (editWeight && (isNaN(parseFloat(editWeight)) || parseFloat(editWeight) <= 0)) {
      setToastMessage(t('weightPositive'));
      setToastType('error');
      setToastVisible(true);
      return;
    }

    if (editAge && (isNaN(Number(editAge)) || Number(editAge) <= 0 || Number(editAge) > 150)) {
      setToastMessage(t('ageValid'));
      setToastType('error');
      setToastVisible(true);
      return;
    }

    const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    if (editBloodType && !validBloodTypes.includes(editBloodType)) {
      setToastMessage(t('bloodTypeInvalid'));
      setToastType('error');
      setToastVisible(true);
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
      if (editChronicDiseases.trim()) {
        // Split by comma and trim each disease
        updateData.chronicDiseases = editChronicDiseases
          .split(',').map(d => d.trim()).filter(d => d.length > 0);
      }

      const updatedProfile = await authApi.updateProfile(updateData);
      useAuthStore.setState({ profile: updatedProfile });
      
      handleCloseEditModal();
      setToastMessage(t('profileUpdated'));
      setToastType('success');
      setToastVisible(true);
    } catch (error) {

      if (error instanceof ApiError && error.statusCode === 409) {
        setPhoneError(t('phoneAlreadyUsed'));
      } else {
        setToastMessage((error as Error).message || t('profileUpdateError'));
        setToastType('error');
        setToastVisible(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const { glucoseText, bpText, todayTasksText, glucoseStatus } = healthOverview;

  return (
    <Screen>
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />
      <ScrollView 
        contentContainerStyle={[styles.container, { paddingTop: padTop }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Profile Header Card */}
        <LinearGradient
          colors={['#08b8a2', '#0ea18f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeaderCard}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color={colors.primary} />
            </View>
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4ade80" />
            </View>
          </View>
          <Text style={styles.profileName}>{identityTitle}</Text>
          <Text style={styles.profileStatus}>{statusText}</Text>
          {subStatus && (
            <TouchableOpacity
              style={[styles.planChip, subStatus.isPremium ? styles.planChipPremium : styles.planChipFree]}
              onPress={() => router.push('/subscription')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={subStatus.isPremium ? 'crown' : 'account-outline'}
                size={13}
                color={subStatus.isPremium ? colors.premiumDark : 'rgba(255,255,255,0.9)'}
              />
              <Text style={[styles.planChipText, subStatus.isPremium ? styles.planChipTextPremium : styles.planChipTextFree]}>
                {subStatus.isPremium ? 'Premium' : 'Free'}
              </Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* User Info Card */}
        <View style={styles.sectionHeader}>
          <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.sectionTitle}>{t('personalInfo')}</Text>
        </View>
        <View style={styles.infoCard}>
          {hasProfile ? (
            <>
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="person-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t('fullName')}</Text>
                  <Text style={styles.infoValue}>{name || tc('notUpdated')}</Text>
                </View>
              </View>
              
              <View style={styles.infoDivider} />
              
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="call-outline" size={18} color={colors.primaryDark} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t('phone')}</Text>
                  <Text style={styles.infoValue}>{phone || tc('notUpdated')}</Text>
                </View>
              </View>
              
              {profile?.gender ? (
                <>
                  <View style={styles.infoDivider} />
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconContainer}>
                      <Ionicons name={profile.gender === 'Nam' ? 'male' : 'female'} size={18} color={profile.gender === 'Nam' ? '#3b82f6' : '#ec4899'} />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>{t('gender')}</Text>
                      <Text style={styles.infoValue}>{profile.gender === 'Nam' ? tc('male') : tc('female')}</Text>
                    </View>
                  </View>
                </>
              ) : null}
              
              {profile?.age ? (
                <>
                  <View style={styles.infoDivider} />
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconContainer}>
                      <FontAwesome5 name="birthday-cake" size={16} color={colors.premium} />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>{t('age')}</Text>
                      <Text style={styles.infoValue}>{Math.round(profile.age)} {t('ageUnit')}</Text>
                    </View>
                  </View>
                </>
              ) : null}
              
              {profile?.heightCm ? (
                <>
                  <View style={styles.infoDivider} />
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconContainer}>
                      <MaterialCommunityIcons name="human-male-height" size={20} color="#8b5cf6" />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>{t('height')}</Text>
                      <Text style={styles.infoValue}>{t('heightValue', { value: Math.round(profile.heightCm) })}</Text>
                    </View>
                  </View>
                </>
              ) : null}
              
              {profile?.weightKg ? (
                <>
                  <View style={styles.infoDivider} />
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconContainer}>
                      <MaterialCommunityIcons name="scale-bathroom" size={18} color="#06b6d4" />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>{t('weight')}</Text>
                      <Text style={styles.infoValue}>{t('weightValue', { value: Math.round(profile.weightKg) })}</Text>
                    </View>
                  </View>
                </>
              ) : null}
              
              {profile?.bloodType ? (
                <>
                  <View style={styles.infoDivider} />
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconContainer}>
                      <FontAwesome5 name="tint" size={16} color="#ef4444" />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>{t('bloodType')}</Text>
                      <Text style={styles.infoValue}>{profile.bloodType}</Text>
                    </View>
                  </View>
                </>
              ) : null}
              
              {profile?.chronicDiseases && profile.chronicDiseases.length > 0 ? (
                <>
                  <View style={styles.infoDivider} />
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconContainer}>
                      <MaterialCommunityIcons name="medical-bag" size={18} color="#f97316" />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>{t('chronicDiseases')}</Text>
                      <Text style={styles.infoValue}>{profile.chronicDiseases.join(', ')}</Text>
                    </View>
                  </View>
                </>
              ) : null}
            </>
          ) : phone ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="call-outline" size={18} color={colors.primaryDark} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('phone')}</Text>
                <Text style={styles.infoValue}>{phone}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Ionicons name="flash-outline" size={22} color={colors.warning} />
          <Text style={styles.sectionTitle}>{t('quickActions')}</Text>
        </View>
        <View style={styles.quickActionsGrid}>
          <Pressable style={styles.actionCard} onPress={() => router.push('/care-circle')}>
            <LinearGradient
              colors={[colors.emerald, colors.emeraldDark]}
              style={styles.actionIconBg}
            >
              <Ionicons name="people" size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.actionLabel}>{t('careCircle')}</Text>
          </Pressable>
          
          <Pressable style={styles.actionCard} onPress={() => router.push('/settings')}>
            <LinearGradient
              colors={[colors.premium, colors.premiumDark]}
              style={styles.actionIconBg}
            >
              <Ionicons name="settings" size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.actionLabel}>{t('settings')}</Text>
          </Pressable>
          
          <Pressable style={styles.actionCard} onPress={handleEditProfile}>
            <LinearGradient
              colors={['#6366f1', '#4f46e5']}
              style={styles.actionIconBg}
            >
              <Ionicons name="create" size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.actionLabel}>{t('editProfile')}</Text>
          </Pressable>
          
          <Pressable style={styles.actionCard} onPress={() => router.push('/logs')}>
            <LinearGradient
              colors={['#ec4899', '#db2777']}
              style={styles.actionIconBg}
            >
              <Ionicons name="journal" size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.actionLabel}>{t('logEntry')}</Text>
          </Pressable>

          <Pressable style={styles.actionCard} onPress={() => router.push('/wallet')}>
            <LinearGradient
              colors={['#8b5cf6', '#7c3aed']}
              style={styles.actionIconBg}
            >
              <Ionicons name="wallet" size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.actionLabel}>{t('wallet')}</Text>
          </Pressable>

          <Pressable style={styles.actionCard} onPress={() => router.push('/subscription')}>
            <LinearGradient
              colors={[colors.premium, colors.premiumDark]}
              style={styles.actionIconBg}
            >
              <Ionicons name="star" size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.actionLabel}>{t('subscription')}</Text>
          </Pressable>
        </View>

        {/* Health Overview */}
        <View style={styles.sectionHeader}>
          <Ionicons name="heart-circle-outline" size={22} color="#ef4444" />
          <Text style={styles.sectionTitle}>{t('healthOverview')}</Text>
        </View>
        <View style={styles.healthCardsGrid}>
          <View style={[styles.healthCard, styles.healthCardGlucose]}>
            <View style={styles.healthCardHeader}>
              <MaterialCommunityIcons name="water" size={20} color="#3b82f6" />
              <Text style={styles.healthCardTitle}>{t('glucose')}</Text>
            </View>
            <Text style={[styles.healthCardValue, glucoseStatus === 'warning' && styles.healthValueWarning, glucoseStatus === 'danger' && styles.healthValueDanger]}>{glucoseText}</Text>
            {glucoseStatus !== 'normal' && (
              <View style={styles.healthAlert}>
                <Ionicons name="alert-circle" size={16} color={glucoseStatus === 'danger' ? '#ef4444' : colors.premium} />
                <Text style={[styles.healthAlertText, { color: glucoseStatus === 'danger' ? '#ef4444' : colors.premium }]}>
                  {glucoseStatus === 'danger' ? t('needsAttention') : t('slightlyHigh')}
                </Text>
              </View>
            )}
          </View>
          
          <View style={[styles.healthCard, styles.healthCardBP]}>
            <View style={styles.healthCardHeader}>
              <MaterialCommunityIcons name="heart-pulse" size={20} color="#ef4444" />
              <Text style={styles.healthCardTitle}>{t('bloodPressure')}</Text>
            </View>
            <Text style={styles.healthCardValue}>{bpText}</Text>
          </View>
          
          <View style={[styles.healthCard, styles.healthCardMissions]}>
            <View style={styles.healthCardHeader}>
              <Ionicons name="checkbox-outline" size={20} color={colors.emerald} />
              <Text style={styles.healthCardTitle}>{t('missions')}</Text>
            </View>
            <Text style={styles.healthCardValue}>{todayTasksText}</Text>
          </View>
        </View>
      </ScrollView>

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
              <Ionicons name="person-circle" size={32} color={colors.primary} />
              <Text style={styles.modalTitle}>{t('editProfileTitle')}</Text>
            </View>
            
            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
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
                  <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
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
                  <FontAwesome5 name="birthday-cake" size={14} color={colors.textSecondary} />
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
                  <Ionicons name="male-female" size={16} color={colors.textSecondary} />
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
                      color={editGender === 'Nam' ? '#fff' : '#3b82f6'} 
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
                      color={editGender === 'Nữ' ? '#fff' : '#ec4899'} 
                    />
                    <Text style={[styles.genderButtonText, editGender === 'Nữ' && styles.genderButtonTextActive]}>{tc('female')}</Text>
                  </Pressable>
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <MaterialCommunityIcons name="human-male-height" size={16} color={colors.textSecondary} />
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
                  <MaterialCommunityIcons name="scale-bathroom" size={16} color={colors.textSecondary} />
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
                  <FontAwesome5 name="tint" size={14} color={colors.textSecondary} />
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
                  <MaterialCommunityIcons name="medical-bag" size={16} color={colors.textSecondary} />
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
                  colors={isSaving ? ['#9ca3af', '#9ca3af'] : ['#08b8a2', '#0ea18f']}
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
    shadowColor: '#08b8a2',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2
  },
  profileName: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: '#fff',
    marginBottom: spacing.xs
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
    borderWidth: 1,
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
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center'
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
  infoDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs
  },
  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  actionCard: {
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  actionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  actionLabel: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.textPrimary
  },
  // Health Cards
  healthCardsGrid: {
    gap: spacing.md
  },
  healthCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  healthCardGlucose: {
    borderColor: '#dbeafe',
    backgroundColor: '#f0f9ff'
  },
  healthCardBP: {
    borderColor: '#fce7f3',
    backgroundColor: '#fdf2f8'
  },
  healthCardMissions: {
    borderColor: colors.emeraldLight,
    backgroundColor: '#ecfdf5'
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
    color: '#ef4444'
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
    borderWidth: 2,
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
    borderWidth: 2,
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
    borderWidth: 2,
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
