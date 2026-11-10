import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import { ScaledTextInput as TextInput } from '../../components/ScaledTextInput';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useScaledFontSize } from '../../hooks/useScaledTypography';
import { radius, spacing } from '../../styles/theme';

import type { ConsultationScreening, ScreeningAnswer, ScreeningQuestion } from './useConsultationScreening';

type Choice<T extends string> = {
  value: T;
  label: string;
  icon: keyof typeof Ionicons.glyphMap | 1 | 2 | 3;
};
type IntakeProps = {
  summary: string;
  answerCount: number;
  screening: ConsultationScreening;
  onSummaryChange: (value: string) => void;
  onContinue: () => void;
};

export function toggleScreeningChoice(values: string[], value: string, multiSelect: boolean) {
  if (values.includes(value)) {return values.filter(item => item !== value);}
  if (!multiSelect || ['none', 'unsure'].includes(value)) {return [value];}
  return [...values.filter(item => !['none', 'unsure'].includes(item)), value];
}

function ImpactLevelIcon({ level }: { level: 1 | 2 | 3 }) {
  const { colors, isDark } = useThemeColors();
  const color =
    level === 1
      ? colors.primaryText
      : level === 2
        ? isDark
          ? colors.warning
          : colors.premiumDark
        : colors.danger;

  return (
    <View accessible={false} style={styles.impactIcon}>
      {[8, 15, 22].map((height, index) => (
        <View
          key={height}
          style={[
            styles.impactBar,
            {
              height,
              backgroundColor: index < level ? color : 'transparent',
              borderColor: index < level ? color : colors.textSecondary,
              opacity: index < level ? 1 : 0.3,
            },
          ]}
        />
      ))}
    </View>
  );
}

