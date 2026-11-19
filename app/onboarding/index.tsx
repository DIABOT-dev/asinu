import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { ScaledTextInput as RNTextInput } from '../../src/components/ScaledTextInput';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { authApi, type UpdateProfilePayload } from '../../src/features/auth/auth.api';
import { ProfileFieldSheet } from '../../src/features/profile/ProfileFieldSheet';
import type { PersonalProfileField } from '../../src/features/profile/profile-fields';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { apiClient } from '../../src/lib/apiClient';
import { TERMS_URL, PRIVACY_URL } from '../../src/lib/links';
import { FontSizeScale, useFontSizeStore } from '../../src/stores/font-size.store';
import { useLanguageStore } from '../../src/stores/language.store';
import { setPendingToast } from '../../src/stores/toast.store';

const FONT_SIZE_OPTIONS: Array<{ value: FontSizeScale; iconSize: number }> = [
  { value: 'small', iconSize: 16 },
  { value: 'normal', iconSize: 20 },
  { value: 'large', iconSize: 24 },
  { value: 'xlarge', iconSize: 28 },
];

const BLOOD_TYPE_OPTIONS = [
  { value: 'A+', labelKey: 'bloodAPlus' },
  { value: 'A-', labelKey: 'bloodAMinus' },
  { value: 'B+', labelKey: 'bloodBPlus' },
  { value: 'B-', labelKey: 'bloodBMinus' },
  { value: 'AB+', labelKey: 'bloodABPlus' },
  { value: 'AB-', labelKey: 'bloodABMinus' },
  { value: 'O+', labelKey: 'bloodOPlus' },
  { value: 'O-', labelKey: 'bloodOMinus' },
];

const DISEASE_GRID = [
  { value: 'Tiểu đường', labelKey: 'diseaseDiabetes', icon: 'water-outline' },
  { value: 'Tiền tiểu đường', labelKey: 'diseasePrediabetes', icon: 'water-outline' },
  { value: 'Cao huyết áp', labelKey: 'diseaseHypertension', icon: 'heart-outline' },
  { value: 'Bệnh tim', labelKey: 'diseaseHeart', icon: 'heart' },
  { value: 'Mỡ máu', labelKey: 'diseaseDyslipidemia', icon: 'color-filter-outline' },
  { value: 'Tiền đình', labelKey: 'diseaseVertigo', icon: 'ellipse-outline' },
  { value: 'Đau dạ dày', labelKey: 'diseaseStomach', icon: 'fitness-outline' },
  { value: 'Gout', labelKey: 'diseaseGout', icon: 'walk-outline' },
];

const DISEASE_FOOTER = [
  { value: 'Không có', labelKey: 'diseaseNone', icon: 'ban-outline' },
  { value: 'Khác', labelKey: 'diseaseOther', icon: 'ellipsis-horizontal-outline' },
];

const DISEASE_NONE_VALUE = DISEASE_FOOTER.find(d => d.labelKey === 'diseaseNone')!.value;
const DISEASE_OTHER_VALUE = DISEASE_FOOTER.find(d => d.labelKey === 'diseaseOther')!.value;

const MEDICATION_OPTIONS = [
  { value: 'Có', labelKey: 'medYes' },
  { value: 'Không', labelKey: 'medNo' },
  { value: 'Chỉ thực phẩm chức năng', labelKey: 'medSupplementOnly' },
];

const CHECKUP_OPTIONS = [
  { value: 'Mỗi ngày', labelKey: 'checkupDaily', icon: 'calendar-check-outline' },
  { value: 'Vài lần/tuần', labelKey: 'checkupFewWeek', icon: 'calendar-sync-outline' },
  { value: 'Thỉnh thoảng', labelKey: 'checkupSometimes', icon: 'clock-outline' },
  { value: 'Gần như không', labelKey: 'checkupRarely', icon: 'eye-off-outline' },
];

const EXERCISE_OPTIONS = [
  { value: 'Ít vận động', labelKey: 'exerciseSedentary', icon: 'sofa-outline' },
  { value: '30 phút', labelKey: 'exercise30min', icon: 'timer-outline' },
  { value: '1 giờ', labelKey: 'exercise1hr', icon: 'walk' },
  { value: 'Trên 1 giờ', labelKey: 'exerciseOver1hr', icon: 'run-fast' },
];

const SLEEP_OPTIONS = [
  { value: 'Đủ 7-8 giờ', labelKey: 'sleep7to8', icon: 'bed-outline' },
  { value: '6-7 giờ', labelKey: 'sleep6to7', icon: 'bed-clock-outline' },
  { value: 'Ít hơn 5 giờ', labelKey: 'sleepLess5', icon: 'sleep' },
];

const MEALS_OPTIONS = [
  { value: '2 bữa', labelKey: 'meals2', icon: 'bowl-outline' },
  { value: '3 bữa', labelKey: 'meals3', icon: 'bowl' },
  { value: '4 bữa trở lên', labelKey: 'meals4plus', icon: 'bowl-mix-outline' },
];

const DROWSY_OPTIONS = [
  { value: 'Không', labelKey: 'drowsyNo', icon: 'emoticon-happy-outline' },
  { value: 'Thỉnh thoảng', labelKey: 'drowsySometimes', icon: 'emoticon-neutral-outline' },
  { value: 'Thường xuyên', labelKey: 'drowsyOften', icon: 'sleep' },
];

const DINNER_OPTIONS = [
  { value: 'Trước 18 giờ', labelKey: 'dinnerBefore18', icon: 'weather-sunset-up' },
  { value: '18-20 giờ', labelKey: 'dinner18to20', icon: 'weather-sunset-down' },
  { value: 'Sau 20 giờ', labelKey: 'dinnerAfter20', icon: 'weather-night' },
];

