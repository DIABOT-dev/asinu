import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useModal } from '../../src/hooks/useModal';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { ApiError, apiClient } from '../../src/lib/apiClient';
import { FontSizeScale, useFontSizeStore } from '../../src/stores/font-size.store';
import { useLanguageStore } from '../../src/stores/language.store';
import { colors, radius, spacing } from '../../src/styles';

// ─── Option definitions (value = backend value, key = i18n key) ──────────────

const DISEASE_OPTIONS: Array<{ value: string; key: string }> = [
  { value: 'Tiểu đường',     key: 'diseaseDiabetes' },
  { value: 'Tiền tiểu đường', key: 'diseasePreDiabetes' },
  { value: 'Cao huyết áp',   key: 'diseaseHypertension' },
  { value: 'Bệnh tim',       key: 'diseaseHeartDisease' },
  { value: 'Mỡ máu',         key: 'diseaseDyslipidemia' },
  { value: 'Tiền đình',      key: 'diseaseVertigo' },
  { value: 'Đau dạ dày',     key: 'diseaseGastritis' },
  { value: 'Gout',           key: 'diseaseGout' },
  { value: 'Không có',       key: 'diseaseNone' },
];

const MEDICATION_OPTIONS: Array<{ value: string; key: string }> = [
  { value: 'Có',       key: 'medYes' },
  { value: 'Không',    key: 'medNo' },
  { value: 'Chỉ TPCN', key: 'medSupplementOnly' },
];

const CHECKUP_OPTIONS: Array<{ value: string; key: string }> = [
  { value: 'Mỗi ngày',      key: 'checkupDaily' },
  { value: 'Vài lần/tuần',  key: 'checkupSeveralPerWeek' },
  { value: 'Thỉnh thoảng',  key: 'checkupOccasionally' },
  { value: 'Gần như không',  key: 'checkupRarely' },
];

const EXERCISE_OPTIONS: Array<{ value: string; key: string }> = [
  { value: 'Ít vận động',  key: 'exerciseSedentary' },
  { value: '30 phút',      key: 'exercise30min' },
  { value: '1 giờ',        key: 'exercise1hour' },
  { value: 'Trên 1 giờ',   key: 'exerciseOver1hour' },
];

const SLEEP_OPTIONS: Array<{ value: string; key: string }> = [
  { value: 'Đủ 7-8 giờ',    key: 'sleep78hours' },
  { value: '6-7 giờ',       key: 'sleep67hours' },
  { value: 'Ít hơn 5 giờ',  key: 'sleepUnder5hours' },
];

const MEALS_OPTIONS: Array<{ value: string; key: string }> = [
  { value: '2 bữa',         key: 'meals2' },
  { value: '3 bữa',         key: 'meals3' },
  { value: '4 bữa trở lên', key: 'meals4plus' },
];

const DROWSY_OPTIONS: Array<{ value: string; key: string }> = [
  { value: 'Không',       key: 'drowsyNo' },
  { value: 'Thỉnh thoảng', key: 'drowsySometimes' },
  { value: 'Thường xuyên', key: 'drowsyOften' },
];

const DINNER_OPTIONS: Array<{ value: string; key: string }> = [
  { value: 'Trước 18 giờ', key: 'dinnerBefore18' },
  { value: '18-20 giờ',    key: 'dinner1820' },
  { value: 'Sau 20 giờ',   key: 'dinnerAfter20' },
];

const SWEET_OPTIONS: Array<{ value: string; key: string }> = [
  { value: 'Hiếm khi',     key: 'sweetRarely' },
  { value: 'Thỉnh thoảng', key: 'sweetSometimes' },
  { value: 'Thường xuyên', key: 'sweetOften' },
];

const GOAL_OPTIONS: Array<{ value: string; key: string }> = [
  { value: 'Hiểu rõ tình trạng sức khoẻ',     key: 'goalUnderstandHealth' },
  { value: 'Nhắc nhở đo chỉ số mỗi ngày',     key: 'goalDailyReminder' },
  { value: 'Theo dõi bệnh mãn tính',           key: 'goalTrackChronic' },
  { value: 'Lời khuyên dinh dưỡng & lối sống', key: 'goalNutritionAdvice' },
];

const GENDER_OPTIONS: Array<{ value: string; key: string }> = [
  { value: 'Nam',   key: 'genderMale' },
  { value: 'Nữ',   key: 'genderFemale' },
  { value: 'Khác', key: 'genderOther' },
];

const FONT_SIZE_OPTIONS: Array<{ value: FontSizeScale; size: number; label: string }> = [
  { value: 'small',  size: 12, label: 'A' },
  { value: 'normal', size: 15, label: 'A' },
  { value: 'large',  size: 18, label: 'A' },
  { value: 'xlarge', size: 21, label: 'A' },
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
      <Text style={[chipStyles.chipText, active && chipStyles.chipTextActive]}>
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
    borderWidth: 1,
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
  },
  chipText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