function ChoiceGroup<T extends string>({
  number,
  title,
  choices,
  value,
  onChange,
  layout = 'rows',
  multiSelect = false,
}: {
  number: string;
  title: string;
  choices: Choice<T>[];
  value: string[];
  onChange: (value: string[]) => void;
  multiSelect?: boolean;
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
        accessibilityRole={multiSelect ? undefined : 'radiogroup'}
        accessibilityLabel={title}
        style={[styles.choices, layout !== 'rows' && styles.choicesHorizontal]}
      >
        {choices.map((choice) => {
          const selected = value.includes(choice.value);
          const tile = layout !== 'rows';
          return (
            <Pressable
              key={choice.value}
              accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
              accessibilityLabel={choice.label}
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(toggleScreeningChoice(value, choice.value, multiSelect))}
              style={({ pressed }) => [
                styles.choice,
                tile && styles.choiceTile,
                layout === 'grid' && styles.choiceGrid,
                layout === 'scale' && styles.choiceScale,
                {
                  backgroundColor: selected
                    ? colors.primaryLight
                    : 'transparent',
                  borderColor: selected ? colors.primaryText : colors.border,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <View style={[styles.choiceIcon, tile && styles.choiceTileIcon]}>
                {typeof choice.icon === 'number' ? (
                  <ImpactLevelIcon level={choice.icon} />
                ) : (
                  <Ionicons
                    accessible={false}
                    name={choice.icon}
                    size={22}
                    color={selected ? colors.primaryText : colors.textSecondary}
                  />
                )}
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
                  multiSelect && { borderRadius: 4 },
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

const choiceIcons: Record<string, Choice<string>['icon']> = {
  today: 'today-outline', two_to_seven_days: 'calendar-outline',
  over_one_week: 'calendar-number-outline', ongoing: 'time-outline',
  improving: 'trending-down-outline', stable: 'remove-outline', worsening: 'trending-up-outline',
  mild: 1, moderate: 2, severe: 3, none: 'checkmark-circle-outline', unsure: 'help-circle-outline',
};

function ConsultationQuestion({ question, busy, onAnswer, onBack }: {
  question: ScreeningQuestion;
  busy: boolean;
  onAnswer: (answer: ScreeningAnswer) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation('home');
  const { colors } = useThemeColors();
  const { width } = useWindowDimensions();
  const largeText = useScaledFontSize(16) > 20;
  const [values, setValues] = useState<string[]>([]);
  const [text, setText] = useState('');
  const layout = question.step === 'impact' && width >= 375 && !largeText ? 'scale'
    : question.step === 'onset' && width >= 360 && !largeText ? 'grid' : 'rows';
  const choices = question.options.map(item => ({
    ...item, icon: choiceIcons[item.value] || (question.step === 'red_flags' ? 'alert-circle-outline' : 'add-outline'),
  }));
  const valid = values.length > 0 || text.trim().length > 0;
  return (
    <View style={styles.screening}>
      <ChoiceGroup
        number={String(['red_flags', 'associated', 'onset', 'progression', 'impact'].indexOf(question.step) + 1).padStart(2, '0')}
        title={question.title} choices={choices} value={values} multiSelect={question.multiSelect}
        onChange={next => {
          setValues(next);
          if (next.some(value => ['none', 'unsure'].includes(value))) {setText('');}
        }} layout={layout}
      />
      {question.allowFreeText && (
        <TextInput
          accessibilityLabel={t('doctorScreeningOther')} placeholder={t('doctorScreeningOther')}
          placeholderTextColor={colors.textSecondary} value={text} maxLength={500}
          onChangeText={value => {
            setText(value);
            if (value.trim()) {setValues(previous => previous.filter(item => !['none', 'unsure'].includes(item)));}
          }}
          style={[styles.detailInput, { color: colors.textPrimary, borderColor: colors.border }]}
        />
      )}
      <Pressable accessibilityRole="button" disabled={busy || !valid}
        accessibilityState={{ disabled: busy || !valid }}
        onPress={() => onAnswer({ step: question.step, values, text: text.trim() })}
        style={[styles.continueButton, { backgroundColor: colors.primaryText, opacity: busy || !valid ? 0.5 : 1 }]}>
        <Text style={[styles.continueLabel, { color: colors.surface }]}>{t('common:continue')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onBack} style={styles.textButton}>
        <Text style={{ color: colors.primaryText }}>{t('common:back')}</Text>
      </Pressable>
    </View>
  );
}

export function DoctorConsultationIntake(props: IntakeProps) {
  const { t } = useTranslation('home');
  const { colors } = useThemeColors();
  const { screening } = props;
  const result = screening.result;
  const showDescription = !result && !screening.busy && !screening.error;
  const ready = result?.status === 'ready' && result.suitable_for_remote_care;
  return (
    <View style={styles.layout}>
      <View style={styles.summary}>
        <Text accessibilityRole="header" style={[styles.questionTitle, { color: colors.textPrimary }]}>
          {t('doctorConsultationSummaryLabel')}
        </Text>
        {showDescription ? (
          <>
            <Text style={[styles.helper, { color: colors.textSecondary }]}>{t('doctorScreeningDescriptionHint')}</Text>
            <TextInput
              accessibilityLabel={t('doctorConsultationSummaryLabel')} multiline textAlignVertical="top"
              value={props.summary} onChangeText={props.onSummaryChange} maxLength={3000}
              placeholder={t('doctorConsultationSummaryPlaceholder')} placeholderTextColor={colors.textSecondary}
              style={[styles.summaryInput, { color: colors.textPrimary, borderColor: colors.border }]}
            />
          </>
        ) : (
          <>
            <Text style={[styles.helper, { color: colors.textPrimary }]}>{props.summary}</Text>
            <Pressable accessibilityRole="button" onPress={screening.reset} style={styles.textButton}>
              <Text style={{ color: colors.primaryText }}>{t('doctorScreeningEditProblem')}</Text>
            </Pressable>
          </>
        )}
      </View>
      {screening.busy && <ActivityIndicator accessibilityLabel={t('doctorScreeningChecking')} color={colors.primaryText} />}
      {screening.error && (
        <View style={styles.summary}>
          <Text accessibilityRole="alert" style={[styles.helper, { color: colors.danger }]}>{t('doctorScreeningError')}</Text>
          <Pressable accessibilityRole="button" onPress={screening.check} style={styles.textButton}>
            <Text style={{ color: colors.primaryText }}>{t('common:retry')}</Text>
          </Pressable>
        </View>
      )}
      {showDescription && (
        <Pressable accessibilityRole="button" disabled={!props.summary.trim()}
          accessibilityState={{ disabled: !props.summary.trim() }}
          onPress={screening.check}
          style={[styles.continueButton, { backgroundColor: colors.primaryText, opacity: props.summary.trim() ? 1 : 0.5 }]}>
          <Text style={[styles.continueLabel, { color: colors.surface }]}>{t('doctorScreeningStart')}</Text>
          <Ionicons accessible={false} name="arrow-forward" size={20} color={colors.surface} />
        </Pressable>
      )}
      {result?.question && !screening.busy && (
        <ConsultationQuestion key={result.question.step} question={result.question} busy={screening.busy}
          onAnswer={screening.answer}
          onBack={() => { if (props.answerCount) {screening.back();} else {screening.reset();} }} />
      )}
      {result?.isDone && !screening.busy && (
        <View style={styles.screening}>
          <View style={styles.resultHeading}>
            <Ionicons accessible={false} name={ready ? 'clipboard-outline' : 'alert-circle-outline'}
              size={24} color={ready ? colors.primaryText : colors.danger} />
            <Text accessibilityRole="header" style={[styles.questionTitle, { color: colors.textPrimary }]}>
              {t(ready ? 'doctorScreeningRecorded' : 'doctorScreeningNeedsAttention')}
            </Text>
          </View>
          <Text accessibilityRole={ready ? undefined : 'alert'} style={[styles.helper, { color: ready ? colors.textSecondary : colors.danger }]}>
            {result.message}
          </Text>
          <Text style={[styles.questionTitle, { color: colors.textPrimary }]}>{t(`doctorScreeningRisk_${result.risk_level}`)}</Text>
          {result.recorded_answers.map(answer => (
            <View key={answer.step} style={styles.summary}>
              <Text style={[styles.helper, { color: colors.textSecondary }]}>{answer.question}</Text>
              <Text style={[styles.helper, { color: colors.textPrimary }]}>{answer.answers.join('; ')}</Text>
            </View>
          ))}
          {ready && (
            <Pressable accessibilityRole="button" onPress={props.onContinue}
              style={[styles.continueButton, { backgroundColor: colors.primaryText }]}>
              <Text style={[styles.continueLabel, { color: colors.surface }]}>{t('doctorScreeningChooseExpert')}</Text>
              <Ionicons accessible={false} name="arrow-forward" size={20} color={colors.surface} />
            </Pressable>
          )}
          {props.answerCount > 0 && (
            <Pressable accessibilityRole="button" onPress={screening.back} style={styles.textButton}>
              <Text style={{ color: colors.primaryText }}>{t('doctorScreeningReviewAnswers')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { gap: spacing.xl },
  screening: { gap: spacing.xl },
  helper: { fontSize: 15, lineHeight: 23 },
  detailInput: { borderBottomWidth: 1, minHeight: 48, paddingVertical: spacing.md, fontSize: 16 },
  textButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  resultHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
    borderRadius: 0,
    minHeight: 64,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
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
  impactIcon: {
    width: 24,
    height: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  impactBar: { width: 5, borderWidth: 1.5, borderRadius: 1.5 },
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
  summaryInput: {
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
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
  continueLabel: { flexShrink: 1, fontSize: 17, lineHeight: 24, fontWeight: '700' },
});