const SWEET_OPTIONS = [
  { value: 'Hiếm khi', labelKey: 'sweetRarely', icon: 'emoticon-happy-outline' },
  { value: 'Thỉnh thoảng', labelKey: 'sweetSometimes', icon: 'emoticon-neutral-outline' },
  { value: 'Thường xuyên', labelKey: 'sweetOften', icon: 'emoticon-sad-outline' },
];

const GOAL_OPTIONS = [
  { value: 'Hiểu rõ tình trạng sức khoẻ', labelKey: 'goalUnderstandHealth', icon: 'shield-checkmark-outline' },
  { value: 'Nhắc nhở đo chỉ số mỗi ngày', labelKey: 'goalDailyReminder', icon: 'notifications-outline' },
  { value: 'Theo dõi bệnh mãn tính', labelKey: 'goalMonitorChronic', icon: 'stats-chart-outline' },
  { value: 'Lời khuyên dinh dưỡng & lối sống', labelKey: 'goalNutritionAdvice', icon: 'leaf-outline' },
];

const TOTAL_STEPS = 5;
const CURRENT_YEAR = new Date().getFullYear();

// ─── Soft Badge Illustration Component ───────────────────────────────

function StepBadgeIllustration({ step }: { step: number }) {
  if (step === 1) {
    return (
      <View style={badgeStyles.circleBg}>
        <Image
          source={require('../../assets/images/onboarding/step1_badge.png')}
          style={{ width: 80, height: 80, resizeMode: 'contain' }}
        />
      </View>
    );
  }
  if (step === 2) {
    return (
      <View style={badgeStyles.circleBg}>
        <MaterialCommunityIcons name="clipboard-pulse-outline" size={42} color="#008080" />
      </View>
    );
  }
  if (step === 3) {
    return <MaterialCommunityIcons name="heart-pulse" size={52} color="#008080" style={badgeStyles.plainBadge} />;
  }
  if (step === 4) {
    return <MaterialCommunityIcons name="silverware-fork-knife" size={48} color="#008080" style={badgeStyles.plainBadge} />;
  }
  return (
    <View style={badgeStyles.circleBg}>
      <Ionicons name="shield-checkmark-outline" size={42} color="#008080" />
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  circleBg: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainBadge: {
    width: 86,
    height: 86,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
});

// ─── Custom UI Helpers ───────────────────────────────────────────────

function CustomCheckbox({ checked }: { checked: boolean }) {
  return (
    <View style={[checkboxStyles.box, checked && checkboxStyles.boxChecked]}>
      {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
    </View>
  );
}

const checkboxStyles = StyleSheet.create({
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: '#008080',
    borderColor: '#008080',
  },
});

interface CustomChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  fullWidth?: boolean;
}

function CustomChip({ label, active, onPress, fullWidth }: CustomChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        chipStyles.chip,
        active && chipStyles.chipActive,
        pressed && chipStyles.chipPressed,
        fullWidth && chipStyles.chipFullWidth,
      ]}
    >
      <Text style={[chipStyles.chipText, active && chipStyles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  chipActive: {
    backgroundColor: '#EAF8F6',
    borderColor: '#008080',
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipFullWidth: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    textAlign: 'center',
  },
  chipTextActive: {
    color: '#008080',
    fontWeight: '600',
  },
});

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={sectionLabelStyles.label}>
      {label}
    </Text>
  );
}

const sectionLabelStyles = StyleSheet.create({
  label: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
});

function QuestionLabel({ label, icon }: { label: string; icon: string }) {
  return (
    <View style={stepStyles.questionLabel}>
      <MaterialCommunityIcons name={icon as any} size={22} color="#008080" />
      <Text style={stepStyles.questionLabelText}>{label}</Text>
    </View>
  );
}

interface ChoiceCardProps {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}

function ChoiceCard({ label, icon, active, onPress }: ChoiceCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        stepStyles.choiceCard,
        active && stepStyles.choiceCardActive,
        pressed && { opacity: 0.8 },
      ]}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={30}
        color={active ? '#008080' : '#526B84'}
      />
      <Text style={[stepStyles.choiceCardText, active && stepStyles.choiceCardTextActive]}>
        {label}
      </Text>
      <Ionicons
        name={active ? 'checkmark-circle' : 'ellipse-outline'}
        size={23}
        color={active ? '#008080' : '#C4D0DB'}
      />
    </Pressable>
  );
}

// ─── Main Onboarding Screen Component ────────────────────────────────

type SavedOnboardingProfile = {
  user_id: number;
  full_name: string | null;
  birth_year: number | null;
  gender: string | null;
  height_cm: string | number | null;
  weight_kg: string | number | null;
  phone: string | null;
  blood_type: string | null;
  medical_conditions: string[] | null;
  daily_medication: string | null;
  checkup_freq: string | null;
  exercise_freq: string | null;
  sleep_hours: string | null;
  meals_per_day: string | null;
  post_meal_drowsy: string | null;
  dinner_time: string | null;
  sweet_intake: string | null;
  user_goal: string[];
};

function medicalAnswers(diseases: string[], otherDisease: string) {
  return [
    ...diseases.filter(value => value !== DISEASE_NONE_VALUE && value !== DISEASE_OTHER_VALUE),
    ...otherDisease.split(',').map(value => value.trim()).filter(Boolean),
  ];
}

