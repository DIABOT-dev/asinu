import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { authApi } from '../../src/features/auth/auth.api';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { apiClient } from '../../src/lib/apiClient';
import { FontSizeScale, useFontSizeStore } from '../../src/stores/font-size.store';
import { useLanguageStore } from '../../src/stores/language.store';
import { colors, radius, spacing } from '../../src/styles';
import { useThemeColors } from '../../src/hooks/useThemeColors';

const FONT_SIZE_OPTIONS: Array<{ value: FontSizeScale; iconSize: number }> = [
  { value: 'small', iconSize: 16 },
  { value: 'normal', iconSize: 20 },
  { value: 'large', iconSize: 24 },
  { value: 'xlarge', iconSize: 28 },
];

// ─── Constants ──────────────────────────────────────────────────────
// value = data sent to backend (Vietnamese, for backward compatibility)
// labelKey = i18n key for display

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
  { value: 'Tiểu đường', labelKey: 'diseaseDiabetes' },
  { value: 'Tiền tiểu đường', labelKey: 'diseasePrediabetes' },
  { value: 'Cao huyết áp', labelKey: 'diseaseHypertension' },
  { value: 'Bệnh tim', labelKey: 'diseaseHeart' },
  { value: 'Mỡ máu', labelKey: 'diseaseDyslipidemia' },
  { value: 'Tiền đình', labelKey: 'diseaseVertigo' },
  { value: 'Đau dạ dày', labelKey: 'diseaseStomach' },
  { value: 'Gout', labelKey: 'diseaseGout' },
];
const DISEASE_FOOTER = [
  { value: 'Không có', labelKey: 'diseaseNone' },
  { value: 'Khác', labelKey: 'diseaseOther' },
];

const MEDICATION_OPTIONS = [
  { value: 'Có', labelKey: 'medYes' },
  { value: 'Không', labelKey: 'medNo' },
  { value: 'Chỉ thực phẩm chức năng', labelKey: 'medSupplementOnly' },
];
const CHECKUP_OPTIONS = [
  { value: 'Mỗi ngày', labelKey: 'checkupDaily' },
  { value: 'Vài lần/tuần', labelKey: 'checkupFewWeek' },
  { value: 'Thỉnh thoảng', labelKey: 'checkupSometimes' },
  { value: 'Gần như không', labelKey: 'checkupRarely' },
];
const EXERCISE_OPTIONS = [
  { value: 'Ít vận động', labelKey: 'exerciseSedentary' },
  { value: '30 phút', labelKey: 'exercise30min' },
  { value: '1 giờ', labelKey: 'exercise1hr' },
  { value: 'Trên 1 giờ', labelKey: 'exerciseOver1hr' },
];
const SLEEP_OPTIONS = [
  { value: 'Đủ 7-8 giờ', labelKey: 'sleep7to8' },
  { value: '6-7 giờ', labelKey: 'sleep6to7' },
  { value: 'Ít hơn 5 giờ', labelKey: 'sleepLess5' },
];
const MEALS_OPTIONS = [
  { value: '2 bữa', labelKey: 'meals2' },
  { value: '3 bữa', labelKey: 'meals3' },
  { value: '4 bữa trở lên', labelKey: 'meals4plus' },
];
const DROWSY_OPTIONS = [
  { value: 'Không', labelKey: 'drowsyNo' },
  { value: 'Thỉnh thoảng', labelKey: 'drowsySometimes' },
  { value: 'Thường xuyên', labelKey: 'drowsyOften' },
];
const DINNER_OPTIONS = [
  { value: 'Trước 18 giờ', labelKey: 'dinnerBefore18' },
  { value: '18-20 giờ', labelKey: 'dinner18to20' },
  { value: 'Sau 20 giờ', labelKey: 'dinnerAfter20' },
];
const SWEET_OPTIONS = [
  { value: 'Hiếm khi', labelKey: 'sweetRarely' },
  { value: 'Thỉnh thoảng', labelKey: 'sweetSometimes' },
  { value: 'Thường xuyên', labelKey: 'sweetOften' },
];
const GOAL_OPTIONS = [
  { value: 'Hiểu rõ tình trạng sức khoẻ', labelKey: 'goalUnderstandHealth' },
  { value: 'Nhắc nhở đo chỉ số mỗi ngày', labelKey: 'goalDailyReminder' },
  { value: 'Theo dõi bệnh mãn tính', labelKey: 'goalMonitorChronic' },
  { value: 'Lời khuyên dinh dưỡng & lối sống', labelKey: 'goalNutritionAdvice' },
];

