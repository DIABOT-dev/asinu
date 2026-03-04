import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { TextInput } from '../../src/components/TextInput';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { apiClient } from '../../src/lib/apiClient';
import { useLanguageStore } from '../../src/stores/language.store';
import { colors, radius, spacing } from '../../src/styles';

// Canonical backend enum values — must match DB CHECK constraints
const GOAL_VALUES = ['Giảm đau', 'Tăng linh hoạt', 'Tăng sức mạnh', 'Cải thiện vận động'] as const;
const BODY_TYPE_VALUES = ['Gầy', 'Cân đối', 'Thừa cân'] as const;
const GENDER_VALUES = ['Nam', 'Nữ'] as const;

type StepOption = { label: string; value: string };
type StepType = 'single' | 'multi';

type Step = {
  key: keyof AnswerState;
  title: string;
  options: StepOption[];
  type: StepType;
  noneOption?: string; // value that clears all other selections
};

type AnswerState = {
  age: string;
  gender: string;
  goal: string;
  body_type: string;
  checkup_freq: string;
  medical_conditions: string[];
  chronic_symptoms: string[];
  joint_issues: string[];
  joint_other_text: string;
  flexibility: string;
  stairs_performance: string;
  exercise_freq: string;
  walking_habit: string;
  water_intake: string;
  sleep_duration: string;
};

