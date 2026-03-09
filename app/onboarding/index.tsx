import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { apiClient } from '../../src/lib/apiClient';
import { useLanguageStore } from '../../src/stores/language.store';
import { colors, radius, spacing } from '../../src/styles';

// ─── Constants ──────────────────────────────────────────────────────

const DISEASE_OPTIONS = [
  'Tiểu đường',
  'Tiền tiểu đường',
  'Cao huyết áp',
  'Bệnh tim',
  'Mỡ máu',
  'Tiền đình',
  'Đau dạ dày',
  'Gout',
  'Không có',
];

const MEDICATION_OPTIONS = ['Có', 'Không', 'Chỉ TPCN'];
const CHECKUP_OPTIONS = ['Mỗi ngày', 'Vài lần/tuần', 'Thỉnh thoảng', 'Gần như không'];
const EXERCISE_OPTIONS = ['Ít vận động', '30 phút', '1 giờ', 'Trên 1 giờ'];
const SLEEP_OPTIONS = ['Đủ 7-8 giờ', '6-7 giờ', 'Ít hơn 5 giờ'];
const MEALS_OPTIONS = ['2 bữa', '3 bữa', '4 bữa trở lên'];
const DROWSY_OPTIONS = ['Không', 'Thỉnh thoảng', 'Thường xuyên'];
const DINNER_OPTIONS = ['Trước 18 giờ', '18-20 giờ', 'Sau 20 giờ'];
const SWEET_OPTIONS = ['Hiếm khi', 'Thỉnh thoảng', 'Thường xuyên'];
const GOAL_OPTIONS = [
  'Hiểu rõ tình trạng sức khoẻ',
  'Nhắc nhở đo chỉ số mỗi ngày',
  'Theo dõi bệnh mãn tính',
  'Lời khuyên dinh dưỡng & lối sống',
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
  const { t: tc } = useTranslation('common');
  const { language, setLanguage } = useLanguageStore();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bootstrap = useAuthStore((s) => s.bootstrap);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

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
      ? `Năm sinh phải từ 1920 đến ${CURRENT_YEAR - 10}`
      : '';

  const heightNum = parseFloat(height);
  const heightValid = height.length > 0 && !isNaN(heightNum) && heightNum >= 50 && heightNum <= 250;
  const heightError = height.length > 0 && !heightValid ? 'Chiều cao phải từ 50–250 cm' : '';

  const weightNum = parseFloat(weight);
  const weightValid = weight.length > 0 && !isNaN(weightNum) && weightNum >= 10 && weightNum <= 300;
  const weightError = weight.length > 0 && !weightValid ? 'Cân nặng phải từ 10–300 kg' : '';

  const phoneValid = /^0\d{9}$/.test(phone.trim());
  const phoneError = phone.length > 0 && !phoneValid ? 'Số điện thoại phải đúng định dạng 0xxxxxxxxx' : '';

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
      if (value === 'Không có') return ['Không có'];
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
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu thông tin. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  // ── Saving screen ─────────────────────────────────────────────────

  if (saving) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Đang lưu thông tin...</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top bar: language toggle */}
      <View style={styles.topBar}>
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
        <Text style={styles.progressText}>Bước {step}/{TOTAL_STEPS}</Text>
      </View>

      {/* Step content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <Step1
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
            label="Hoàn thành"
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
  styles,
  birthYear, setBirthYear, birthYearError,
  gender, setGender,
  height, setHeight, heightError,
  weight, setWeight, weightError,
  phone, setPhone, phoneError,
}: Step1Props) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Thông tin cơ bản</Text>
      <Text style={styles.stepSubtitle}>Giúp Asinu hiểu bạn tốt hơn</Text>

      <View style={styles.fieldGroup}>
        <SectionLabel label="Năm sinh" />
        <RNTextInput
          style={styles.textInput}
          placeholder="VD: 1990"
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
        <SectionLabel label="Giới tính" />
        <View style={styles.chipRow}>
          {['Nam', 'Nữ', 'Khác'].map(opt => (
            <Chip
              key={opt}
              label={opt}
              active={gender === opt}
              onPress={() => setGender(opt)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label="Chiều cao (cm)" />
        <RNTextInput
          style={styles.textInput}
          placeholder="VD: 165"
          placeholderTextColor={colors.textSecondary}
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
          returnKeyType="done"
        />
        {!!heightError && <Text style={styles.errorText}>{heightError}</Text>}
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label="Cân nặng (kg)" />
        <RNTextInput
          style={styles.textInput}
          placeholder="VD: 60"
          placeholderTextColor={colors.textSecondary}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          returnKeyType="done"
        />
        {!!weightError && <Text style={styles.errorText}>{weightError}</Text>}
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label="Số điện thoại" />
        <RNTextInput
          style={styles.textInput}
          placeholder="VD: 0912345678"
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
  const hasDisease = diseases.some(d => d !== 'Không có');

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Bạn đang mắc bệnh nào?</Text>
      <Text style={styles.stepSubtitle}>Chọn tất cả bệnh bạn đang có (nếu có)</Text>

      <View style={styles.fieldGroup}>
        <View style={styles.chipWrap}>
          {DISEASE_OPTIONS.map(opt => (
            <Chip
              key={opt}
              label={opt}
              active={diseases.includes(opt)}
              onPress={() => toggleDisease(opt)}
            />
          ))}
        </View>
      </View>

      {hasDisease && (
        <View style={styles.fieldGroup}>
          <SectionLabel label="Bệnh khác (nếu có)" />
          <RNTextInput
            style={styles.textInput}
            placeholder="VD: Viêm khớp, Suy thận,..."
            placeholderTextColor={colors.textSecondary}
            value={otherDisease}
            onChangeText={setOtherDisease}
            returnKeyType="done"
          />
        </View>
      )}

      <View style={styles.fieldGroup}>
        <SectionLabel label="Bạn có dùng thuốc hằng ngày không?" />
        <View style={styles.chipRow}>
          {MEDICATION_OPTIONS.map(opt => (
            <Chip
              key={opt}
              label={opt}
              active={medication === opt}
              onPress={() => setMedication(opt)}
            />
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
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Thói quen của bạn</Text>

      <View style={styles.fieldGroup}>
        <SectionLabel label="Bạn thường đo sức khoẻ bao lâu một lần?" />
        <View style={styles.chipWrap}>
          {CHECKUP_OPTIONS.map(opt => (
            <Chip
              key={opt}
              label={opt}
              active={checkupFreq === opt}
              onPress={() => setCheckupFreq(opt)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label="Bạn thường vận động bao nhiêu mỗi ngày?" />
        <View style={styles.chipWrap}>
          {EXERCISE_OPTIONS.map(opt => (
            <Chip
              key={opt}
              label={opt}
              active={exerciseFreq === opt}
              onPress={() => setExerciseFreq(opt)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label="Mỗi ngày bạn thường ngủ được bao nhiêu giờ?" />
        <View style={styles.chipWrap}>
          {SLEEP_OPTIONS.map(opt => (
            <Chip
              key={opt}
              label={opt}
              active={sleepHours === opt}
              onPress={() => setSleepHours(opt)}
            />
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
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Thói quen ăn uống</Text>

      <View style={styles.fieldGroup}>
        <SectionLabel label="Bạn thường ăn bao nhiêu bữa một ngày?" />
        <View style={styles.chipWrap}>
          {MEALS_OPTIONS.map(opt => (
            <Chip
              key={opt}
              label={opt}
              active={mealsPerDay === opt}
              onPress={() => setMealsPerDay(opt)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label="Sau khi ăn cơm bạn có thấy buồn ngủ không?" />
        <View style={styles.chipWrap}>
          {DROWSY_OPTIONS.map(opt => (
            <Chip
              key={opt}
              label={opt}
              active={postMealDrowsy === opt}
              onPress={() => setPostMealDrowsy(opt)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label="Giờ ăn tối của bạn?" />
        <View style={styles.chipWrap}>
          {DINNER_OPTIONS.map(opt => (
            <Chip
              key={opt}
              label={opt}
              active={dinnerTime === opt}
              onPress={() => setDinnerTime(opt)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <SectionLabel label="Bạn ăn đồ ngọt, nước ngọt ở mức nào?" />
        <View style={styles.chipWrap}>
          {SWEET_OPTIONS.map(opt => (
            <Chip
              key={opt}
              label={opt}
              active={sweetIntake === opt}
              onPress={() => setSweetIntake(opt)}
            />
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
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Bạn muốn Asinu giúp gì nhất?</Text>
      <Text style={styles.stepSubtitle}>Có thể chọn nhiều</Text>

      <View style={styles.fieldGroup}>
        <View style={styles.chipColumn}>
          {GOAL_OPTIONS.map(opt => (
            <Chip
              key={opt}
              label={opt}
              active={goals.includes(opt)}
              onPress={() => toggleGoal(opt)}
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
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
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
  });
}
