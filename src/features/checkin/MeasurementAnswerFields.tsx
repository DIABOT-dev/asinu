import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import { ScaledTextInput as TextInput } from '../../components/ScaledTextInput';
import { VoiceAnswerInput } from '../guidance/VoiceAnswerInput';
import { bloodPressureAnswer, glucoseAnswer, parseMeasurementSpeech, type MeasurementInput } from './triage-measurement';

export function MeasurementAnswerFields({ input, disabled, onChange, onBeforeAi, onProcessingChange, hideTitle = false }: {
  input: MeasurementInput;
  disabled: boolean;
  onChange: (answer: string | null) => void;
  onBeforeAi: () => Promise<boolean>;
  onProcessingChange: (type: MeasurementInput['type'], busy: boolean) => void;
  hideTitle?: boolean;
}) {
  const { t } = useTranslation('home');
  const [upper, setUpper] = useState('');
  const [lower, setLower] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<'mg/dL' | 'mmol/L'>('mg/dL');
  const [speech, setSpeech] = useState('');
  const [speechError, setSpeechError] = useState(false);
  const [busy, setBusy] = useState(false);
  const handleProcessing = useCallback((processing: boolean) => {
    setBusy(processing); onProcessingChange(input.type, processing);
  }, [input.type, onProcessingChange]);
  const bp = input.type === 'huyet_ap';
  const answer = bp ? bloodPressureAnswer(upper, lower) : glucoseAnswer(value, unit);
  const invalidManual = Boolean(bp ? upper && lower && !answer : value && !answer);
  const editBp = (top: string, bottom: string) => {
    setUpper(top); setLower(bottom); setSpeechError(false); setSpeech('');
    onChange(bloodPressureAnswer(top, bottom));
  };
  const locked = disabled || busy;
  return <View style={styles.section}>
    {!hideTitle && <Text style={styles.title}>{input.label}</Text>}
    {bp ? <View style={styles.row}>
      {([{ label: t('checkinBpUpper'), value: upper, edit: (v: string) => editBp(v, lower), id: 'upper' },
        { label: t('checkinBpLower'), value: lower, edit: (v: string) => editBp(upper, v), id: 'lower' }]).map(field => <View key={field.id} style={styles.field}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput testID={`checkin-bp-${field.id}`} accessibilityLabel={field.label} style={styles.number}
            keyboardType="number-pad" value={field.value} maxLength={3} editable={!locked} onChangeText={field.edit} />
        </View>)}
      <Text style={styles.label}>mmHg</Text>
    </View> : <>
      <TextInput testID="checkin-glucose-value" accessibilityLabel={input.label} style={styles.number}
        keyboardType="decimal-pad" value={value} maxLength={7} editable={!locked}
        onChangeText={text => { setValue(text); setSpeechError(false); setSpeech(''); onChange(glucoseAnswer(text, unit)); }} />
      <View style={styles.row}>{(['mg/dL', 'mmol/L'] as const).map(item => <Pressable key={item} disabled={locked}
        accessibilityRole="radio" accessibilityState={{ checked: unit === item, disabled: locked }}
        style={[styles.unit, unit === item && styles.unitSelected]} onPress={() => { setUnit(item); setSpeechError(false); setSpeech(''); onChange(glucoseAnswer(value, item)); }}>
        <Text style={styles.label}>{item}</Text>
      </Pressable>)}</View>
    </>}
    <VoiceAnswerInput value={speech} disabled={disabled} onBeforeAi={onBeforeAi} dictationMode="replace"
      onProcessingChange={handleProcessing}
      onChangeText={text => {
        setSpeech(text);
        const parsed = parseMeasurementSpeech(text, input.type, unit);
        setSpeechError(!parsed);
        if (!parsed) { onChange(null); return; }
        if (parsed.kind === 'bp') { setUpper(parsed.upper); setLower(parsed.lower); onChange(bloodPressureAnswer(parsed.upper, parsed.lower)); }
        else { setValue(parsed.value); setUnit(parsed.unit); onChange(glucoseAnswer(parsed.value, parsed.unit)); }
      }} placeholder={t('checkinReadMeasurement')} maxLength={200} style={styles.row} inputStyle={styles.speech} />
    {speechError && <Text accessibilityLiveRegion="polite" style={styles.error}>{t('checkinMeasurementUnclear')}</Text>}
    {!speechError && invalidManual && <Text accessibilityLiveRegion="polite" style={styles.error}>{t('checkinMeasurementCheckNumbers')}</Text>}
    {answer && !speechError && <Text testID="checkin-measurement-preview" accessibilityLiveRegion="polite" style={styles.preview}>{t('checkinMeasurementConfirm', { value: answer })}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  section: { paddingVertical: 14, gap: 12 },
  title: { fontSize: 19, fontWeight: '700', color: '#193b38' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  field: { flex: 1, minWidth: 95, gap: 6 },
  label: { fontSize: 17, color: '#344d4b' },
  number: { minHeight: 56, borderBottomWidth: 1, borderColor: '#93bdb7', color: '#193b38', fontSize: 26, padding: 8 },
  unit: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 20 },
  unitSelected: { backgroundColor: '#def2ed' },
  speech: { minHeight: 44, flex: 1, fontSize: 17, color: '#344d4b' },
  error: { fontSize: 16, color: '#a13a2d' },
  preview: { fontSize: 18, fontWeight: '600', color: '#176d61' },
});
