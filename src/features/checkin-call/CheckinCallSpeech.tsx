import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useFontSizeStore } from '../../stores/font-size.store';
import { radius, spacing, type lightColors } from '../../styles/theme';
import type { CallAudioState } from './checkin-call.audio';

export function CheckinCallSpeech({ audio, disabled, onReplay, onStop, showTranscript = true }: {
  audio: CallAudioState;
  disabled: boolean;
  onReplay: () => void;
  onStop: () => void;
  showTranscript?: boolean;
}) {
  const { t } = useTranslation('checkinCall');
  const { colors } = useThemeColors();
  const multiplier = useFontSizeStore(state => state.multiplier);
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!audio.prompt) return null;
  const active = audio.phase === 'loading' || audio.phase === 'playing';
  return (
    <View style={styles.root}>
      <View style={styles.statusRow}>
        {audio.phase === 'loading'
          ? <ActivityIndicator color={colors.primaryText} size="small" />
          : <Ionicons name="volume-high" size={26} color={colors.primaryText} />}
        <Text accessibilityLiveRegion="polite" style={styles.status}>{t(`playback.${audio.phase}`)}</Text>
        {audio.phase === 'playing' && (
          <View style={styles.waveform} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {[8, 14, 20, 14, 8].map((height, index) => (
              <View key={index} style={[styles.waveformBar, { height }]} />
            ))}
          </View>
        )}
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
          style={({ pressed }) => [styles.control, { flexBasis: 140 * multiplier }, disabled && styles.disabled, pressed && styles.pressed]}
        >
          <Ionicons name="play-circle" size={32} color={colors.primary} />
          <Text style={styles.controlText}>{t('replay')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('playback.stop')}
          accessibilityState={{ disabled: !active }}
          disabled={!active}
          onPress={onStop}
          style={({ pressed }) => [styles.control, { flexBasis: 140 * multiplier }, !active && styles.disabled, pressed && styles.pressed]}
        >
          <Ionicons name="stop-circle" size={32} color={colors.primary} />
          <Text style={styles.controlText}>{t('playback.stop')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function CheckinCallSafetyNote() {
  const { t } = useTranslation('checkinCall');
  const { colors } = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.safetyRow}>
      <MaterialCommunityIcons name="shield-cross-outline" size={34} color={colors.primaryText} />
      <Text style={styles.safetyText}>{t('safetyNote')}</Text>
    </View>
  );
}

const createStyles = (colors: typeof lightColors) => StyleSheet.create({
  root: { width: '100%', maxWidth: 360, alignSelf: 'center', gap: spacing.md, paddingVertical: spacing.md, zIndex: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 24, backgroundColor: colors.primaryLight },
  status: { flexShrink: 1, color: colors.primaryText, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveformBar: { width: 3.5, borderRadius: radius.full, backgroundColor: colors.primary, opacity: 0.7 },
  transcript: { color: colors.textPrimary, fontSize: 16, lineHeight: 25 },
  hint: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: spacing.md },
  control: { flexGrow: 1, flexShrink: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', minHeight: 52, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm, borderWidth: 1.5, borderColor: colors.primary + '35', borderRadius: 26, backgroundColor: colors.surface },
  controlText: { flexShrink: 1, color: colors.primaryText, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { backgroundColor: colors.primaryLight },
  safetyRow: { width: '100%', maxWidth: 360, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.md },
  safetyText: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