function initialOnboardingAnswers(profile: SavedOnboardingProfile) {
  const conditions = (profile.medical_conditions ?? []).filter(value =>
    value !== DISEASE_NONE_VALUE && value !== DISEASE_OTHER_VALUE
  );
  const isListed = (value: string) => DISEASE_GRID.some(option => option.value === value);
  const diseases = conditions.filter(isListed);
  const otherDisease = conditions.filter(value => !isListed(value)).join(', ');
  if (otherDisease) diseases.push(DISEASE_OTHER_VALUE);
  else if (!diseases.length && profile.medical_conditions) diseases.push(DISEASE_NONE_VALUE);

  return {
    diseases,
    otherDisease,
    answers: {
      full_name: profile.full_name?.trim() ?? '',
      birth_year: profile.birth_year,
      gender: profile.gender ?? '',
      height_cm: profile.height_cm === null ? null : Number(profile.height_cm),
      weight_kg: profile.weight_kg === null ? null : Number(profile.weight_kg),
      phone: profile.phone?.trim().replace(/^(?:\+84|84)(?=\d{9}$)/, '0') || null,
      blood_type: BLOOD_TYPE_OPTIONS.some(option => option.value === profile.blood_type)
        ? profile.blood_type : null,
      medical_conditions: medicalAnswers(diseases, otherDisease),
      daily_medication: profile.daily_medication ?? '',
      checkup_freq: profile.checkup_freq ?? '',
      exercise_freq: profile.exercise_freq ?? '',
      sleep_hours: profile.sleep_hours ?? '',
      meals_per_day: profile.meals_per_day ?? '',
      post_meal_drowsy: profile.post_meal_drowsy ?? '',
      dinner_time: profile.dinner_time ?? '',
      sweet_intake: profile.sweet_intake ?? '',
      user_goal: profile.user_goal,
    },
  };
}

export default function OnboardingScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tc } = useTranslation('common');
  const accountId = useAuthStore(s => s.profile?.id);
  const authenticated = useAuthStore(s => Boolean(s.token));
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{
    accountId: string;
    attempt: number;
    profile: SavedOnboardingProfile | null;
  }>();

  useEffect(() => {
    if (!accountId || !authenticated) return;
    const request = new AbortController();
    apiClient<{ ok: boolean; profile: SavedOnboardingProfile }>(
      '/api/mobile/onboarding/profile-v2', { signal: request.signal }
    ).then(result => {
      if (request.signal.aborted) return;
      const stored = useAuthStore.getState().profile;
      const profile = result.ok && stored?.id === accountId && String(result.profile?.user_id) === accountId
        ? { ...result.profile, full_name: result.profile.full_name ?? stored.name }
        : null;
      setLoaded({ accountId, attempt, profile });
    }).catch(() => {
      if (!request.signal.aborted) setLoaded({ accountId, attempt, profile: null });
    });
    return () => request.abort();
  }, [accountId, authenticated, attempt]);

  const result = authenticated && loaded?.accountId === accountId && loaded?.attempt === attempt ? loaded : undefined;
  if (result?.profile) return <OnboardingForm key={accountId} savedProfile={result.profile} />;
  return (
    <View style={styles.centered}>
      {result ? (
        <>
          <Text style={styles.loadingText}>{t('profileLoadError')}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.profileRetry}
            onPress={() => setAttempt(value => value + 1)}
          >
            <Text style={styles.nextBtnText}>{tc('retry')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#008080" />
          <Text style={styles.loadingText}>{tc('loading')}</Text>
        </>
      )}
    </View>
  );
}