const TOTAL_STEPS = 5;
const CURRENT_YEAR = new Date().getFullYear();

// ─── Chip component ──────────────────────────────────────────────────

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  fullWidth?: boolean;
}

function Chip({ label, active, onPress, fullWidth }: ChipProps) {
  const scaledTypography = useScaledTypography();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.primary + '22' }}
      style={({ pressed }) => [
        chipStyles.chip,
        active && chipStyles.chipActive,
        pressed && chipStyles.chipPressed,
        fullWidth && chipStyles.chipFullWidth,
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[chipStyles.chipText, { fontSize: scaledTypography.size.sm }, active && chipStyles.chipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipFullWidth: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    minHeight: 48,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

// ─── Section label ───────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  const scaledTypography = useScaledTypography();
  return (
    <Text style={{ fontSize: scaledTypography.size.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>
      {label}
    </Text>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tc } = useTranslation('common');
  const { t: ts } = useTranslation('settings');
  const { language, setLanguage } = useLanguageStore();
  const { scale, setScale } = useFontSizeStore();
  const scaledTypography = useScaledTypography();
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bootstrap = useAuthStore((s) => s.bootstrap);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showFontModal, setShowFontModal] = useState(false);

  const getFontSizeLabel = (value: FontSizeScale): string => {
    const labels: Record<FontSizeScale, string> = {
      small: ts('fontSmall'),
      normal: ts('fontNormal'),
      large: ts('fontLarge'),
      xlarge: ts('fontXLarge'),
    };
    return labels[value];
  };

  // ── Step 1 state ─────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodType, setBloodType] = useState('');

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

  const phoneValid = /^0\d{9}$/.test(phone.trim());
  const phoneError = phone.length > 0 && !phoneValid ? t('phoneError') : '';

  const step1Valid = fullName.trim().length >= 2 && birthYearValid && gender !== '' && heightValid && weightValid && phoneValid;
  const step2Valid = diseases.length > 0 && medication !== '';
  const step3Valid = checkupFreq !== '' && exerciseFreq !== '' && sleepHours !== '';
  const step4Valid =
    mealsPerDay !== '' && postMealDrowsy !== '' && dinnerTime !== '' && sweetIntake !== '';
  const step5Valid = goals.length > 0;

  const canGoNext = (): boolean => {
    if (step === 1) return step1Valid;
    if (step === 2) return step2Valid;
    if (step === 3) return step3Valid;
    if (step === 4) return step4Valid;
    if (step === 5) return step5Valid;
    return false;
  };

  // ── Disease toggle ────────────────────────────────────────────────

  function toggleDisease(value: string) {
    setDiseases(prev => {
      if (prev.includes(value)) {
        const next = prev.filter(v => v !== value);
        if (value === 'Khác') setOtherDisease('');
        return next;
      }
      if (value === 'Không có') {
        setOtherDisease('');
        return ['Không có'];
      }
      return [...prev.filter(v => v !== 'Không có'), value];
    });
  }

  function toggleGoal(value: string) {
    setGoals(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }

  // ── Navigation ────────────────────────────────────────────────────

  function handleNext() {
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  }

  function handleBack() {
    if (step > 1) setStep(s => s - 1);
  }

  // ── Submit ────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!step5Valid) return;
    setSaving(true);
    try {
      const medicalConditions = diseases
        .filter(d => d !== 'Không có')
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
          phone: phone.trim(),
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

      // Fetch full profile so health data (height, weight, age, etc.) is in store immediately
      try {
        const fullProfile = await authApi.fetchProfile();
        if (fullProfile) useAuthStore.setState({ profile: fullProfile });
      } catch {}

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

  // ── Saving screen ─────────────────────────────────────────────────

  if (saving) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('savingInfo')}</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────

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
                    color={scale === opt.value ? '#fff' : colors.primary}
                    style={{ marginBottom: 4 }}
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

      {/* Top bar: font size + language toggle */}
      <View style={styles.topBar}>
        <Pressable style={styles.fontSizeTopBtn} onPress={() => setShowFontModal(true)}>
          <MaterialCommunityIcons name="format-size" size={18} color={colors.primary} />
          <Text style={[styles.fontSizeTopLabel, { fontSize: scaledTypography.size.xs }]}>
            {getFontSizeLabel(scale)}
          </Text>
        </Pressable>
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

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{t('stepProgress', { step, total: TOTAL_STEPS })}</Text>
      </View>

      {/* Step content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {step === 1 && (
          <Step1
            styles={styles}
            fullName={fullName}
            setFullName={setFullName}
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
          />
        )}
        {step === 2 && (
          <Step2
            styles={styles}
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
            styles={styles}
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
            styles={styles}
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
            styles={styles}
            goals={goals}
            toggleGoal={toggleGoal}
          />
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={tc('back')}
          variant="ghost"
          onPress={handleBack}
          disabled={step === 1}
        />
        {step < TOTAL_STEPS ? (
          <Button
            label={tc('continue')}
            onPress={handleNext}
            disabled={!canGoNext()}
          />
        ) : (
          <Button
            label={t('complete')}
            onPress={handleSubmit}
            disabled={!canGoNext()}
          />
        )}
      </View>
    </View>
  );
}

// ─── Step 1 ─────────────────────────────────────────────────────────

interface Step1Props {
  styles: ReturnType<typeof createStyles>;
  fullName: string;
  setFullName: (v: string) => void;
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
}

function Step1({
  styles,
  fullName, setFullName,
  birthYear, setBirthYear, birthYearError,
  gender, setGender,
  height, setHeight, heightError,
  weight, setWeight, weightError,
  phone, setPhone, phoneError,
  bloodType, setBloodType,
}: Step1Props) {
  const { t } = useTranslation('onboarding');
  const GENDER_OPTIONS = [
    { value: 'Nam', labelKey: 'genderMale' },
    { value: 'Nữ', labelKey: 'genderFemale' },
    { value: 'Khác', labelKey: 'genderOther' },
  ];
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('step1Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('step1Subtitle')}</Text>

      <View style={styles.questionCard}>
        <SectionLabel label={t('fullName')} />
        <RNTextInput
          style={styles.textInput}
          placeholder={t('fullNamePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </View>

      <View style={styles.questionCard}>
        <SectionLabel label={t('birthYear')} />
        <RNTextInput
          style={styles.textInput}
          placeholder={t('birthYearPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={birthYear}
          onChangeText={setBirthYear}
          keyboardType="numeric"
          maxLength={4}
          returnKeyType="done"
        />
        {!!birthYearError && <Text style={styles.errorText}>{birthYearError}</Text>}
      </View>

      <View style={styles.questionCard}>
        <SectionLabel label={t('gender')} />
        <View style={styles.chipRow}>
          {GENDER_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.labelKey)}
              active={gender === opt.value}
              onPress={() => setGender(opt.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.questionCard}>
        <SectionLabel label={t('heightCm')} />
        <RNTextInput
          style={styles.textInput}
          placeholder={t('heightPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
          returnKeyType="done"
        />
        {!!heightError && <Text style={styles.errorText}>{heightError}</Text>}
      </View>

      <View style={styles.questionCard}>
        <SectionLabel label={t('weightKg')} />
        <RNTextInput
          style={styles.textInput}
          placeholder={t('weightPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          returnKeyType="done"
        />
        {!!weightError && <Text style={styles.errorText}>{weightError}</Text>}
      </View>

      <View style={styles.questionCard}>
        <SectionLabel label={t('phone')} />
        <RNTextInput
          style={styles.textInput}
          placeholder={t('phonePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={11}
          returnKeyType="done"
        />
        {!!phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
      </View>

      <View style={styles.questionCard}>
        <SectionLabel label={t('bloodType')} />
        <View style={styles.bloodTypeGrid}>
          {BLOOD_TYPE_OPTIONS.map(opt => (
            <View key={opt.value} style={styles.bloodTypeItem}>
              <Chip
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
          style={{
            alignSelf: 'center',
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
          }}
        >
          <Text
            style={{
              color: bloodType === 'Không biết' ? colors.primary : colors.textSecondary,
              fontWeight: bloodType === 'Không biết' ? '600' : '400',
              textDecorationLine: 'underline',
            }}
          >
            {t('bloodTypeUnknown')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Step 2 ─────────────────────────────────────────────────────────

interface Step2Props {
  styles: ReturnType<typeof createStyles>;
  diseases: string[];
  toggleDisease: (v: string) => void;
  otherDisease: string;
  setOtherDisease: (v: string) => void;
  medication: string;
  setMedication: (v: string) => void;
}

function Step2({
  styles,
  diseases, toggleDisease,
  otherDisease, setOtherDisease,
  medication, setMedication,
}: Step2Props) {
  const { t } = useTranslation('onboarding');
  const hasOther = diseases.includes('Khác');

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('step2Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('step2Subtitle')}</Text>

      <View style={styles.questionCard}>
        <View style={styles.diseaseGrid}>
          {DISEASE_GRID.map(opt => (
            <View key={opt.value} style={styles.diseaseGridItem}>
              <Chip
                label={t(opt.labelKey)}
                active={diseases.includes(opt.value)}
                onPress={() => toggleDisease(opt.value)}
                fullWidth
              />
            </View>
          ))}
        </View>

        <View style={styles.diseaseFooterRow}>
          {DISEASE_FOOTER.map(opt => (
            <View key={opt.value} style={styles.diseaseGridItem}>
              <Chip
                label={t(opt.labelKey)}
                active={diseases.includes(opt.value)}
                onPress={() => toggleDisease(opt.value)}
                fullWidth
              />
            </View>
          ))}
        </View>

        {hasOther && (
          <View style={styles.fieldGroup}>
            <SectionLabel label={t('otherDiseaseLabel')} />
            <RNTextInput
              style={styles.textInput}
              placeholder={t('otherDiseasePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={otherDisease}
              onChangeText={setOtherDisease}
              returnKeyType="done"
            />
          </View>
        )}
      </View>

      <View style={styles.questionCard}>
        <SectionLabel label={t('dailyMedication')} />
        <View style={styles.threeColRow}>
          {MEDICATION_OPTIONS.map(opt => (
            <View key={opt.value} style={styles.threeColItem}>
              <Chip
                label={t(opt.labelKey)}
                active={medication === opt.value}
                onPress={() => setMedication(opt.value)}
                fullWidth
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Step 3 ─────────────────────────────────────────────────────────

interface Step3Props {
  styles: ReturnType<typeof createStyles>;
  checkupFreq: string;
  setCheckupFreq: (v: string) => void;
  exerciseFreq: string;
  setExerciseFreq: (v: string) => void;
  sleepHours: string;
  setSleepHours: (v: string) => void;
}

function Step3({
  styles,
  checkupFreq, setCheckupFreq,
  exerciseFreq, setExerciseFreq,
  sleepHours, setSleepHours,
}: Step3Props) {
  const { t } = useTranslation('onboarding');
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('step3Title')}</Text>

      <View style={styles.questionCard}>
        <SectionLabel label={t('checkupFreq')} />
        <View style={styles.diseaseGrid}>
          {CHECKUP_OPTIONS.map(opt => (
            <View key={opt.value} style={styles.diseaseGridItem}>
              <Chip
                label={t(opt.labelKey)}
                active={checkupFreq === opt.value}
                onPress={() => setCheckupFreq(opt.value)}
                fullWidth
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.questionCard}>
        <SectionLabel label={t('exerciseFreq')} />
        <View style={styles.diseaseGrid}>
          {EXERCISE_OPTIONS.map(opt => (
            <View key={opt.value} style={styles.diseaseGridItem}>
              <Chip
                label={t(opt.labelKey)}
                active={exerciseFreq === opt.value}
                onPress={() => setExerciseFreq(opt.value)}
                fullWidth
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.questionCard}>
        <SectionLabel label={t('sleepHours')} />
        <View style={styles.threeColRow}>
          {SLEEP_OPTIONS.map(opt => (
            <View key={opt.value} style={styles.threeColItem}>
              <Chip
                label={t(opt.labelKey)}
                active={sleepHours === opt.value}
                onPress={() => setSleepHours(opt.value)}
                fullWidth
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Step 4 ─────────────────────────────────────────────────────────

interface Step4Props {
  styles: ReturnType<typeof createStyles>;
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
  styles,
  mealsPerDay, setMealsPerDay,
  postMealDrowsy, setPostMealDrowsy,
  dinnerTime, setDinnerTime,
  sweetIntake, setSweetIntake,
}: Step4Props) {
  const { t } = useTranslation('onboarding');
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('step4Title')}</Text>

      <View style={styles.questionCard}>
        <SectionLabel label={t('mealsPerDay')} />
        <View style={styles.threeColRow}>
          {MEALS_OPTIONS.map(opt => (
            <View key={opt.value} style={styles.threeColItem}>
              <Chip
                label={t(opt.labelKey)}
                active={mealsPerDay === opt.value}
                onPress={() => setMealsPerDay(opt.value)}
                fullWidth
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.questionCard}>
        <SectionLabel label={t('postMealDrowsy')} />
        <View style={styles.threeColRow}>
          {DROWSY_OPTIONS.map(opt => (
            <View key={opt.value} style={styles.threeColItem}>
              <Chip
                label={t(opt.labelKey)}
                active={postMealDrowsy === opt.value}
                onPress={() => setPostMealDrowsy(opt.value)}
                fullWidth
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.questionCard}>
        <SectionLabel label={t('dinnerTime')} />
        <View style={styles.threeColRow}>
          {DINNER_OPTIONS.map(opt => (
            <View key={opt.value} style={styles.threeColItem}>
              <Chip
                label={t(opt.labelKey)}
                active={dinnerTime === opt.value}
                onPress={() => setDinnerTime(opt.value)}
                fullWidth
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.questionCard}>
        <SectionLabel label={t('sweetIntake')} />
        <View style={styles.threeColRow}>
          {SWEET_OPTIONS.map(opt => (
            <View key={opt.value} style={styles.threeColItem}>
              <Chip
                label={t(opt.labelKey)}
                active={sweetIntake === opt.value}
                onPress={() => setSweetIntake(opt.value)}
                fullWidth
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Step 5 ─────────────────────────────────────────────────────────

interface Step5Props {
  styles: ReturnType<typeof createStyles>;
  goals: string[];
  toggleGoal: (v: string) => void;
}

function Step5({ styles, goals, toggleGoal }: Step5Props) {
  const { t } = useTranslation('onboarding');
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('step5Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('step5Subtitle')}</Text>

      <View style={styles.questionCard}>
        <View style={styles.chipColumn}>
          {GOAL_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.labelKey)}
              active={goals.includes(opt.value)}
              onPress={() => toggleGoal(opt.value)}
              fullWidth
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    languageToggle: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    langBtn: {
      paddingHorizontal: spacing.md,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    langBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    langBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    langBtnTextActive: {
      color: '#fff',
    },
    progressWrap: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
      gap: spacing.xs,
    },
    progressTrack: {
      height: 6,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: radius.full,
    },
    progressText: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    stepContainer: {
      gap: spacing.xl,
    },
    stepTitle: {
      fontSize: typography.size.xl,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: spacing.sm,
    },
    stepSubtitle: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      marginTop: -spacing.md,
    },
    fieldGroup: {
      gap: spacing.sm,
    },
    questionCard: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    bloodTypeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    bloodTypeItem: {
      flexBasis: '23%',
      flexGrow: 1,
    } as any,
    diseaseGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    diseaseGridItem: {
      flexBasis: '47%',
      flexGrow: 1,
      flexShrink: 1,
    } as any,
    diseaseFooterRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    threeColRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    threeColItem: {
      flex: 1,
    },
    chipColumn: {
      gap: spacing.sm,
    },
    textInput: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.size.md,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      minHeight: 48,
    },
    errorText: {
      fontSize: typography.size.sm,
      color: colors.danger,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
    },
    fontSizeTopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.md,
      height: 36,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    fontSizeTopLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    fontModalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
      padding: spacing.xl,
    },
    fontModalCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: spacing.xl,
      gap: spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    fontModalTitle: {
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    fontSizeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    fontSizeBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    fontSizeBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    fontSizeBtnText: {
      fontWeight: '600',
      color: colors.textPrimary,
    },
    fontSizeBtnTextActive: {
      color: '#fff',
    },
    fontSizePreview: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      gap: spacing.md,
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
  });
}
