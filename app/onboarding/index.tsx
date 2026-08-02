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
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { authApi } from '../../src/features/auth/auth.api';
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
    backgroundColor: '#EAF8F6',
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

export default function OnboardingScreen() {
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

  // ── Step 1 state ─────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(true);

  // ── Step 2 state ─────────────────────────────────────────────────
  const [diseases, setDiseases] = useState<string[]>([]);
  const [otherDisease, setOtherDisease] = useState('');
  const [medication, setMedication] = useState('');

  // ── Step 3 state ─────────────────────────────────────────────────
  const [checkupFreq, setCheckupFreq] = useState('');
  const [exerciseFreq, setExerciseFreq] = useState('');
  const [sleepHours, setSleepHours] = useState('');

  // ── Step 4 state ─────────────────────────────────────────────────
  const [mealsPerDay, setMealsPerDay] = useState('');
  const [postMealDrowsy, setPostMealDrowsy] = useState('');
  const [dinnerTime, setDinnerTime] = useState('');
  const [sweetIntake, setSweetIntake] = useState('');

  // ── Step 5 state ─────────────────────────────────────────────────
  const [goals, setGoals] = useState<string[]>([]);

  useEffect(() => {
    if (profile?.name && !fullName) {
      setFullName(profile.name);
    }
  }, [profile]);

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
    if (!step5Valid) return;
    setSaving(true);
    try {
      const medicalConditions = diseases
        .filter(d => d !== DISEASE_NONE_VALUE)
        .concat(
          otherDisease
            ? otherDisease
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
            : []
        );

      await apiClient('/api/mobile/onboarding/complete-v2', {
        method: 'POST',
        body: {
          full_name: fullName.trim(),
          birth_year: parseInt(birthYear, 10),
          gender,
          height_cm: parseFloat(height),
          weight_kg: parseFloat(weight),
          phone: phone.trim() || null,
          blood_type: BLOOD_TYPE_OPTIONS.some(o => o.value === bloodType) ? bloodType : null,
          medical_conditions: medicalConditions,
          daily_medication: medication,
          checkup_freq: checkupFreq,
          exercise_freq: exerciseFreq,
          sleep_hours: sleepHours,
          meals_per_day: mealsPerDay,
          post_meal_drowsy: postMealDrowsy,
          dinner_time: dinnerTime,
          sweet_intake: sweetIntake,
          user_goal: goals,
        },
      });

      await bootstrap();

      try {
        const fullProfile = await authApi.fetchProfile();
        if (fullProfile) useAuthStore.setState({ profile: fullProfile });
      } catch {}

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

      {/* Font size modal */}
      {showFontModal && (
        <Pressable style={styles.fontModalOverlay} onPress={() => setShowFontModal(false)}>
          <Pressable style={styles.fontModalCard} onPress={() => {}}>
            <Text style={[styles.fontModalTitle, { fontSize: scaledTypography.size.md }]}>
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
          </Pressable>
        </Pressable>
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
            ]}
          >
            <Ionicons name="chevron-back" size={20} color="#008080" />
          </Pressable>
          <Pressable style={styles.fontSizeTopBtn} onPress={() => setShowFontModal(true)}>
            <MaterialCommunityIcons name="format-size" size={16} color="#008080" />
            <Text style={styles.fontSizeTopLabel}>
              {getFontSizeLabel(scale)}
            </Text>
          </Pressable>
        </View>

        {/* Language Segmented Toggle */}
        <View style={styles.languageToggle}>
          {(['vi', 'en'] as const).map(lang => (
            <Pressable
              key={lang}
              onPress={() => setLanguage(lang)}
              style={[styles.langBtn, language === lang && styles.langBtnActive]}
            >
              <Text style={[styles.langBtnText, language === lang && styles.langBtnTextActive]}>
                {lang.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
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
            <Text style={styles.headerSubtitle}>
              {step === 1 ? 'Cung cấp thông tin để Asinu hiểu bạn tốt hơn và chăm sóc phù hợp cho bạn.' :
               step === 2 ? 'Chọn tất cả bệnh bạn đang có (nếu có)' :
               step === 3 ? 'Giúp chúng tôi hiểu rõ hơn về lối sống của bạn.' :
               step === 4 ? 'Thói quen ăn uống giúp chúng tôi đưa ra đề xuất phù hợp hơn.' :
               'Có thể chọn nhiều'}
            </Text>
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

      {/* Bottom Actions Footer (Stacked vertically per reference UI) */}
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
            <Text style={styles.nextBtnText}>
              {tc('continue')}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
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
            <Text style={styles.nextBtnText}>
              {t('complete')}
            </Text>
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          </Pressable>
        )}

        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.backBtnText}>
            {tc('back')}
          </Text>
        </Pressable>
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
  const [showBirthYearPicker, setShowBirthYearPicker] = useState(false);
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const maxBirthYear = CURRENT_YEAR - 10;
  const birthYears = useMemo(
    () => Array.from({ length: maxBirthYear - 1920 + 1 }, (_, index) => String(maxBirthYear - index)),
    [maxBirthYear],
  );
  const heightOptions = useMemo(
    () => Array.from({ length: 201 }, (_, index) => String(250 - index)),
    [],
  );

  const GENDER_OPTIONS = [
    { value: 'Nam', labelKey: 'genderMale', icon: 'male-outline' },
    { value: 'Nữ', labelKey: 'genderFemale', icon: 'female-outline' },
    { value: 'Khác', labelKey: 'genderOther', icon: 'person-outline' },
  ];

  return (
    <View style={stepStyles.container}>
      {/* Full Name Input */}
      <View style={stepStyles.fieldGroup}>
        <SectionLabel label={t('fullName')} />
        <View style={stepStyles.inputWrapper}>
          <Ionicons name="person-outline" size={20} color="#008080" style={stepStyles.inputIcon} />
          {isAppleSignIn ? (
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15.5, color: '#0F172A' }}>{fullName}</Text>
            </View>
          ) : (
            <RNTextInput
              style={stepStyles.inputField}
              placeholder={t('fullNamePlaceholder')}
              placeholderTextColor="#94A3B8"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          )}
        </View>
      </View>

      {/* Birth Year Input */}
      <View style={stepStyles.fieldGroup}>
        <SectionLabel label={t('birthYear')} />
        <View style={stepStyles.inputWrapper}>
          <Ionicons name="calendar-outline" size={20} color="#008080" style={stepStyles.inputIcon} />
          <RNTextInput
            style={stepStyles.inputField}
            placeholder={t('birthYearPlaceholder')}
            placeholderTextColor="#94A3B8"
            value={birthYear}
            onChangeText={setBirthYear}
            keyboardType="numeric"
            maxLength={4}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('selectBirthYear')}
            onPress={() => setShowBirthYearPicker(true)}
            style={stepStyles.birthYearChevron}
          >
            <Ionicons name="chevron-down" size={18} color="#94A3B8" />
          </Pressable>
        </View>
        {!!birthYearError && <Text style={stepStyles.errorText}>{birthYearError}</Text>}
      </View>

      {/* Gender Selection */}
      <View style={stepStyles.fieldGroup}>
        <SectionLabel label={t('gender')} />
        <View style={stepStyles.genderRow}>
          {GENDER_OPTIONS.map(opt => {
            const active = gender === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setGender(opt.value)}
                style={[
                  stepStyles.genderBtn,
                  active && stepStyles.genderBtnActive,
                ]}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={18}
                  color={active ? '#008080' : '#64748B'}
                />
                <Text style={[stepStyles.genderBtnText, active && stepStyles.genderBtnTextActive]}>
                  {t(opt.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Height Input */}
      <View style={stepStyles.fieldGroup}>
        <SectionLabel label={t('heightCm')} />
        <View style={stepStyles.inputWrapper}>
          <MaterialCommunityIcons name="ruler" size={20} color="#008080" style={stepStyles.inputIcon} />
          <RNTextInput
            style={stepStyles.inputField}
            placeholder={t('heightPlaceholder')}
            placeholderTextColor="#94A3B8"
            value={height}
            onChangeText={setHeight}
            keyboardType="numeric"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('selectHeight')}
            onPress={() => setShowHeightPicker(true)}
            style={stepStyles.birthYearChevron}
          >
            <Ionicons name="chevron-down" size={18} color="#94A3B8" />
          </Pressable>
        </View>
        {!!heightError && <Text style={stepStyles.errorText}>{heightError}</Text>}
      </View>

      {/* Weight Input */}
      <View style={stepStyles.fieldGroup}>
        <SectionLabel label={t('weightKg')} />
        <View style={stepStyles.inputWrapper}>
          <Ionicons name="fitness-outline" size={20} color="#008080" style={stepStyles.inputIcon} />
          <RNTextInput
            style={stepStyles.inputField}
            placeholder={t('weightPlaceholder')}
            placeholderTextColor="#94A3B8"
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
          />
        </View>
        {!!weightError && <Text style={stepStyles.errorText}>{weightError}</Text>}
      </View>

      {/* Phone Input */}
      <View style={stepStyles.fieldGroup}>
        <SectionLabel label={t('phone')} />
        <View style={stepStyles.inputWrapper}>
          <Ionicons name="call-outline" size={20} color="#008080" style={stepStyles.inputIcon} />
          <RNTextInput
            style={stepStyles.inputField}
            placeholder={t('phonePlaceholder')}
            placeholderTextColor="#94A3B8"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={11}
          />
        </View>
        {!!phoneError && <Text style={stepStyles.errorText}>{phoneError}</Text>}
      </View>

      {/* Blood Type Selector */}
      <View style={stepStyles.fieldGroup}>
        <SectionLabel label={t('bloodType')} />
        <View style={stepStyles.bloodGrid}>
          {BLOOD_TYPE_OPTIONS.map(opt => (
            <View key={opt.value} style={stepStyles.bloodItem}>
              <CustomChip
                label={opt.value}
                active={bloodType === opt.value}
                onPress={() => setBloodType(bloodType === opt.value ? '' : opt.value)}
                fullWidth
              />
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => setBloodType(bloodType === 'Không biết' ? '' : 'Không biết')}
          style={{ alignSelf: 'center', marginTop: 6 }}
        >
          <Text style={{ color: '#008080', fontSize: 13, fontWeight: '500' }}>
            {t('bloodTypeUnknown')}
          </Text>
        </Pressable>
      </View>

      {/* Security Privacy Notice */}
      <View style={stepStyles.securityCard}>
        <Ionicons name="shield-checkmark-outline" size={22} color="#008080" />
        <Text style={stepStyles.securityText}>
          <Text style={{ fontWeight: '700', color: '#008080' }}>Thông tin</Text> của bạn được bảo mật tuyệt đối và chỉ dùng để chăm sóc sức khỏe.
        </Text>
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
          Tôi đồng ý với các{" "}
          <Text style={{ color: '#008080', fontWeight: '700' }} onPress={() => Linking.openURL(TERMS_URL)}>Điều khoản dịch vụ</Text>
          {" "}và{" "}
          <Text style={{ color: '#008080', fontWeight: '700' }} onPress={() => Linking.openURL(PRIVACY_URL)}>Chính sách bảo mật</Text>
          {" "}của Asinu.
        </Text>
      </View>

      <Modal
        visible={showBirthYearPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBirthYearPicker(false)}
      >
        <Pressable
          style={stepStyles.birthYearModalOverlay}
          onPress={() => setShowBirthYearPicker(false)}
        >
          <Pressable style={stepStyles.birthYearModalCard} onPress={() => {}}>
            <View style={stepStyles.birthYearModalHeader}>
              <Text style={stepStyles.birthYearModalTitle}>{t('selectBirthYear')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('closePicker')}
                hitSlop={8}
                onPress={() => setShowBirthYearPicker(false)}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView
              style={stepStyles.birthYearList}
              contentContainerStyle={stepStyles.birthYearListContent}
              showsVerticalScrollIndicator={false}
            >
              {birthYears.map(year => {
                const selected = birthYear === year;
                return (
                  <Pressable
                    key={year}
                    onPress={() => {
                      setBirthYear(year);
                      setShowBirthYearPicker(false);
                    }}
                    style={[stepStyles.birthYearOption, selected && stepStyles.birthYearOptionSelected]}
                  >
                    <Text style={[stepStyles.birthYearOptionText, selected && stepStyles.birthYearOptionTextSelected]}>
                      {year}
                    </Text>
                    {selected && <Ionicons name="checkmark-circle" size={20} color="#008080" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showHeightPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHeightPicker(false)}
      >
        <Pressable
          style={stepStyles.birthYearModalOverlay}
          onPress={() => setShowHeightPicker(false)}
        >
          <Pressable style={stepStyles.birthYearModalCard} onPress={() => {}}>
            <View style={stepStyles.birthYearModalHeader}>
              <Text style={stepStyles.birthYearModalTitle}>{t('selectHeight')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('closePicker')}
                hitSlop={8}
                onPress={() => setShowHeightPicker(false)}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView
              style={stepStyles.birthYearList}
              contentContainerStyle={stepStyles.birthYearListContent}
              showsVerticalScrollIndicator={false}
            >
              {heightOptions.map(value => {
                const selected = height === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => {
                      setHeight(value);
                      setShowHeightPicker(false);
                    }}
                    style={[stepStyles.birthYearOption, selected && stepStyles.birthYearOptionSelected]}
                  >
                    <Text style={[stepStyles.birthYearOptionText, selected && stepStyles.birthYearOptionTextSelected]}>
                      {value} cm
                    </Text>
                    {selected && <Ionicons name="checkmark-circle" size={20} color="#008080" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fontSizeTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  fontSizeTopLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#008080',
  },
  languageToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 3,
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  langBtnActive: {
    backgroundColor: '#008080',
  },
  langBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  langBtnTextActive: {
    color: '#FFFFFF',
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
  backBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#008080',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 15.5,
    fontWeight: '600',
    color: '#008080',
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
    ...StyleSheet.absoluteFillObject,
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
    textAlign: 'center',
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
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 15.5,
    color: '#0F172A',
    paddingRight: 48,
  },
  birthYearChevron: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 64,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  errorText: {
    fontSize: 12.5,
    color: '#EF4444',
    marginTop: 4,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  genderBtnActive: {
    backgroundColor: '#EAF8F6',
    borderColor: '#008080',
  },
  genderBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  genderBtnTextActive: {
    color: '#008080',
    fontWeight: '600',
  },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodItem: {
    width: '23%',
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
  birthYearModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  birthYearModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    maxHeight: '70%',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  birthYearModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  birthYearModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  birthYearList: {
    maxHeight: 360,
  },
  birthYearListContent: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  birthYearOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  birthYearOptionSelected: {
    backgroundColor: '#E6F7F5',
  },
  birthYearOptionText: {
    fontSize: 15,
    color: '#334155',
  },
  birthYearOptionTextSelected: {
    color: '#008080',
    fontWeight: '700',
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
  },
  cardRowLabel: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
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