function OnboardingForm({ savedProfile }: { savedProfile: SavedOnboardingProfile }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('onboarding');
  const { t: tc } = useTranslation('common');

  const profile = useAuthStore(s => s.profile);
  const bootstrap = useAuthStore(s => s.bootstrap);

  const isAppleSignIn = useMemo(() => {
    return profile?.authProvider === 'apple';
  }, [profile]);

  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const scaledTypography = useScaledTypography();
  const { scale, setScale } = useFontSizeStore();
  const { language, setLanguage } = useLanguageStore();

  const [showFontModal, setShowFontModal] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [initial] = useState(() => initialOnboardingAnswers(savedProfile));

  // ── Step 1 state ─────────────────────────────────────────────────
  const [fullName, setFullName] = useState(initial.answers.full_name);
  const [birthYear, setBirthYear] = useState(String(initial.answers.birth_year ?? ''));
  const [gender, setGender] = useState(initial.answers.gender);
  const [height, setHeight] = useState(String(initial.answers.height_cm ?? ''));
  const [weight, setWeight] = useState(String(initial.answers.weight_kg ?? ''));
  const [phone, setPhone] = useState(initial.answers.phone ?? '');
  const [bloodType, setBloodType] = useState(initial.answers.blood_type ?? '');
  const [consentAccepted, setConsentAccepted] = useState(true);

  // ── Step 2 state ─────────────────────────────────────────────────
  const [diseases, setDiseases] = useState(initial.diseases);
  const [otherDisease, setOtherDisease] = useState(initial.otherDisease);
  const [medication, setMedication] = useState(initial.answers.daily_medication);

  // ── Step 3 state ─────────────────────────────────────────────────
  const [checkupFreq, setCheckupFreq] = useState(initial.answers.checkup_freq);
  const [exerciseFreq, setExerciseFreq] = useState(initial.answers.exercise_freq);
  const [sleepHours, setSleepHours] = useState(initial.answers.sleep_hours);

  // ── Step 4 state ─────────────────────────────────────────────────
  const [mealsPerDay, setMealsPerDay] = useState(initial.answers.meals_per_day);
  const [postMealDrowsy, setPostMealDrowsy] = useState(initial.answers.post_meal_drowsy);
  const [dinnerTime, setDinnerTime] = useState(initial.answers.dinner_time);
  const [sweetIntake, setSweetIntake] = useState(initial.answers.sweet_intake);

  // ── Step 5 state ─────────────────────────────────────────────────
  const [goals, setGoals] = useState(initial.answers.user_goal);

  function getFontSizeLabel(s: FontSizeScale): string {
    switch (s) {
      case 'small': return tc('fontSmall');
      case 'normal': return tc('fontNormal');
      case 'large': return tc('fontLarge');
      case 'xlarge': return tc('fontXLarge');
    }
  }

  function handleExit() {
    showAlert(
      t('exitOnboardingTitle'),
      t('exitOnboardingMessage'),
      [
        { text: tc('cancel'), style: 'cancel' },
        { text: t('exitOnboardingConfirm'), style: 'destructive', onPress: () => router.replace('/login') },
      ]
    );
  }

  // ── Validation ───────────────────────────────────────────────────

  const birthYearNum = parseInt(birthYear, 10);
  const birthYearValid =
    birthYear.length >= 4 &&
    !isNaN(birthYearNum) &&
    birthYearNum >= 1920 &&
    birthYearNum <= CURRENT_YEAR - 10;
  const birthYearError =
    birthYear.length > 0 && !birthYearValid
      ? t('birthYearError', { maxYear: CURRENT_YEAR - 10 })
      : '';

  const heightNum = parseFloat(height);
  const heightValid = height.length > 0 && !isNaN(heightNum) && heightNum >= 50 && heightNum <= 250;
  const heightError = height.length > 0 && !heightValid ? t('heightError') : '';

  const weightNum = parseFloat(weight);
  const weightValid = weight.length > 0 && !isNaN(weightNum) && weightNum >= 10 && weightNum <= 300;
  const weightError = weight.length > 0 && !weightValid ? t('weightError') : '';

  const phoneValid = phone.trim() === '' || /^0\d{9}$/.test(phone.trim());
  const phoneError = phone.trim().length > 0 && !phoneValid ? t('phoneError') : '';

  const step1Valid = fullName.trim().length >= 2 && birthYearValid && gender !== '' && heightValid && weightValid && phoneValid && consentAccepted;
  const step2Valid = diseases.length > 0;
  const step3Valid = checkupFreq !== '' || exerciseFreq !== '' || sleepHours !== '';
  const step4Valid = mealsPerDay !== '' || postMealDrowsy !== '' || dinnerTime !== '' || sweetIntake !== '';
  const step5Valid = goals.length > 0;

  const canGoNext = (): boolean => {
    if (step === 1) return step1Valid;
    if (step === 2) return step2Valid;
    if (step === 3) return step3Valid;
    if (step === 4) return step4Valid;
    if (step === 5) return step5Valid;
    return false;
  };

  // ── Disease & Goal toggle ─────────────────────────────────────────

  function toggleDisease(value: string) {
    setDiseases(prev => {
      if (prev.includes(value)) {
        const next = prev.filter(v => v !== value);
        if (value === DISEASE_OTHER_VALUE) setOtherDisease('');
        return next;
      }
      if (value === DISEASE_NONE_VALUE) {
        setOtherDisease('');
        return [DISEASE_NONE_VALUE];
      }
      return [...prev.filter(v => v !== DISEASE_NONE_VALUE), value];
    });
  }

  function toggleGoal(value: string) {
    setGoals(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }

  function handleNext() {
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  }

  function handleBack() {
    if (step > 1) {
      setStep(s => s - 1);
      return;
    }
    handleExit();
  }

  // ── Submit ────────────────────────────────────────────────────────

  async function handleSubmit() {
    const accountId = String(savedProfile.user_id);
    const token = useAuthStore.getState().token;
    const current = () => {
      const session = useAuthStore.getState();
      return session.profile?.id === accountId && session.token === token;
    };
    if (!canGoNext() || saving || !token || !current()) return;
    setSaving(true);
    try {
      const answers = {
        full_name: fullName.trim(),
        birth_year: parseInt(birthYear, 10),
        gender,
        height_cm: parseFloat(height),
        weight_kg: parseFloat(weight),
        phone: phone.trim() || null,
        blood_type: BLOOD_TYPE_OPTIONS.some(o => o.value === bloodType) ? bloodType : null,
        medical_conditions: medicalAnswers(diseases, otherDisease),
        daily_medication: medication,
        checkup_freq: checkupFreq,
        exercise_freq: exerciseFreq,
        sleep_hours: sleepHours,
        meals_per_day: mealsPerDay,
        post_meal_drowsy: postMealDrowsy,
        dinner_time: dinnerTime,
        sweet_intake: sweetIntake,
        user_goal: goals,
      };
      const fields = Object.keys(answers) as (keyof typeof answers)[];
      const changes = fields.filter(field =>
        JSON.stringify(answers[field]) !== JSON.stringify(initial.answers[field])
      );
      await apiClient('/api/mobile/onboarding/complete-v2', {
        method: 'POST',
        body: Object.fromEntries(changes.map(field => [field, answers[field]])),
      });

      if (!current()) return;
      await bootstrap();
      if (!current()) return;

      try {
        const fullProfile = await authApi.fetchProfile();
        if (current() && fullProfile?.id === accountId) useAuthStore.setState({ profile: fullProfile });
      } catch {}

      if (!current()) return;
      setPendingToast(tc('savedSuccessfully'), 'success');
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const raw = String(err?.message || '');
      const isHtml = raw.includes('<!DOCTYPE') || raw.includes('<html');
      const msg = (isHtml || raw.length > 200 || !raw) ? tc('saveError') : raw;
      showAlert(tc('error'), msg);
    } finally {
      setSaving(false);
    }
  }

  if (saving) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#008080" />
        <Text style={styles.loadingText}>{t('savingInfo')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />

      {/* Preferences modal */}
      {showFontModal && (
        <Modal
          transparent
          visible
          animationType="fade"
          onRequestClose={() => setShowFontModal(false)}
        >
          <Pressable style={styles.fontModalOverlay} onPress={() => setShowFontModal(false)}>
            <Pressable style={styles.fontModalCard} onPress={(event) => event.stopPropagation()}>
              <View style={styles.preferenceHeader}>
                <Text style={[styles.fontModalTitle, { fontSize: scaledTypography.size.md }]}>
                  {t('settings')}
                </Text>
                <Pressable onPress={() => setShowFontModal(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </Pressable>
              </View>
              <Text style={[styles.preferenceSectionLabel, { fontSize: scaledTypography.size.sm }]}>
                {t('fontSize')}
              </Text>
              <View style={styles.fontSizeRow}>
                {FONT_SIZE_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.value}
                    onPress={() => { setScale(opt.value); setShowFontModal(false); }}
                    style={[styles.fontSizeBtn, scale === opt.value && styles.fontSizeBtnActive]}
                  >
                    <MaterialCommunityIcons
                      name="format-size"
                      size={opt.iconSize}
                      color={scale === opt.value ? '#fff' : '#008080'}
                      style={{ width: 28, textAlign: 'center' }}
                    />
                    <Text
                      style={[
                        styles.fontSizeBtnText,
                        { fontSize: scaledTypography.size.sm },
                        scale === opt.value && styles.fontSizeBtnTextActive,
                      ]}
                    >
                      {getFontSizeLabel(opt.value)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.fontSizePreview, { fontSize: scaledTypography.size.md }]}>
                {t('fontPreview')}
              </Text>
              <Text style={[styles.preferenceSectionLabel, { fontSize: scaledTypography.size.sm }]}>
                {t('language')}
              </Text>
              <View style={styles.languageOptions}>
                {(['vi', 'en'] as const).map(lang => (
                  <Pressable
                    key={lang}
                    onPress={() => setLanguage(lang)}
                    style={[styles.languageOption, language === lang && styles.languageOptionActive]}
                  >
                    <Text style={styles.languageFlag}>
                      {lang === 'vi' ? '🇻🇳' : '🇬🇧'}
                    </Text>
                    <Text style={[styles.languageCode, language === lang && styles.languageCodeActive]}>
                      {lang === 'vi' ? 'VI' : 'EN'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Header Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Pressable
            onPress={handleBack}
            hitSlop={10}
            style={({ pressed }) => [
              styles.exitBtn,
              pressed && { opacity: 0.7 },
              pressed && styles.exitBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={tc('back')}
          >
            <Ionicons name="chevron-back" size={22} color="#008080" />
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.settingsBtn, pressed && styles.exitBtnPressed]}
          onPress={() => setShowFontModal(true)}
          accessibilityRole="button"
          accessibilityLabel={t('settings')}
        >
          <Ionicons name="settings-outline" size={22} color="#008080" />
        </Pressable>
      </View>

      {/* Step Progress Segmented Bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {t('stepProgress', { step, total: TOTAL_STEPS })}
        </Text>
        <View style={styles.segmentedBarRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
            const stepNum = index + 1;
            const isFilled = stepNum <= step;

            return (
              <View
                key={stepNum}
                style={[styles.segmentLine, isFilled && styles.segmentLineActive]}
              />
            );
          })}
        </View>
      </View>

      {/* Main Step Scroll Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Title Card with Soft Badge Illustration */}
        <View style={styles.headerCard}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.headerTitle}>
              {t(`step${step}Title` as any)}
            </Text>
            {(step === 2 || step === 5) && (
              <Text style={styles.headerSubtitle}>
                {t(step === 2 ? 'step2Subtitle' : 'step5Subtitle')}
              </Text>
            )}
          </View>
          <StepBadgeIllustration step={step} />
        </View>

        {/* Step Views */}
        {step === 1 && (
          <Step1
            fullName={fullName}
            setFullName={setFullName}
            isAppleSignIn={isAppleSignIn}
            birthYear={birthYear}
            setBirthYear={setBirthYear}
            birthYearError={birthYearError}
            gender={gender}
            setGender={setGender}
            height={height}
            setHeight={setHeight}
            heightError={heightError}
            weight={weight}
            setWeight={setWeight}
            weightError={weightError}
            phone={phone}
            setPhone={setPhone}
            phoneError={phoneError}
            bloodType={bloodType}
            setBloodType={setBloodType}
            consentAccepted={consentAccepted}
            setConsentAccepted={setConsentAccepted}
          />
        )}

        {step === 2 && (
          <Step2
            diseases={diseases}
            toggleDisease={toggleDisease}
            otherDisease={otherDisease}
            setOtherDisease={setOtherDisease}
            medication={medication}
            setMedication={setMedication}
          />
        )}

        {step === 3 && (
          <Step3
            checkupFreq={checkupFreq}
            setCheckupFreq={setCheckupFreq}
            exerciseFreq={exerciseFreq}
            setExerciseFreq={setExerciseFreq}
            sleepHours={sleepHours}
            setSleepHours={setSleepHours}
          />
        )}

        {step === 4 && (
          <Step4
            mealsPerDay={mealsPerDay}
            setMealsPerDay={setMealsPerDay}
            postMealDrowsy={postMealDrowsy}
            setPostMealDrowsy={setPostMealDrowsy}
            dinnerTime={dinnerTime}
            setDinnerTime={setDinnerTime}
            sweetIntake={sweetIntake}
            setSweetIntake={setSweetIntake}
          />
        )}

        {step === 5 && (
          <Step5
            goals={goals}
            toggleGoal={toggleGoal}
          />
        )}
      </ScrollView>

      {/* Bottom action footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {step < TOTAL_STEPS ? (
          <Pressable
            onPress={handleNext}
            disabled={!canGoNext()}
            style={({ pressed }) => [
              styles.nextBtn,
              !canGoNext() && styles.btnDisabledTeal,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.nextBtnText}>{t('nextStep')}</Text>
            <Ionicons name="chevron-forward" size={26} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={!canGoNext()}
            style={({ pressed }) => [
              styles.nextBtn,
              !canGoNext() && styles.btnDisabledTeal,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.nextBtnText}>{t('complete')}</Text>
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          </Pressable>
        )}

      </View>
    </View>
  );
}

// ─── Step 1 ─────────────────────────────────────────────────────────

interface Step1Props {
  fullName: string;
  setFullName: (v: string) => void;
  isAppleSignIn: boolean;
  birthYear: string;
  setBirthYear: (v: string) => void;
  birthYearError: string;
  gender: string;
  setGender: (v: string) => void;
  height: string;
  setHeight: (v: string) => void;
  heightError: string;
  weight: string;
  setWeight: (v: string) => void;
  weightError: string;
  phone: string;
  setPhone: (v: string) => void;
  phoneError: string;
  bloodType: string;
  setBloodType: (v: string) => void;
  consentAccepted: boolean;
  setConsentAccepted: (v: boolean) => void;
}

function Step1({
  fullName, setFullName,
  isAppleSignIn,
  birthYear, setBirthYear, birthYearError,
  gender, setGender,
  height, setHeight, heightError,
  weight, setWeight, weightError,
  phone, setPhone, phoneError,
  bloodType, setBloodType,
  consentAccepted, setConsentAccepted,
}: Step1Props) {
  const { t } = useTranslation('onboarding');
  const [selectedField, setSelectedField] = useState<PersonalProfileField | null>(null);
  const localProfile = {
    id: 'onboarding-draft', name: fullName, phone, gender,
    dateOfBirth: birthYear ? `${birthYear}-01-01` : null,
    heightCm: height ? Number(height) : null,
    weightKg: weight ? Number(weight) : null,
    bloodType: bloodType || null,
  };
  const confirmField = (update: UpdateProfilePayload) => {
    if (selectedField === 'name' && update.name !== undefined) setFullName(update.name);
    if (selectedField === 'phone' && update.phone !== undefined) setPhone(update.phone);
    if (selectedField === 'gender' && update.gender !== undefined) setGender(update.gender);
    if (selectedField === 'dateOfBirth' && update.dateOfBirth) setBirthYear(update.dateOfBirth.slice(0, 4));
    if (selectedField === 'heightCm' && update.heightCm !== undefined) setHeight(String(update.heightCm));
    if (selectedField === 'weightKg' && update.weightKg !== undefined) setWeight(String(update.weightKg));
    if (selectedField === 'bloodType' && update.bloodType !== undefined) setBloodType(update.bloodType ?? '');
  };
  const fields: Array<{ field: PersonalProfileField; label: string; value: string; placeholder: string; error?: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { field: 'name', label: t('fullName'), value: fullName, placeholder: t('fullNamePlaceholder'), icon: 'person-outline' },
    { field: 'dateOfBirth', label: t('birthYear'), value: birthYear, placeholder: t('birthYearPlaceholder'), error: birthYearError, icon: 'calendar-outline' },
    { field: 'gender', label: t('gender'), value: gender ? t(gender === 'Nam' ? 'genderMale' : gender === 'Nữ' ? 'genderFemale' : 'genderOther') : '', placeholder: t('selectGender'), icon: 'people-outline' },
    { field: 'heightCm', label: t('heightCm'), value: height, placeholder: t('heightPlaceholder'), error: heightError, icon: 'resize-outline' },
    { field: 'weightKg', label: t('weightKg'), value: weight, placeholder: t('weightPlaceholder'), error: weightError, icon: 'scale-outline' },
    { field: 'phone', label: t('phone'), value: phone, placeholder: t('phonePlaceholder'), error: phoneError, icon: 'call-outline' },
    { field: 'bloodType', label: t('bloodType'), value: bloodType, placeholder: t('selectBloodType'), icon: 'water-outline' },
  ];

  return (
    <View style={stepStyles.container}>
      {fields.map(({ field, label, value, placeholder, error, icon }) => {
        const readOnly = field === 'name' && isAppleSignIn;
        return <View key={field} style={stepStyles.fieldGroup}>
          <SectionLabel label={label} />
          <Pressable
            style={stepStyles.selectionRow}
            onPress={() => { if (!readOnly) setSelectedField(field); }}
            disabled={readOnly}
            accessibilityRole={readOnly ? 'text' : 'button'}
            accessibilityLabel={label}
            accessibilityValue={{ text: value || placeholder }}
          >
            <Ionicons name={icon} size={24} color="#008080" />
            <Text style={[stepStyles.selectionValue, !value && stepStyles.selectionPlaceholder]}>{value || placeholder}</Text>
            {!readOnly && <Ionicons name="chevron-forward" size={22} color="#64748B" />}
          </Pressable>
          {!!error && <Text style={stepStyles.errorText}>{error}</Text>}
        </View>;
      })}
      {/* Security Privacy Notice */}
      <View style={stepStyles.securityCard}>
        <Ionicons name="shield-checkmark-outline" size={22} color="#008080" />
        <Text style={stepStyles.securityText}>{t('securityNotice')}</Text>
      </View>

      {/* Consent Checkbox */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <Pressable onPress={() => setConsentAccepted(!consentAccepted)} hitSlop={8}>
          <Ionicons
            name={consentAccepted ? "checkbox" : "square-outline"}
            size={22}
            color={consentAccepted ? "#008080" : "#94A3B8"}
          />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: '#64748B' }}>
          {t('consentPrefix')} {" "}
          <Text style={{ color: '#008080', fontWeight: '700' }} onPress={() => Linking.openURL(TERMS_URL)}>{t('termsOfService')}</Text>
          {" "}{t('and')}{" "}
          <Text style={{ color: '#008080', fontWeight: '700' }} onPress={() => Linking.openURL(PRIVACY_URL)}>{t('privacyPolicy')}</Text>
          {" "}{t('consentSuffix')}
        </Text>
      </View>

      {selectedField && <ProfileFieldSheet
        key={selectedField}
        field={selectedField}
        profile={localProfile}
        onConfirm={confirmField}
        onClose={() => setSelectedField(null)}
        allowEmptyPhone
        birthYearOnly={selectedField === 'dateOfBirth' ? { min: 1920, max: CURRENT_YEAR - 10 } : undefined}
      />}
    </View>
  );
}

// ─── Step 2 ─────────────────────────────────────────────────────────

interface Step2Props {
  diseases: string[];
  toggleDisease: (v: string) => void;
  otherDisease: string;
  setOtherDisease: (v: string) => void;
  medication: string;
  setMedication: (v: string) => void;
}

function Step2({
  diseases, toggleDisease,
  otherDisease, setOtherDisease,
  medication, setMedication,
}: Step2Props) {
  const { t } = useTranslation('onboarding');
  const hasOther = diseases.includes(DISEASE_OTHER_VALUE);

  return (
    <View style={stepStyles.container}>
      {/* Disease Checkboxes Card List */}
      <View style={stepStyles.cardList}>
        {DISEASE_GRID.map(item => {
          const checked = diseases.includes(item.value);
          return (
            <Pressable
              key={item.value}
              onPress={() => toggleDisease(item.value)}
              style={({ pressed }) => [
                stepStyles.cardRow,
                checked && stepStyles.cardRowActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={stepStyles.cardRowLeft}>
                <Ionicons name={item.icon as any} size={20} color="#008080" />
                <Text style={stepStyles.cardRowLabel}>{t(item.labelKey)}</Text>
              </View>
              <CustomCheckbox checked={checked} />
            </Pressable>
          );
        })}

        {DISEASE_FOOTER.map(item => {
          const checked = diseases.includes(item.value);
          return (
            <Pressable
              key={item.value}
              onPress={() => toggleDisease(item.value)}
              style={({ pressed }) => [
                stepStyles.cardRow,
                checked && stepStyles.cardRowActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={stepStyles.cardRowLeft}>
                <Ionicons name={item.icon as any} size={20} color="#008080" />
                <Text style={stepStyles.cardRowLabel}>{t(item.labelKey)}</Text>
              </View>
              <CustomCheckbox checked={checked} />
            </Pressable>
          );
        })}
      </View>

      {/* Other disease detail */}
      {hasOther && (
        <View style={stepStyles.fieldGroup}>
          <SectionLabel label={t('otherDiseaseLabel')} />
          <View style={stepStyles.inputWrapper}>
            <RNTextInput
              style={stepStyles.inputField}
              placeholder={t('otherDiseasePlaceholder')}
              placeholderTextColor="#94A3B8"
              value={otherDisease}
              onChangeText={setOtherDisease}
            />
          </View>
        </View>
      )}

      {/* Daily medication option */}
      <View style={stepStyles.fieldGroup}>
        <SectionLabel label={t('dailyMedication')} />
        <View style={stepStyles.optionsColumn}>
          {MEDICATION_OPTIONS.map(opt => (
            <CustomChip
              key={opt.value}
              label={t(opt.labelKey)}
              active={medication === opt.value}
              onPress={() => setMedication(opt.value)}
              fullWidth
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Step 3 ─────────────────────────────────────────────────────────

interface Step3Props {
  checkupFreq: string;
  setCheckupFreq: (v: string) => void;
  exerciseFreq: string;
  setExerciseFreq: (v: string) => void;
  sleepHours: string;
  setSleepHours: (v: string) => void;
}

function Step3({
  checkupFreq, setCheckupFreq,
  exerciseFreq, setExerciseFreq,
  sleepHours, setSleepHours,
}: Step3Props) {
  const { t } = useTranslation('onboarding');

  return (
    <View style={stepStyles.container}>
      {/* Question 1 */}
      <View style={stepStyles.fieldGroup}>
        <QuestionLabel label={t('checkupFreq')} icon="calendar-check-outline" />
        <View style={stepStyles.choiceRow}>
          {CHECKUP_OPTIONS.map(opt => (
            <ChoiceCard
              key={opt.value}
              label={t(opt.labelKey)}
              icon={opt.icon}
              active={checkupFreq === opt.value}
              onPress={() => setCheckupFreq(opt.value)}
            />
          ))}
        </View>
      </View>

      {/* Question 2 */}
      <View style={stepStyles.fieldGroup}>
        <QuestionLabel label={t('exerciseFreq')} icon="shoe-sneaker" />
        <View style={stepStyles.choiceRow}>
          {EXERCISE_OPTIONS.map(opt => (
            <ChoiceCard
              key={opt.value}
              label={t(opt.labelKey)}
              icon={opt.icon}
              active={exerciseFreq === opt.value}
              onPress={() => setExerciseFreq(opt.value)}
            />
          ))}
        </View>
      </View>

      {/* Question 3 */}
      <View style={stepStyles.fieldGroup}>
        <QuestionLabel label={t('sleepHours')} icon="weather-night" />
        <View style={stepStyles.choiceRow}>
          {SLEEP_OPTIONS.map(opt => (
            <ChoiceCard
              key={opt.value}
              label={t(opt.labelKey)}
              icon={opt.icon}
              active={sleepHours === opt.value}
              onPress={() => setSleepHours(opt.value)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Step 4 ─────────────────────────────────────────────────────────

interface Step4Props {
  mealsPerDay: string;
  setMealsPerDay: (v: string) => void;
  postMealDrowsy: string;
  setPostMealDrowsy: (v: string) => void;
  dinnerTime: string;
  setDinnerTime: (v: string) => void;
  sweetIntake: string;
  setSweetIntake: (v: string) => void;
}

function Step4({
  mealsPerDay, setMealsPerDay,
  postMealDrowsy, setPostMealDrowsy,
  dinnerTime, setDinnerTime,
  sweetIntake, setSweetIntake,
}: Step4Props) {
  const { t } = useTranslation('onboarding');

  return (
    <View style={stepStyles.container}>
      {/* Question 1 */}
      <View style={stepStyles.fieldGroup}>
        <QuestionLabel label={t('mealsPerDay')} icon="bowl-outline" />
        <View style={stepStyles.choiceRow}>
          {MEALS_OPTIONS.map(opt => (
            <ChoiceCard
              key={opt.value}
              label={t(opt.labelKey)}
              icon={opt.icon}
              active={mealsPerDay === opt.value}
              onPress={() => setMealsPerDay(opt.value)}
            />
          ))}
        </View>
      </View>

      {/* Question 2 */}
      <View style={stepStyles.fieldGroup}>
        <QuestionLabel label={t('postMealDrowsy')} icon="sleep" />
        <View style={stepStyles.choiceRow}>
          {DROWSY_OPTIONS.map(opt => (
            <ChoiceCard
              key={opt.value}
              label={t(opt.labelKey)}
              icon={opt.icon}
              active={postMealDrowsy === opt.value}
              onPress={() => setPostMealDrowsy(opt.value)}
            />
          ))}
        </View>
      </View>

      {/* Question 3 */}
      <View style={stepStyles.fieldGroup}>
        <QuestionLabel label={t('dinnerTime')} icon="clock-outline" />
        <View style={stepStyles.choiceRow}>
          {DINNER_OPTIONS.map(opt => (
            <ChoiceCard
              key={opt.value}
              label={t(opt.labelKey)}
              icon={opt.icon}
              active={dinnerTime === opt.value}
              onPress={() => setDinnerTime(opt.value)}
            />
          ))}
        </View>
      </View>

      {/* Question 4: Sweet intake with Vector Icon Cards */}
      <View style={stepStyles.fieldGroup}>
        <QuestionLabel label={t('sweetIntake')} icon="bottle-soda-outline" />
        <View style={stepStyles.choiceRow}>
          {SWEET_OPTIONS.map(opt => {
            const active = sweetIntake === opt.value;
            return (
              <ChoiceCard
                key={opt.value}
                label={t(opt.labelKey)}
                icon={opt.icon}
                active={active}
                onPress={() => setSweetIntake(opt.value)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Step 5 ─────────────────────────────────────────────────────────

interface Step5Props {
  goals: string[];
  toggleGoal: (v: string) => void;
}

function Step5({ goals, toggleGoal }: Step5Props) {
  const { t } = useTranslation('onboarding');

  return (
    <View style={stepStyles.container}>
      <View style={stepStyles.cardList}>
        {GOAL_OPTIONS.map(opt => {
          const checked = goals.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => toggleGoal(opt.value)}
              style={({ pressed }) => [
                stepStyles.cardRow,
                checked && stepStyles.cardRowActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={stepStyles.cardRowLeft}>
                <Ionicons name={opt.icon as any} size={20} color="#008080" />
                <Text style={stepStyles.cardRowLabel}>{t(opt.labelKey)}</Text>
              </View>
              <CustomCheckbox checked={checked} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  profileRetry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#008080',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exitBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  exitBtnPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.94 }],
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Segmented Progress Line Bar
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  segmentedBarRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentLine: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
  },
  segmentLineActive: {
    backgroundColor: '#008080',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  // Header Title Card
  headerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#008080',
  },
  headerSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 19,
    marginTop: 4,
  },

  // Footer (Stacked Vertically per Reference UI)
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  nextBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#008080',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  nextBtnText: {
    fontSize: 15.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnDisabledTeal: {
    opacity: 0.5,
  },
  textDisabled: {
    color: '#94A3B8',
  },

  // Font size modal
  fontModalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 20,
  },
  fontModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  fontModalTitle: {
    fontWeight: '700',
    color: '#0F172A',
  },
  preferenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preferenceSectionLabel: {
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  languageOptions: {
    gap: 8,
  },
  languageOption: {
    width: '100%',
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  languageOptionActive: {
    borderColor: '#008080',
    backgroundColor: '#EAF8F6',
  },
  languageFlag: {
    fontSize: 21,
  },
  languageCode: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  languageCodeActive: {
    color: '#008080',
  },
  fontSizeRow: {
    flexDirection: 'column',
    gap: 8,
  },
  fontSizeBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  fontSizeBtnActive: {
    backgroundColor: '#008080',
    borderColor: '#008080',
  },
  fontSizeBtnText: {
    fontWeight: '600',
    color: '#334155',
  },
  fontSizeBtnTextActive: {
    color: '#FFFFFF',
  },
  fontSizePreview: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
});

const stepStyles = StyleSheet.create({
  container: {
    gap: 18,
  },
  selectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 16 },
  selectionValue: { flex: 1, fontSize: 16, color: '#0F172A' },
  selectionPlaceholder: { color: '#64748B' },
  fieldGroup: {
    gap: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    height: 52,
    position: 'relative',
  },
  inputField: {
    flex: 1,
    fontSize: 15.5,
    color: '#0F172A',
    paddingRight: 48,
  },
  errorText: {
    fontSize: 12.5,
    color: '#EF4444',
    marginTop: 4,
  },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDFA',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  securityText: {
    flex: 1,
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    fontWeight: '400',
  },
  cardList: {
    gap: 10,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    minWidth: 0,
  },
  cardRowActive: {
    borderColor: '#008080',
    backgroundColor: '#EAF8F6',
  },
  cardRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  cardRowLabel: {
    flexShrink: 1,
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
    lineHeight: 20,
  },
  optionsColumn: {
    gap: 8,
  },
  chipWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  questionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 30,
    marginBottom: 8,
  },
  questionLabelText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: '#334155',
    fontWeight: '600',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choiceCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  choiceCardActive: {
    borderColor: '#008080',
    backgroundColor: '#EAF8F6',
  },
  choiceCardText: {
    minHeight: 34,
    fontSize: 13,
    lineHeight: 17,
    color: '#526B84',
    fontWeight: '500',
    textAlign: 'center',
  },
  choiceCardTextActive: {
    color: '#008080',
    fontWeight: '700',
  },
  emojiCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emojiCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  emojiCardActive: {
    backgroundColor: '#EAF8F6',
    borderColor: '#008080',
  },
  emojiCardText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  emojiCardTextActive: {
    color: '#008080',
    fontWeight: '600',
  },
});
