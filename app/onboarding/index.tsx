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

type AnswerState = {
  age: string;
  gender: string;
  goal: string;
  body_shape: string;
  checkup: string;
  conditions: string[];
  chronic: string[];
  bone_joint: string;
  bone_joint_other: string;
  flexibility: string;
  stairs: string;
  exercise: string;
  walking: string;
  water: string;
  sleep: string;
};

type StepType = 'single' | 'multi' | 'single-other';

type Step = {
  key: keyof AnswerState;
  title: string;
  options: string[];
  type: StepType;
  noneOption?: string;
  otherLabel?: string;
};

export default function OnboardingScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tc } = useTranslation('common');
  const { language, setLanguage } = useLanguageStore();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const steps: Step[] = useMemo(() => [
    { key: 'age', title: t('m1Title'), options: ['30-39', '40-49', '50-59', '60+'], type: 'single' },
    { key: 'gender', title: t('m2Title'), options: [t('m2Male'), t('m2Female')], type: 'single' },
    {
      key: 'goal',
      title: t('m3Title'),
      options: [t('m3Opt1'), t('m3Opt2'), t('m3Opt3'), t('m3Opt4')],
      type: 'single'
    },
    { key: 'body_shape', title: t('m4Title'), options: [t('m4Opt1'), t('m4Opt2'), t('m4Opt3')], type: 'single' },
    {
      key: 'checkup',
      title: t('m5Title'),
      options: [t('m5Opt1'), t('m5Opt2'), t('m5Opt3'), t('m5Opt4')],
      type: 'single'
    },
    {
      key: 'conditions',
      title: t('m6Title'),
      options: [t('m6Opt1'), t('m6Opt2'), t('m6Opt3'), t('m6Opt4'), t('m6OptNone')],
      type: 'multi',
      noneOption: t('m6OptNone')
    },
    {
      key: 'chronic',
      title: t('m7Title'),
      options: [t('m7Opt1'), t('m7Opt2'), t('m7Opt3'), t('m7Opt4'), t('m7Opt5')],
      type: 'multi'
    },
    {
      key: 'bone_joint',
      title: t('m8Title'),
      options: [t('m8Opt1'), t('m8Opt2'), t('m8Opt3'), t('m8Opt4')],
      type: 'single-other',
      otherLabel: t('m8OtherLabel')
    },
    {
      key: 'flexibility',
      title: t('m9Title'),
      options: [t('m9Opt1'), t('m9Opt2'), t('m9Opt3'), t('m9Opt4')],
      type: 'single'
    },
    {
      key: 'stairs',
      title: t('m10Title'),
      options: [t('m10Opt1'), t('m10Opt2'), t('m10Opt3'), t('m10Opt4')],
      type: 'single'
    },
    {
      key: 'exercise',
      title: t('m11Title'),
      options: [t('m11Opt1'), t('m11Opt2'), t('m11Opt3'), t('m11Opt4')],
      type: 'single'
    },
    {
      key: 'walking',
      title: t('m12Title'),
      options: [t('m12Opt1'), t('m12Opt2'), t('m12Opt3'), t('m12Opt4')],
      type: 'single'
    },
    {
      key: 'water',
      title: t('m13Title'),
      options: [t('m13Opt1'), t('m13Opt2'), t('m13Opt3'), t('m13Opt4')],
      type: 'single'
    },
    {
      key: 'sleep',
      title: t('m14Title'),
      options: [t('m14Opt1'), t('m14Opt2'), t('m14Opt3'), t('m14Opt4')],
      type: 'single'
    }
  ], [t]);

  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<AnswerState>({
    age: '',
    gender: '',
    goal: '',
    body_shape: '',
    checkup: '',
    conditions: [],
    chronic: [],
    bone_joint: '',
    bone_joint_other: '',
    flexibility: '',
    stairs: '',
    exercise: '',
    walking: '',
    water: '',
    sleep: ''
  });

  const profile = useAuthStore((state) => state.profile);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const totalSteps = steps.length;
  const currentStep = steps[stepIndex];

  const progress = useMemo(() => (stepIndex + 1) / totalSteps, [stepIndex, totalSteps]);

  const isStepValid = useMemo(() => {
    const value = answers[currentStep.key];
    if (currentStep.type === 'multi') {
      return Array.isArray(value) && value.length > 0;
    }
    if (typeof value !== 'string' || value.trim().length === 0) return false;
    if (currentStep.type === 'single-other' && value === t('m8Opt4')) {
      return answers.bone_joint_other.trim().length > 0;
    }
    return true;
  }, [answers, currentStep]);

  const toggleMulti = (key: keyof AnswerState, value: string, noneOption?: string) => {
    setAnswers((prev) => {
      const current = (prev[key] as string[]) || [];
      let next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      if (noneOption) {
        if (value === noneOption) {
          next = [noneOption];
        } else {
          next = next.filter((item) => item !== noneOption);
        }
      }
      return { ...prev, [key]: next };
    });
  };

  const selectSingle = (key: keyof AnswerState, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'bone_joint' && value !== t('m8Opt4') ? { bone_joint_other: '' } : {})
    }));
  };

  const handleBack = () => {
    if (stepIndex === 0) return;
    setStepIndex((idx) => Math.max(0, idx - 1));
  };

  const handleSubmit = async () => {
    const userId = profile?.id;
    if (!userId) {
      Alert.alert(t('missingInfo'), t('pleaseLoginAgain'));
      router.replace('/login');
      return;
    }

    const boneJointValue =
      answers.bone_joint === t('m8Opt4')
        ? `${t('m8Opt4')}: ${answers.bone_joint_other.trim()}`
        : answers.bone_joint;

    const payload = {
      user_id: userId,
      profile: {
        age: answers.age,
        gender: answers.gender,
        goal: answers.goal,
        body_shape: answers.body_shape,
        checkup: answers.checkup,
        conditions: answers.conditions,
        chronic: answers.chronic,
        bone_joint: boneJointValue,
        flexibility: answers.flexibility,
        stairs: answers.stairs,
        exercise: answers.exercise,
        walking: answers.walking,
        water: answers.water,
        sleep: answers.sleep
      }
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
      setStepIndex((idx) => idx + 1);
      return;
    }

    await handleSubmit();
  };

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
            {currentStep.options.map((option) => {
              const value = answers[currentStep.key];
              const active = Array.isArray(value) ? value.includes(option) : value === option;
              return (
                <Pressable
                  key={option}
                  onPress={() =>
                    currentStep.type === 'multi'
                      ? toggleMulti(currentStep.key, option, currentStep.noneOption)
                      : selectSingle(currentStep.key, option)
                  }
                  android_ripple={{ color: colors.primary + '22' }}
                  style={({ pressed }) => [
                    styles.optionCard,
                    active && styles.optionCardActive,
                    pressed && styles.optionCardPressed
                  ]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>

          {currentStep.type === 'single-other' && answers.bone_joint === t('m8Opt4') ? (
            <TextInput
              label={currentStep.otherLabel}
              value={answers.bone_joint_other}
              onChangeText={(value) => setAnswers((prev) => ({ ...prev, bone_joint_other: value }))}
              placeholder={t('enterDetails')}
            />
          ) : null}
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
