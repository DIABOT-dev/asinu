import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import { ScaledTextInput as TextInput } from '../../components/ScaledTextInput';
import { AiDataConsentModal, hasAiDataConsent } from '../../components/AiDataConsentModal';
import { useThemeColors } from '../../hooks/useThemeColors';
import { tokenStore } from '../../lib/tokenStore';
import { radius, spacing } from '../../styles/theme';
import { useAuthStore } from '../auth/auth.store';
import { renderVoiceAnswerButton, useVoiceAnswer } from '../guidance/VoiceAnswerButton';
import { dictationValue } from '../guidance/VoiceAnswerInput';

import type { ConsultationScreening, ScreeningAnswer, ScreeningQuestion } from './useConsultationScreening';

type IntakeProps = {
  stage: 'description' | 'screening';
  summary: string;
  screening: ConsultationScreening;
  onSummaryChange: (value: string) => void;
  onStartScreening: () => void;
  onContinue: () => void;
};

const SUMMARY_MAX_LENGTH = 3000;
type VoiceConsentRequest = { token: string; resolve: (granted: boolean) => void };

export function toggleScreeningChoice(values: string[], value: string, multiSelect: boolean) {
  if (values.includes(value)) {return values.filter(item => item !== value);}
  if (!multiSelect || ['none', 'unsure'].includes(value)) {return [value];}
  return [...values.filter(item => !['none', 'unsure'].includes(item)), value];
}

