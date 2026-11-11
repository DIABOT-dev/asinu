import React, { useCallback, useState } from 'react';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { ScaledTextInput as TextInput } from '../../components/ScaledTextInput';
import { GuideTarget } from './GuidanceProvider';
import { VoiceAnswerButton } from './VoiceAnswerButton';

export function dictationValue(value: string, interim: string, maxLength?: number) {
  const combined = interim ? `${value.trimEnd()} ${interim}`.trim() : value;
  return maxLength === undefined ? combined : combined.slice(0, maxLength);
}

/** The input displays partial speech; only a finished utterance updates its owner. */
export function VoiceAnswerInput({ value, onChangeText, onRecognized, onBeforeAi,
  onProcessingChange, disabled = false, readOnly = false, practice = false, practiceExample,
  placeholder, maxLength, style, inputStyle }: {
  value: string;
  onChangeText: (text: string) => void;
  onRecognized?: () => void;
  onBeforeAi: () => Promise<boolean>;
  onProcessingChange: (busy: boolean) => void;
  disabled?: boolean; readOnly?: boolean; practice?: boolean;
  practiceExample?: string;
  placeholder: string; maxLength?: number;
  style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle>;
}) {
  const [interim, setInterim] = useState('');
  const [processing, setProcessing] = useState(false);
  const handleProcessing = useCallback((busy: boolean) => {
    setProcessing(busy);
    if (!busy) {setInterim('');}
    onProcessingChange(busy);
  }, [onProcessingChange]);
  return <View style={style}>
    <GuideTarget step="checkin.voice" enabled={practice && !disabled} acknowledgeOnTouch={false}>
      <VoiceAnswerButton practice={practice} practiceExample={practiceExample} disabled={disabled || readOnly}
        onBeforeAi={onBeforeAi} onInterimText={setInterim} onProcessingChange={handleProcessing}
        onText={text => {
          setInterim('');
          onChangeText(dictationValue(value, text, maxLength));
          onRecognized?.();
        }} />
    </GuideTarget>
    <TextInput testID="checkin-voice-text" allowFontScaling multiline
      style={[inputStyle, { maxHeight: 144 }]} placeholder={placeholder} placeholderTextColor="#94a3b8"
      value={dictationValue(value, interim, maxLength)} maxLength={maxLength}
      onChangeText={disabled || readOnly ? undefined : onChangeText} returnKeyType="done"
      editable={!disabled && !readOnly && !processing} />
  </View>;
}
