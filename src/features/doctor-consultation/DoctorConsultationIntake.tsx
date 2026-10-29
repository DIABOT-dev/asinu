import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import { ScaledTextInput as TextInput } from '../../components/ScaledTextInput';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useScaledFontSize } from '../../hooks/useScaledTypography';
import { radius, spacing } from '../../styles/theme';

type Onset = 'today' | 'two_to_seven_days' | 'over_one_week' | 'ongoing';
type Progression = 'improving' | 'stable' | 'worsening';
type Severity = 'mild' | 'moderate' | 'severe';
type Choice<T extends string> = {
  value: T;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type IntakeProps = {
  symptomOnset: Onset | '';
  progression: Progression | '';
  severity: Severity | '';
  summary: string;
  onSymptomOnsetChange: (value: Onset) => void;
  onProgressionChange: (value: Progression) => void;
  onSeverityChange: (value: Severity) => void;
  onSummaryChange: (value: string) => void;
  onContinue: () => void;
};

function ChoiceGroup<T extends string>({
  number,
  title,
  choices,
  value,
  onChange,
  layout = 'rows',
}: {
  number: string;
  title: string;
  choices: Choice<T>[];
  value: T | '';
  onChange: (value: T) => void;
  layout?: 'rows' | 'grid' | 'scale';
}) {
  const { colors } = useThemeColors();
  const numberWidth = useScaledFontSize(13) * 2;
  return (
    <View style={styles.questionGroup}>
      <View style={styles.questionHeading}>
        <Text
          accessible={false}
          style={[
            styles.questionNumber,
            { color: colors.primaryText, minWidth: numberWidth },
          ]}
        >
          {number}
        </Text>
        <Text
          accessibilityRole="header"
          style={[styles.questionTitle, { color: colors.textPrimary }]}
        >
          {title}
        </Text>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={title}
        style={[styles.choices, layout !== 'rows' && styles.choicesHorizontal]}
      >
        {choices.map((choice) => {
          const selected = choice.value === value;
          const tile = layout !== 'rows';
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityLabel={choice.label}
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(choice.value)}
              style={({ pressed }) => [
                styles.choice,
                tile && styles.choiceTile,
                layout === 'grid' && styles.choiceGrid,
                layout === 'scale' && styles.choiceScale,
                {
                  backgroundColor: selected
                    ? colors.primaryLight
                    : colors.surface,
                  borderColor: selected ? colors.primaryText : colors.border,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <View style={[styles.choiceIcon, tile && styles.choiceTileIcon]}>
                <Ionicons
                  accessible={false}
                  name={choice.icon}
                  size={22}
                  color={selected ? colors.primaryText : colors.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.choiceLabel,
                  tile && styles.choiceTileLabel,
                  {
                    color: selected ? colors.primaryText : colors.textPrimary,
                    fontWeight: selected ? '700' : '500',
                  },
                ]}
              >
                {choice.label}
              </Text>
              <View
                style={[
                  styles.radio,
                  tile && styles.tileRadio,
                  {
                    borderColor: selected
                      ? colors.primaryText
                      : colors.textSecondary,
                    backgroundColor: selected
                      ? colors.primaryText
                      : 'transparent',
                  },
                ]}
              >
                {selected && (
                  <Ionicons
                    accessible={false}
                    name="checkmark"
                    size={13}
                    color={colors.surface}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function DoctorConsultationIntake(props: IntakeProps) {
  const { t } = useTranslation('home');
  const { colors, isDark } = useThemeColors();
  const { width } = useWindowDimensions();
  const largeText = useScaledFontSize(16) > 20;
  const compact = width < 360 || largeText;
  const severityRows = width < 375 || largeText;
  const onsets: Choice<Onset>[] = [
    {
      value: 'today',
      label: t('doctorConsultationOnset_today'),
      icon: 'today-outline',
    },
    {
      value: 'two_to_seven_days',
      label: t('doctorConsultationOnset_two_to_seven_days'),
      icon: 'calendar-outline',
    },
    {
      value: 'over_one_week',
      label: t('doctorConsultationOnset_over_one_week'),
      icon: 'calendar-number-outline',
    },
    {
      value: 'ongoing',
      label: t('doctorConsultationOnset_ongoing'),
      icon: 'time-outline',
    },
  ];
  const progressions: Choice<Progression>[] = [
    {
      value: 'improving',
      label: t('doctorConsultationProgression_improving'),
      icon: 'trending-down-outline',
    },
    {
      value: 'stable',
      label: t('doctorConsultationProgression_stable'),
      icon: 'remove-outline',
    },
    {
      value: 'worsening',
      label: t('doctorConsultationProgression_worsening'),
      icon: 'trending-up-outline',
    },
  ];
  const severities: Choice<Severity>[] = [
    {
      value: 'mild',
      label: t('doctorConsultationSeverity_mild'),
      icon: 'ellipse-outline',
    },
    {
      value: 'moderate',
      label: t('doctorConsultationSeverity_moderate'),
      icon: 'remove-circle-outline',
    },
    {
      value: 'severe',
      label: t('doctorConsultationSeverity_severe'),
      icon: 'ellipse',
    },
  ];

  return (
    <View style={styles.layout}>
      <View style={styles.introduction}>
        <View style={styles.introCopy}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.textPrimary }]}
          >
            {t('doctorConsultationIntakeTitle')}
          </Text>
        </View>
        <View
          accessible={false}
          style={[styles.healthMark, { backgroundColor: colors.primaryLight }]}
        >
          <Ionicons name="pulse-outline" size={30} color={colors.primaryText} />
        </View>
      </View>
      <Text style={[styles.introHint, { color: colors.textSecondary }]}>
        {t('doctorConsultationScreeningHint')}
      </Text>

      <View style={styles.screening}>
        <Text style={[styles.answerHint, { color: colors.textSecondary }]}>
          {t('doctorConsultationAnswerHint')}
        </Text>
        <ChoiceGroup
          number="01"
          title={t('doctorConsultationOnsetLabel')}
          choices={onsets}
          value={props.symptomOnset}
          onChange={props.onSymptomOnsetChange}
          layout={compact ? 'rows' : 'grid'}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <ChoiceGroup
          number="02"
          title={t('doctorConsultationProgressionLabel')}
          choices={progressions}
          value={props.progression}
          onChange={props.onProgressionChange}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <ChoiceGroup
          number="03"
          title={t('doctorConsultationSeverityLabel')}
          choices={severities}
          value={props.severity}
          onChange={props.onSeverityChange}
          layout={severityRows ? 'rows' : 'scale'}
        />
      </View>

      <View style={styles.summary}>
        <Text
          accessibilityRole="header"
          style={[styles.questionTitle, { color: colors.textPrimary }]}
        >
          {t('doctorConsultationSummaryLabel')}
        </Text>
        <Text style={[styles.summaryHint, { color: colors.textSecondary }]}>
          {t('doctorConsultationSummaryHint')}
        </Text>
        <TextInput
          accessibilityLabel={t('doctorConsultationSummaryLabel')}
          multiline
          textAlignVertical="top"
          value={props.summary}
          onChangeText={props.onSummaryChange}
          placeholder={t('doctorConsultationSummaryPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.summaryInput,
            {
              backgroundColor: colors.surface,
              color: colors.textPrimary,
              borderColor: colors.border,
            },
          ]}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common:continue')}
        onPress={props.onContinue}
        style={({ pressed }) => [
          styles.continueButton,
          {
            backgroundColor: isDark ? colors.primary : colors.primaryText,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.continueLabel,
            { color: isDark ? colors.background : colors.surface },
          ]}
        >
          {t('common:continue')}
        </Text>
        <Ionicons
          accessible={false}
          name="arrow-forward"
          size={20}
          color={isDark ? colors.background : colors.surface}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { gap: spacing.xl },
  introduction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  introCopy: { flex: 1, minWidth: 0, gap: spacing.sm },
  title: {
    fontSize: 27,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  healthMark: {
    width: 60,
    height: 60,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introHint: { fontSize: 15, lineHeight: 23, marginTop: -spacing.sm },
  screening: { gap: spacing.xl },
  answerHint: { fontSize: 13, lineHeight: 20 },
  questionGroup: { gap: spacing.md },
  questionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  questionNumber: {
    fontSize: 13,
    lineHeight: 23,
    fontWeight: '700',
    minWidth: 22,
    fontVariant: ['tabular-nums'],
  },
  questionTitle: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '600',
  },
  choices: { gap: spacing.sm },
  choicesHorizontal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 64,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  choiceTile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: spacing.md,
    minHeight: 100,
  },
  choiceGrid: { flexBasis: '45%', flexGrow: 1, minWidth: 0 },
  choiceScale: { flexBasis: '27%', flexGrow: 1, minWidth: 0 },
  choiceIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  choiceTileIcon: { marginBottom: spacing.xs },
  choiceLabel: { flex: 1, fontSize: 16, lineHeight: 24 },
  choiceTileLabel: { flex: 0, alignSelf: 'stretch' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileRadio: { position: 'absolute', top: spacing.lg, right: spacing.lg },
  divider: { height: 1 },
  summary: { gap: spacing.sm, paddingTop: spacing.xs },
  summaryHint: { fontSize: 14, lineHeight: 22 },
  summaryInput: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 140,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.xs,
  },
  continueButton: {
    minHeight: 56,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  continueLabel: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
});