export default function OnboardingScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tc } = useTranslation('common');
  const { language, setLanguage } = useLanguageStore();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const steps: Step[] = useMemo(() => [
    {
      key: 'age',
      title: t('m1Title'),
      options: ['30-39', '40-49', '50-59', '60+'].map(v => ({ label: v, value: v })),
      type: 'single',
    },
    {
      key: 'gender',
      title: t('m2Title'),
      options: [
        { label: t('m2Male'), value: GENDER_VALUES[0] },
        { label: t('m2Female'), value: GENDER_VALUES[1] },
      ],
      type: 'single',
    },
    {
      key: 'goal',
      title: t('m3Title'),
      options: [
        { label: t('m3Opt1'), value: GOAL_VALUES[0] },
        { label: t('m3Opt2'), value: GOAL_VALUES[1] },
        { label: t('m3Opt3'), value: GOAL_VALUES[2] },
        { label: t('m3Opt4'), value: GOAL_VALUES[3] },
      ],
      type: 'single',
    },
    {
      key: 'body_type',
      title: t('m4Title'),
      options: [
        { label: t('m4Opt1'), value: BODY_TYPE_VALUES[0] },
        { label: t('m4Opt2'), value: BODY_TYPE_VALUES[1] },
        { label: t('m4Opt3'), value: BODY_TYPE_VALUES[2] },
      ],
      type: 'single',
    },
    {
      key: 'checkup_freq',
      title: t('m5Title'),
      options: [t('m5Opt1'), t('m5Opt2'), t('m5Opt3'), t('m5Opt4')].map(v => ({ label: v, value: v })),
      type: 'single',
    },
    {
      key: 'medical_conditions',
      title: t('m6Title'),
      options: [t('m6Opt1'), t('m6Opt2'), t('m6Opt3'), t('m6Opt4'), t('m6OptNone')].map(v => ({ label: v, value: v })),
      type: 'multi',
      noneOption: t('m6OptNone'),
    },
    {
      key: 'chronic_symptoms',
      title: t('m7Title'),
      options: [t('m7Opt1'), t('m7Opt2'), t('m7Opt3'), t('m7Opt4'), t('m7Opt5'), t('m7OptNone')].map(v => ({ label: v, value: v })),
      type: 'multi',
      noneOption: t('m7OptNone'),
    },
    {
      key: 'joint_issues',
      title: t('m8Title'),
      options: [t('m8Opt1'), t('m8Opt2'), t('m8Opt3'), t('m8Opt4'), t('m8OptNone')].map(v => ({ label: v, value: v })),
      type: 'multi',
      noneOption: t('m8OptNone'),
    },
    {
      key: 'flexibility',
      title: t('m9Title'),
      options: [t('m9Opt1'), t('m9Opt2'), t('m9Opt3'), t('m9Opt4')].map(v => ({ label: v, value: v })),
      type: 'single',
    },
    {
      key: 'stairs_performance',
      title: t('m10Title'),
      options: [t('m10Opt1'), t('m10Opt2'), t('m10Opt3'), t('m10Opt4')].map(v => ({ label: v, value: v })),
      type: 'single',
    },
    {
      key: 'exercise_freq',
      title: t('m11Title'),
      options: [t('m11Opt1'), t('m11Opt2'), t('m11Opt3'), t('m11Opt4')].map(v => ({ label: v, value: v })),
      type: 'single',
    },
    {
      key: 'walking_habit',
      title: t('m12Title'),
      options: [t('m12Opt1'), t('m12Opt2'), t('m12Opt3'), t('m12Opt4')].map(v => ({ label: v, value: v })),
      type: 'single',
    },
    {
      key: 'water_intake',
      title: t('m13Title'),
      options: [t('m13Opt1'), t('m13Opt2'), t('m13Opt3'), t('m13Opt4')].map(v => ({ label: v, value: v })),
      type: 'single',
    },
    {
      key: 'sleep_duration',
      title: t('m14Title'),
      options: [t('m14Opt1'), t('m14Opt2'), t('m14Opt3'), t('m14Opt4')].map(v => ({ label: v, value: v })),
      type: 'single',
    },
  ], [t]);

  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<AnswerState>({
    age: '',
    gender: '',
    goal: '',
    body_type: '',
    checkup_freq: '',
    medical_conditions: [],
    chronic_symptoms: [],
    joint_issues: [],
    joint_other_text: '',
    flexibility: '',
    stairs_performance: '',
    exercise_freq: '',
    walking_habit: '',
    water_intake: '',
    sleep_duration: '',
  });

  const profile = useAuthStore((state) => state.profile);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const totalSteps = steps.length;
  const currentStep = steps[stepIndex];
  const progress = useMemo(() => (stepIndex + 1) / totalSteps, [stepIndex, totalSteps]);

  const isStepValid = useMemo(() => {
    const key = currentStep.key;
    const value = answers[key];
    if (currentStep.type === 'multi') {
      if (!Array.isArray(value) || value.length === 0) return false;
      if (key === 'joint_issues' && value.includes(t('m8Opt4')) && !answers.joint_other_text.trim()) {
        return false;
      }
      return true;
    }
    return typeof value === 'string' && value.trim().length > 0;
  }, [answers, currentStep, t]);

  const toggleMulti = (key: keyof AnswerState, optValue: string, noneOption?: string) => {
    const current = (answers[key] as string[]) || [];
    let next = current.includes(optValue)
      ? current.filter(item => item !== optValue)
      : [...current, optValue];

    if (noneOption) {
      if (optValue === noneOption) {
        next = [noneOption];
      } else {
        next = next.filter(item => item !== noneOption);
      }
    }

    const updates: Partial<AnswerState> = { [key]: next };
    if (key === 'joint_issues' && !next.includes(t('m8Opt4'))) {
      updates.joint_other_text = '';
    }
    setAnswers(prev => ({ ...prev, ...updates }));
  };

  const selectSingle = (key: keyof AnswerState, value: string) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const handleBack = () => {
    if (stepIndex === 0) return;
    setStepIndex(idx => Math.max(0, idx - 1));
  };

  const handleSubmit = async () => {
    const userId = profile?.id;
    if (!userId) {
      Alert.alert(t('missingInfo'), t('pleaseLoginAgain'));
      router.replace('/login');
      return;
    }

    const otherJointLabel = t('m8Opt4');
    const noneJointLabel = t('m8OptNone');
    const hasNoneJoint = answers.joint_issues.includes(noneJointLabel);

    const jointIssueKeyMap: Record<string, string> = {
      [t('m8Opt1')]: 'disc_herniation',
      [t('m8Opt2')]: 'knee_pain',
      [t('m8Opt3')]: 'back_pain',
      [otherJointLabel]: 'other',
    };

    const jointIssues = hasNoneJoint
      ? []
      : answers.joint_issues
          .filter(label => label !== noneJointLabel)
          .map(label => ({
            key: jointIssueKeyMap[label] ?? label.toLowerCase().replace(/\s+/g, '_'),
            label,
            ...(label === otherJointLabel ? { other_text: answers.joint_other_text.trim() } : {}),
          }));

    const payload = {
      user_id: userId,
      profile: {
        age: answers.age,
        gender: answers.gender,
        goal: answers.goal,
        body_type: answers.body_type,
        checkup_freq: answers.checkup_freq,
        medical_conditions: answers.medical_conditions.filter(c => c !== t('m6OptNone')),
        chronic_symptoms: answers.chronic_symptoms.filter(c => c !== t('m7OptNone')),
        joint_issues: jointIssues,
        flexibility: answers.flexibility,
        stairs_performance: answers.stairs_performance,
        exercise_freq: answers.exercise_freq,
        walking_habit: answers.walking_habit,
        water_intake: answers.water_intake,
        sleep_duration: answers.sleep_duration,
      },
    };

    setSubmitting(true);
    try {
      await apiClient('/api/mobile/onboarding', { method: 'POST', body: payload });
      await bootstrap();
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert(t('cannotSendData'), t('pleaseTryAgain'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (!isStepValid) {
      Alert.alert(t('missingInfo'), t('pleaseSelectAnswer'));
      return;
    }
    if (stepIndex < totalSteps - 1) {
      setStepIndex(idx => idx + 1);
      return;
    }
    await handleSubmit();
  };

  const showJointOtherInput =
    currentStep.key === 'joint_issues' && answers.joint_issues.includes(t('m8Opt4'));

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.languageToggle}>
          <Pressable
            onPress={() => setLanguage('vi')}
            style={[styles.langBtn, language === 'vi' && styles.langBtnActive]}
          >
            <Text style={[styles.langBtnText, language === 'vi' && styles.langBtnTextActive]}>VI</Text>
          </Pressable>
          <Pressable
            onPress={() => setLanguage('en')}
            style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
          >
            <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>EN</Text>
          </Pressable>
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>{t('step', { current: stepIndex + 1, total: totalSteps })}</Text>
        </View>

        <Text style={styles.header}>{t('quickSurvey')}</Text>
        <Text style={styles.subtitle}>{t('surveySubtitle')}</Text>

        <View style={styles.card}>
          <Text style={styles.question}>{currentStep.title}</Text>
          <View style={styles.options}>
            {currentStep.options.map(option => {
              const value = answers[currentStep.key];
              const active = Array.isArray(value)
                ? value.includes(option.value)
                : value === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() =>
                    currentStep.type === 'multi'
                      ? toggleMulti(currentStep.key, option.value, currentStep.noneOption)
                      : selectSingle(currentStep.key, option.value)
                  }
                  android_ripple={{ color: colors.primary + '22' }}
                  style={({ pressed }) => [
                    styles.optionCard,
                    active && styles.optionCardActive,
                    pressed && styles.optionCardPressed,
                  ]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {showJointOtherInput && (
            <TextInput
              label={t('m8OtherLabel')}
              value={answers.joint_other_text}
              onChangeText={value => setAnswers(prev => ({ ...prev, joint_other_text: value }))}
              placeholder={t('enterDetails')}
            />
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label={tc('back')} variant="ghost" onPress={handleBack} disabled={stepIndex === 0 || submitting} />
        <Button
          label={stepIndex === totalSteps - 1 ? tc('complete') : tc('continue')}
          onPress={handleNext}
          disabled={submitting}
        />
      </View>
    </View>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      gap: spacing.lg
    },
    progressWrap: {
      gap: spacing.sm
    },
    progressTrack: {
      height: 8,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary
    },
    progressText: {
      fontSize: typography.size.sm,
      color: colors.textSecondary
    },
    header: {
      fontSize: typography.size.xl,
      fontWeight: '800',
      color: colors.textPrimary
    },
    subtitle: {
      color: colors.textSecondary
    },
    card: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md
    },
    question: {
      fontSize: typography.size.lg,
      fontWeight: '700',
      color: colors.textPrimary
    },
    options: {
      gap: spacing.sm
    },
    optionCard: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    optionCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '14'
    },
    optionCardPressed: {
      opacity: 0.9
    },
    optionText: {
      color: colors.textPrimary,
      fontSize: typography.size.md,
      fontWeight: '600',
      fontFamily: 'System'
    },
    optionTextActive: {
      color: colors.primary
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      gap: spacing.md,
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    languageToggle: {
      flexDirection: 'row',
      alignSelf: 'flex-end',
      gap: spacing.xs,
      marginBottom: spacing.sm
    },
    langBtn: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    langBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    langBtnText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textSecondary
    },
    langBtnTextActive: {
      color: '#fff'
    }
  });
}