// ─── Section label ───────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>
      {label}
    </Text>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tc } = useTranslation('common');
  const { language, setLanguage } = useLanguageStore();
  const { scale, setScale } = useFontSizeStore();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const { showInfo, modal } = useModal();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bootstrap = useAuthStore((s) => s.bootstrap);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [phoneDuplicate, setPhoneDuplicate] = useState(false);

  // Prevent back navigation — onboarding is mandatory
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // ── Step 1 state ─────────────────────────────────────────────────
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [phone, setPhone] = useState('');

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
      ? t('errBirthYear', { maxYear: CURRENT_YEAR - 10 })
      : '';

  const heightNum = parseFloat(height);
  const heightValid = height.length > 0 && !isNaN(heightNum) && heightNum >= 50 && heightNum <= 250;
  const heightError = height.length > 0 && !heightValid ? t('errHeight') : '';

  const weightNum = parseFloat(weight);
  const weightValid = weight.length > 0 && !isNaN(weightNum) && weightNum >= 10 && weightNum <= 300;
  const weightError = weight.length > 0 && !weightValid ? t('errWeight') : '';

  const phoneValid = /^0\d{9}$/.test(phone.trim());
  const phoneError = phone.length > 0 && !phoneValid ? t('errPhone') : '';

  const step1Valid = birthYearValid && gender !== '' && heightValid && weightValid && phoneValid;
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
      if (prev.includes(value)) return prev.filter(v => v !== value);
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
          birth_year: parseInt(birthYear, 10),
          gender,
          height_cm: parseFloat(height),
          weight_kg: parseFloat(weight),
          phone: phone.trim(),
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
      router.replace('/(tabs)/home');
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409) {
        setStep(1);
        setPhoneDuplicate(true);
      } else {
        showInfo(t('errorTitle'), t('cannotSave'));
      }
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
      {modal}
      {/* Phone duplicate modal */}
      <Modal visible={phoneDuplicate} transparent animationType="fade" onRequestClose={() => setPhoneDuplicate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('errPhoneDuplicateTitle')}</Text>
            <Text style={styles.modalBody}>{t('errPhoneDuplicate')}</Text>
            <Button
              label={tc('ok')}
              onPress={() => setPhoneDuplicate(false)}
              style={styles.modalBtn}
            />
          </View>
        </View>
      </Modal>
      {/* Top bar: font size + language toggle */}
      <View style={styles.topBar}>
        {/* Font size selector */}
        <View style={styles.fontSizeToggle}>
          {FONT_SIZE_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              onPress={() => setScale(opt.value)}
              style={[styles.fontSizeBtn, scale === opt.value && styles.fontSizeBtnActive]}
            >
              <Text style={[styles.fontSizeBtnText, { fontSize: opt.size }, scale === opt.value && styles.fontSizeBtnTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Language toggle */}
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
        <Text style={styles.progressText}>{t('step', { step, total: TOTAL_STEPS })}</Text>
      </View>

      {/* Step content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <Step1
            t={t}
            styles={styles}
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
          />
        )}
        {step === 2 && (
          <Step2
            t={t}
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
            t={t}
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
            t={t}
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
            t={t}
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
            label={t('finish')}
            onPress={handleSubmit}
            disabled={!canGoNext()}
          />
        )}
      </View>
    </View>
  );
}

// ─── Step 1 ─────────────────────────────────────────────────────────

type TFn = (key: string, opts?: Record<string, unknown>) => string;

interface Step1Props {
  t: TFn;
  styles: ReturnType<typeof createStyles>;
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
}

function Step1({
  t, styles,
  birthYear, setBirthYear, birthYearError,
  gender, setGender,
  height, setHeight, heightError,
  weight, setWeight, weightError,
  phone, setPhone, phoneError,
}: Step1Props) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('step1Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('step1Subtitle')}</Text>

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldBirthYear')} />
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

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldGender')} />
        <View style={styles.chipRow}>
          {GENDER_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.key)}
              active={gender === opt.value}
              onPress={() => setGender(opt.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldHeight')} />
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

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldWeight')} />
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

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldPhone')} />
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
    </View>
  );
}

// ─── Step 2 ─────────────────────────────────────────────────────────

interface Step2Props {
  t: TFn;
  styles: ReturnType<typeof createStyles>;
  diseases: string[];
  toggleDisease: (v: string) => void;
  otherDisease: string;
  setOtherDisease: (v: string) => void;
  medication: string;
  setMedication: (v: string) => void;
}

function Step2({
  t, styles,
  diseases, toggleDisease,
  otherDisease, setOtherDisease,
  medication, setMedication,
}: Step2Props) {
  const noneSelected = diseases.includes('Không có');

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('step2Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('step2Subtitle')}</Text>

      <View style={styles.fieldGroup}>
        <View style={styles.chipWrap}>
          {DISEASE_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.key)}
              active={diseases.includes(opt.value)}
              onPress={() => toggleDisease(opt.value)}
            />
          ))}
        </View>
      </View>

      {/* Always show — lets users type specific diseases not in the list */}
      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldOtherDisease')} />
        <RNTextInput
          style={[styles.textInput, noneSelected && styles.textInputDisabled]}
          placeholder={t('otherDiseasePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={otherDisease}
          onChangeText={setOtherDisease}
          editable={!noneSelected}
          returnKeyType="done"
          multiline={false}
        />
        <Text style={styles.fieldHint}>{t('otherDiseaseHint')}</Text>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldMedication')} />
        <View style={styles.chipRow}>
          {MEDICATION_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.key)}
              active={medication === opt.value}
              onPress={() => setMedication(opt.value)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Step 3 ─────────────────────────────────────────────────────────

interface Step3Props {
  t: TFn;
  styles: ReturnType<typeof createStyles>;
  checkupFreq: string;
  setCheckupFreq: (v: string) => void;
  exerciseFreq: string;
  setExerciseFreq: (v: string) => void;
  sleepHours: string;
  setSleepHours: (v: string) => void;
}

function Step3({
  t, styles,
  checkupFreq, setCheckupFreq,
  exerciseFreq, setExerciseFreq,
  sleepHours, setSleepHours,
}: Step3Props) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('step3Title')}</Text>

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldCheckupFreq')} />
        <View style={styles.chipWrap}>
          {CHECKUP_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.key)}
              active={checkupFreq === opt.value}
              onPress={() => setCheckupFreq(opt.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldExerciseFreq')} />
        <View style={styles.chipWrap}>
          {EXERCISE_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.key)}
              active={exerciseFreq === opt.value}
              onPress={() => setExerciseFreq(opt.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldSleepHours')} />
        <View style={styles.chipWrap}>
          {SLEEP_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.key)}
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
  t: TFn;
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
  t, styles,
  mealsPerDay, setMealsPerDay,
  postMealDrowsy, setPostMealDrowsy,
  dinnerTime, setDinnerTime,
  sweetIntake, setSweetIntake,
}: Step4Props) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('step4Title')}</Text>

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldMealsPerDay')} />
        <View style={styles.chipWrap}>
          {MEALS_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.key)}
              active={mealsPerDay === opt.value}
              onPress={() => setMealsPerDay(opt.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldPostMealDrowsy')} />
        <View style={styles.chipWrap}>
          {DROWSY_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.key)}
              active={postMealDrowsy === opt.value}
              onPress={() => setPostMealDrowsy(opt.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldDinnerTime')} />
        <View style={styles.chipWrap}>
          {DINNER_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.key)}
              active={dinnerTime === opt.value}
              onPress={() => setDinnerTime(opt.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label={t('fieldSweetIntake')} />
        <View style={styles.chipWrap}>
          {SWEET_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.key)}
              active={sweetIntake === opt.value}
              onPress={() => setSweetIntake(opt.value)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Step 5 ─────────────────────────────────────────────────────────

interface Step5Props {
  t: TFn;
  styles: ReturnType<typeof createStyles>;
  goals: string[];
  toggleGoal: (v: string) => void;
}

function Step5({ t, styles, goals, toggleGoal }: Step5Props) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('step5Title')}</Text>
      <Text style={styles.stepSubtitle}>{t('step5Subtitle')}</Text>

      <View style={styles.fieldGroup}>
        <View style={styles.chipColumn}>
          {GOAL_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={t(opt.key)}
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
    fontSizeToggle: {
      flexDirection: 'row',
      gap: 2,
    },
    fontSizeBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fontSizeBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    fontSizeBtnText: {
      fontWeight: '700',
      color: colors.textSecondary,
      lineHeight: 22,
    },
    fontSizeBtnTextActive: {
      color: '#fff',
    },
    languageToggle: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    langBtn: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    langBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    langBtnText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
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
      borderWidth: 1,
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
    chipColumn: {
      gap: spacing.sm,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.size.md,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      minHeight: 48,
    },
    textInputDisabled: {
      backgroundColor: colors.surfaceMuted,
      color: colors.textSecondary,
      opacity: 0.6,
    },
    fieldHint: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    errorText: {
      fontSize: typography.size.sm,
      color: colors.danger,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    modalCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.md,
    },
    modalTitle: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    modalBody: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    modalBtn: {
      alignSelf: 'stretch',
      marginTop: spacing.xs,
    },
  });
}
