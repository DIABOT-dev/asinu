import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import type { CallAudioState } from './checkin-call.audio';

export function CheckinCallSpeech({ audio, disabled, onReplay, onStop, showTranscript = true }: {
  audio: CallAudioState;
  disabled: boolean;
  onReplay: () => void;
  onStop: () => void;
  showTranscript?: boolean;
}) {
  const { t } = useTranslation('checkinCall');
  if (!audio.prompt) return null;
  const active = audio.phase === 'loading' || audio.phase === 'playing';
  return (
    <View style={styles.root}>
      <View style={styles.statusRow}>
        {audio.phase === 'loading'
          ? <ActivityIndicator color="#087f6d" size="small" />
          : <Ionicons name={active ? 'volume-high-outline' : 'chatbubble-outline'} size={20} color="#087f6d" />}
        <Text accessibilityLiveRegion="polite" style={styles.status}>{t(`playback.${audio.phase}`)}</Text>
      </View>
      {showTranscript && <Text style={styles.transcript}>{audio.prompt.text}</Text>}
      {audio.phase === 'error' && <Text style={styles.hint}>{t('playback.errorHint')}</Text>}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('replay')}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onReplay}
          style={[styles.control, disabled && styles.disabled]}
        >
          <Ionicons name="refresh-outline" size={20} color="#087f6d" />
          <Text style={styles.controlText}>{t('replay')}</Text>
        </Pressable>
        {active && (
          <Pressable accessibilityRole="button" accessibilityLabel={t('playback.stop')} onPress={onStop} style={styles.control}>
            <Ionicons name="stop-outline" size={20} color="#087f6d" />
            <Text style={styles.controlText}>{t('playback.stop')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', maxWidth: 360, gap: 10, paddingVertical: 12, zIndex: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { flex: 1, color: '#087f6d', fontSize: 14, fontWeight: '700' },
  transcript: { color: '#334155', fontSize: 16, lineHeight: 25 },
  hint: { color: '#b45309', fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  control: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', minHeight: 44, paddingVertical: 8, paddingHorizontal: 4, gap: 8 },
  controlText: { flexShrink: 1, color: '#087f6d', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
