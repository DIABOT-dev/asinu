/**
 * VoiceLogButton — Premium feature
 * Ghi am → Whisper transcribe → AI parse → dien form tu dong
 *
 * - Nguoi dung thuong: hien thi nut co lock, khi an hien modal yeu cau nang cap
 * - Nguoi dung premium: ghi am binh thuong
 * - Validation: neu AI khong nhan ra so lieu hop le → bao loi, khong dien form
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
// Audio lazy-loaded only when recording starts
let _Audio: typeof import('expo-av').Audio | null = null;
async function getAudio() {
  if (!_Audio) { _Audio = (await import('expo-av')).Audio; }
  return _Audio;
}
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { AppAlertModal, useAppAlert } from './AppAlertModal';
import { ScaledText as Text } from './ScaledText';
import { usePremium } from '../hooks/usePremium';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { VoiceLogType, VoiceParseResult, voiceParseLogs } from '../features/logs/voice.api';
import { colors, radius, spacing } from '../styles';

type Props = {
  logType: VoiceLogType;
  onParsed: (result: VoiceParseResult) => void;
  onError?: (message: string) => void;
};

type RecordState = 'idle' | 'recording' | 'processing' | 'done' | 'error';

// Kiem tra ket qua parse co so lieu hop le khong
function validateParsed(result: VoiceParseResult, t: (key: string) => string): string | null {
  if (!result.ok || !result.parsed) {
    return t('voiceNoData');
  }
  const p = result.parsed;
  if (p.log_type === 'glucose') {
    if (!p.value || isNaN(p.value) || p.value <= 0 || p.value > 800) {
      return t('voiceNoGlucose');
    }
  }
  if (p.log_type === 'blood_pressure') {
    if (!p.systolic || !p.diastolic || p.systolic <= 0 || p.diastolic <= 0) {
      return t('voiceNoBp');
    }
  }
  return null;
}

export function VoiceLogButton({ logType, onParsed, onError }: Props) {
  const router = useRouter();
  const { isPremium, loading: premiumLoading } = usePremium();
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);
  const [state, setState] = useState<RecordState>('idle');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { alertState, showAlert, dismissAlert } = useAppAlert();
  const recordingRef = useRef<any>(null);
  const pulseScale = useSharedValue(1);

  // Animation khi dang ghi am
  useEffect(() => {
    if (state === 'recording') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.18, { duration: 550 }),
          withTiming(1, { duration: 550 })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [state]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const startRecording = async () => {
    try {
      const Audio = await getAudio();
      const existing = await Audio.getPermissionsAsync();
      const { granted, canAskAgain } = existing.granted ? existing : await Audio.requestPermissionsAsync();
      if (!granted) {
        if (!canAskAgain) {
          showAlert(
            t('micPermissionTitle'),
            t('micPermissionMsg'),
            [
              { text: t('later'), style: 'cancel' },
              { text: t('openSettings'), onPress: () => Linking.openSettings() },
            ]
          );
        }
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setState('recording');
    } catch {
      setState('error');
      setErrorMessage(t('voiceRecordError'));
      setTimeout(() => setState('idle'), 2500);
    }
  };

  const stopAndProcess = async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    setState('processing');
    try {
      await recording.stopAndUnloadAsync();
      const Audio = await getAudio();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error(t('voiceNoFile'));

      const result = await voiceParseLogs(uri, logType);

      // Validate so lieu truoc khi dien form
      const validationError = validateParsed(result, t);
      if (validationError) {
        setState('error');
        setErrorMessage(validationError);
        onError?.(validationError);
        setTimeout(() => { setState('idle'); setErrorMessage(''); }, 3000);
        return;
      }

      onParsed(result);
      setState('done');
      setTimeout(() => setState('idle'), 2000);
    } catch (err: any) {
      const msg = err?.message || t('voiceProcessError');
      setState('error');
      setErrorMessage(msg);
      onError?.(msg);
      setTimeout(() => { setState('idle'); setErrorMessage(''); }, 3000);
    }
  };

  const handlePress = () => {
    if (premiumLoading) return;

    // Chua premium → hien modal nang cap
    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }

    if (state === 'recording') {
      stopAndProcess();
    } else if (state === 'idle' || state === 'error') {
      startRecording();
    }
  };

  const isDisabled = state === 'processing' || premiumLoading;

  // --- UI helpers ---

  const iconBg = !isPremium
    ? colors.primaryLight
    : state === 'recording'
    ? colors.primary
    : state === 'done'
    ? colors.emeraldLight
    : state === 'error'
    ? '#fef2f2'
    : colors.primaryLight;

  const renderIcon = () => {
    if (premiumLoading) return <ActivityIndicator size="small" color={colors.primary} />;
    if (!isPremium) return <Ionicons name="mic" size={22} color={colors.primary} />;
    if (state === 'processing') return <ActivityIndicator size="small" color={colors.primary} />;
    if (state === 'done') return <Ionicons name="checkmark" size={22} color={colors.emerald} />;
    if (state === 'recording') return <Ionicons name="stop" size={22} color="#fff" />;
    return <Ionicons name="mic" size={22} color={colors.primary} />;
  };

  const voiceHint: Record<string, string> = {
    glucose:        t('voiceHintGlucose'),
    blood_pressure: t('voiceHintBp'),
    weight:         t('voiceHintWeight'),
    water:          t('voiceHintWater'),
    insulin:        t('voiceHintInsulin'),
    meal:           t('voiceHintMeal'),
  };
  const hint = voiceHint[logType] ?? t('voiceHintDefault');

  const mainLabel = state === 'recording'
    ? t('voiceRecording')
    : state === 'processing'
    ? t('processing')
    : state === 'done'
    ? t('voiceDone')
    : state === 'error'
    ? t('retry')
    : t('voiceInputLabel');

  // --- Render ---

  return (
    <>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
      <Pressable
        onPress={handlePress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.container,
          pressed && styles.pressed,
        ]}
      >
        <Animated.View style={[styles.iconWrap, pulseStyle]}>
          {renderIcon()}
        </Animated.View>

        <View style={styles.textWrap}>
          <Text
            style={[
              styles.label,
              state === 'error' && styles.labelError,
              state === 'done' && styles.labelDone,
            ]}
          >
            {mainLabel}
          </Text>

          {state === 'idle' && (
            <Text style={styles.hint}>{hint}</Text>
          )}
          {state === 'error' && errorMessage ? (
            <Text style={styles.hintError}>{errorMessage}</Text>
          ) : null}
        </View>

        {/* Chi hien khi dang ghi */}
        {state === 'recording' && <View style={styles.recDot} />}

        {/* Badge Premium khi chua nang cap */}
        {!isPremium && !premiumLoading && (
          <View style={styles.premiumBadge}>
            <MaterialCommunityIcons name="crown" size={12} color="#fff" />
          </View>
        )}
      </Pressable>

      {/* Modal nang cap Premium */}
      <Modal
        visible={showUpgradeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowUpgradeModal(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="crown" size={36} color={colors.premium} />
            </View>
            <Text style={styles.modalTitle}>{t('voicePremiumTitle')}</Text>
            <Text style={styles.modalDesc}>{t('voicePremiumDesc')}</Text>
            <View style={styles.featureList}>
              {[t('voicePremiumFeature1'), t('voicePremiumFeature2'), t('voicePremiumFeature3')].map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.emerald} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={styles.upgradeBtn}
              onPress={() => {
                setShowUpgradeModal(false);
                setTimeout(() => router.push('/subscription'), 350);
              }}
            >
              <MaterialCommunityIcons name="crown" size={18} color="#fff" />
              <Text style={styles.upgradeBtnText}>{t('voiceUpgrade')}</Text>
            </Pressable>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => setShowUpgradeModal(false)}
            >
              <Text style={styles.cancelBtnText}>{t('later')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.md,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    containerLocked: {
      borderColor: colors.border,
      opacity: 0.85,
    },
    pressed: {
      opacity: 0.82,
      transform: [{ scale: 0.98 }],
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    textWrap: {
      flex: 1,
      gap: 3,
    },
    label: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    labelLocked: {
      color: colors.textSecondary,
    },
    labelError: {
      color: colors.danger,
    },
    labelDone: {
      color: colors.emerald,
    },
    hint: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    hintError: {
      fontSize: typography.size.xs,
      color: colors.danger,
      fontWeight: '500',
    },
    recDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.danger,
    },
    premiumBadge: {
      backgroundColor: colors.premium,
      borderRadius: radius.full,
      paddingHorizontal: 6,
      paddingVertical: 3,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    // Modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    modalCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: spacing.xxl,
      alignItems: 'center',
      gap: spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
    modalIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.premiumLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    modalTitle: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    modalDesc: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },
    featureList: {
      alignSelf: 'stretch',
      gap: spacing.sm,
      marginVertical: spacing.xs,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    featureText: {
      fontSize: typography.size.sm,
      color: colors.textPrimary,
      flex: 1,
    },
    upgradeBtn: {
      backgroundColor: colors.premium,
      borderRadius: radius.full,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xxl,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      alignSelf: 'stretch',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    upgradeBtnText: {
      color: '#fff',
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
    cancelBtn: {
      paddingVertical: spacing.sm,
    },
    cancelBtnText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      fontWeight: '600',
    },
  });
}