function ChoiceGroup({
  title,
  choices,
  value,
  onChange,
  multiSelect = false,
}: {
  title: string;
  choices: ScreeningQuestion['options'];
  value: string[];
  onChange: (value: string[]) => void;
  multiSelect?: boolean;
}) {
  const { colors } = useThemeColors();
  return (
    <View style={styles.questionGroup}>
      <Text
        accessibilityRole="header"
        style={[styles.screeningQuestionTitle, { color: colors.textPrimary }]}
      >
        {title}
      </Text>
      <View
        accessibilityRole={multiSelect ? undefined : 'radiogroup'}
        accessibilityLabel={title}
        style={styles.choices}
      >
        {choices.map((choice) => {
          const selected = value.includes(choice.value);
          const label = choice.label.charAt(0).toUpperCase() + choice.label.slice(1);
          return (
            <Pressable
              key={choice.value}
              accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
              accessibilityLabel={label}
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(toggleScreeningChoice(value, choice.value, multiSelect))}
              style={({ pressed }) => [
                styles.choice,
                {
                  backgroundColor: selected
                    ? colors.primaryLight
                    : 'transparent',
                  borderColor: selected ? colors.primaryText : colors.border,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.choiceLabel,
                  {
                    color: selected ? colors.primaryText : colors.textPrimary,
                    fontWeight: selected ? '700' : '500',
                  },
                ]}
              >
                {label}
              </Text>
              <View
                style={[
                  styles.radio,
                  multiSelect && { borderRadius: 4 },
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

function ConsultationQuestion({ question, busy, onAnswer }: {
  question: ScreeningQuestion;
  busy: boolean;
  onAnswer: (answer: ScreeningAnswer) => void;
}) {
  const { t } = useTranslation('home');
  const { colors } = useThemeColors();
  const [values, setValues] = useState<string[]>([]);
  const [text, setText] = useState('');
  const valid = values.length > 0 || text.trim().length > 0;
  return (
    <View style={styles.screening}>
      <ChoiceGroup
        title={question.title} choices={question.options} value={values} multiSelect={question.multiSelect}
        onChange={next => {
          setValues(next);
          if (next.some(value => ['none', 'unsure'].includes(value))) {setText('');}
        }}
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
    </View>
  );
}

function ConsultationDescription({ summary, onSummaryChange, onCheck }: Pick<IntakeProps, 'summary' | 'onSummaryChange'> & {
  onCheck: () => void;
}) {
  const { t } = useTranslation('home');
  const { colors } = useThemeColors();
  const token = useAuthStore(state => state.token);
  const [interim, setInterim] = useState('');
  const [consentRequest, setConsentRequest] = useState<VoiceConsentRequest | null>(null);
  const pendingConsent = useRef<VoiceConsentRequest | null>(null);
  const revision = useRef(0);
  const isSessionCurrent = () =>
    !!token && useAuthStore.getState().token === token && tokenStore.getToken() === token;
  const voice = useVoiceAnswer({
    sessionKey: token,
    isSessionCurrent,
    disabled: !token,
    onBeforeAi: async () => {
      const version = revision.current;
      if (!token || !isSessionCurrent()) {return false;}
      const granted = await hasAiDataConsent();
      if (version !== revision.current || !isSessionCurrent()) {return false;}
      if (granted) {return true;}
      return new Promise<boolean>(resolve => {
        const request = { token, resolve };
        pendingConsent.current = request;
        setConsentRequest(request);
      });
    },
    onInterimText: setInterim,
    onText: text => {
      setInterim('');
      onSummaryChange(dictationValue(summary, text, SUMMARY_MAX_LENGTH));
    },
  });
  useEffect(() => {
    setConsentRequest(null);
    setInterim('');
    return () => {
      revision.current++;
      pendingConsent.current?.resolve(false);
      pendingConsent.current = null;
    };
  }, [token, voice.focused]);

  const finishConsent = (granted: boolean) => {
    if (!consentRequest || pendingConsent.current !== consentRequest) {return;}
    pendingConsent.current = null;
    setConsentRequest(null);
    consentRequest.resolve(granted && isSessionCurrent());
  };
  const voiceBusy = voice.recording || voice.busy;
  const canCheck = !!summary.trim() && !voiceBusy;
  return (
    <View style={styles.layout}>
      <View style={styles.summary}>
        <Text accessibilityRole="header" style={[styles.questionTitle, { color: colors.textPrimary }]}>
          {t('doctorConsultationSummaryLabel')}
        </Text>
        <View style={[styles.summaryField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            accessibilityLabel={t('doctorConsultationSummaryLabel')} multiline textAlignVertical="top"
            editable={!voiceBusy} value={dictationValue(summary, interim, SUMMARY_MAX_LENGTH)}
            onChangeText={onSummaryChange} maxLength={SUMMARY_MAX_LENGTH}
            placeholder={t('doctorConsultationSummaryPlaceholder')} placeholderTextColor={colors.textSecondary}
            style={[styles.summaryInput, { color: colors.textPrimary }]}
          />
          <View style={styles.summaryControls}>
            {renderVoiceAnswerButton(voice, {
              iconOnly: true, color: colors.primaryText, testID: 'consultation-description-mic',
            })}
          </View>
        </View>
      </View>
      <Pressable accessibilityRole="button" disabled={!canCheck}
        accessibilityState={{ disabled: !canCheck }}
        onPress={() => { if (canCheck) {onCheck();} }}
        style={[styles.continueButton, { backgroundColor: colors.primaryText, opacity: canCheck ? 1 : 0.5 }]}>
        <Text style={[styles.continueLabel, { color: colors.surface }]}>{t('doctorScreeningStart')}</Text>
        <Ionicons accessible={false} name="arrow-forward" size={20} color={colors.surface} />
      </Pressable>
      <AiDataConsentModal visible={!!consentRequest && consentRequest.token === token && voice.focused}
        onAgree={() => finishConsent(true)} onDecline={() => finishConsent(false)} />
    </View>
  );
}

export function DoctorConsultationIntake(props: IntakeProps) {
  const { t } = useTranslation('home');
  const { colors } = useThemeColors();
  const { screening } = props;
  const result = screening.result;
  const ready = result?.status === 'ready' && result.suitable_for_remote_care;
  const risk = result?.risk_level;
  const urgent = risk === 'high' || risk === 'emergency';
  const monitor = risk === 'medium';
  const riskAccent = urgent ? colors.danger : monitor ? colors.warning : colors.primaryText;
  if (props.stage === 'description') {
    return <ConsultationDescription summary={props.summary} onSummaryChange={props.onSummaryChange} onCheck={props.onStartScreening} />;
  }
  return (
    <View style={styles.layout}>
      {!result && !screening.busy && !screening.error && (
        <Pressable accessibilityRole="button" onPress={screening.check}
          style={[styles.continueButton, { backgroundColor: colors.primaryText }]}>
          <Text style={[styles.continueLabel, { color: colors.surface }]}>{t('doctorScreeningStart')}</Text>
        </Pressable>
      )}
      {screening.busy && <ActivityIndicator accessibilityLabel={t('doctorScreeningChecking')} color={colors.primaryText} />}
      {screening.error && (
        <View style={styles.summary}>
          <Text accessibilityRole="alert" style={[styles.helper, { color: colors.danger }]}>{t('doctorScreeningError')}</Text>
          <Pressable accessibilityRole="button" onPress={screening.check} style={styles.textButton}>
            <Text style={{ color: colors.primaryText }}>{t('common:retry')}</Text>
          </Pressable>
        </View>
      )}
      {result?.question && !screening.busy && (
        <ConsultationQuestion key={result.question.step} question={result.question} busy={screening.busy}
          onAnswer={screening.answer} />
      )}
      {result?.isDone && !screening.busy && (
        <View style={styles.screening}>
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.riskPanel,
              {
                backgroundColor: urgent ? colors.surface : monitor ? colors.premiumLight : colors.primaryLight,
                borderColor: riskAccent,
              },
            ]}
          >
            <View style={styles.riskHeading}>
              <Ionicons
                accessible={false}
                name={urgent ? 'warning-outline' : monitor ? 'eye-outline' : 'information-circle-outline'}
                size={26}
                color={monitor ? colors.textPrimary : riskAccent}
              />
              <View style={styles.riskText}>
                <Text style={[styles.riskLabel, { color: colors.textSecondary }]}>
                  {t('doctorScreeningRiskLabel')}
                </Text>
                <Text accessibilityRole="header" style={[styles.riskTitle, { color: colors.textPrimary }]}>
                  {t(`doctorScreeningRisk_${result.risk_level}`)}
                </Text>
              </View>
            </View>
            {!ready && (
              <View style={styles.riskGuidance}>
                <Text style={[styles.questionTitle, { color: colors.textPrimary }]}>{t('doctorScreeningNeedsAttention')}</Text>
                {result.message && (
                  <Text accessibilityRole="alert" style={[styles.helper, { color: colors.textPrimary }]}>
                    {result.message}
                  </Text>
                )}
              </View>
            )}
          </View>
          {result.recorded_answers.map(answer => (
            <View key={answer.step} style={styles.summary}>
              <Text style={[styles.screeningQuestionTitle, { color: colors.textPrimary }]}>{answer.question}</Text>
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
  riskPanel: { borderRadius: radius.lg, borderWidth: 1, gap: spacing.lg, padding: spacing.lg },
  riskHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  riskText: { flex: 1, gap: spacing.xs },
  riskLabel: { fontSize: 14, fontWeight: '600' },
  riskTitle: { fontSize: 26, lineHeight: 34, fontWeight: '800' },
  riskGuidance: { gap: spacing.xs },
  questionGroup: { gap: spacing.md },
  screeningQuestionTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  questionTitle: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '600',
  },
  choices: { flexDirection: 'column', gap: spacing.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 0,
    minHeight: 64,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  choiceLabel: { flex: 1, fontSize: 16, lineHeight: 24 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1 },
  summary: { gap: spacing.sm, paddingTop: spacing.xs },
  summaryField: { borderWidth: 1, borderRadius: radius.lg },
  summaryInput: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 140,
    fontSize: 16,
    lineHeight: 24,
  },
  summaryControls: { alignItems: 'flex-end' },
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
