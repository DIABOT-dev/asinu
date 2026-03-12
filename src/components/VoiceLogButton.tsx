/**
 * VoiceLogButton — Premium feature
 * Ghi âm → Whisper transcribe → AI parse → điền form tự động
 *
 * - Người dùng thường: hiển thị nút có lock, khi ấn hiện modal yêu cầu nâng cấp
 * - Người dùng premium: ghi âm bình thường
 * - Validation: nếu AI không nhận ra số liệu hợp lệ → báo lỗi, không điền form
 */

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { ScaledText as Text } from './ScaledText';
import { useModal } from '../hooks/useModal';
import { usePremium } from '../hooks/usePremium';
import { VoiceLogType, VoiceParseResult, voiceParseLogs } from '../features/logs/voice.api';
import { colors, radius, spacing } from '../styles';

type Props = {
  logType: VoiceLogType;
  onParsed: (result: VoiceParseResult) => void;
  onError?: (message: string) => void;
};

type RecordState = 'idle' | 'recording' | 'processing' | 'done' | 'error';

// Kiểm tra kết quả parse có số liệu hợp lệ không
function validateParsed(result: VoiceParseResult): string | null {
  if (!result.ok || !result.parsed) {
    return 'Không nhận ra số liệu. Vui lòng thử lại và nói rõ hơn.';
  }
  const p = result.parsed;
  if (p.log_type === 'glucose') {
    if (!p.value || isNaN(p.value) || p.value <= 0 || p.value > 800) {
      return 'Không tìm thấy chỉ số đường huyết hợp lệ (ví dụ: "120 mg/dL sau ăn").';
    }
  }
  if (p.log_type === 'blood_pressure') {
    if (!p.systolic || !p.diastolic || p.systolic <= 0 || p.diastolic <= 0) {
      return 'Không tìm thấy chỉ số huyết áp hợp lệ (ví dụ: "huyết áp 120/80").';
    }
  }
  return null;
}

export function VoiceLogButton({ logType, onParsed, onError }: Props) {
  const router = useRouter();
  const { isPremium, loading: premiumLoading } = usePremium();
  const { showConfirm, modal: appModal } = useModal();
  const [state, setState] = useState<RecordState>('idle');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseScale = useSharedValue(1);

  // Animation khi đang ghi âm
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
      const existing = await Audio.getPermissionsAsync();
      const { granted, canAskAgain } = existing.granted ? existing : await Audio.requestPermissionsAsync();
      if (!granted) {
        if (!canAskAgain) {
          showConfirm({
            title: 'Cần quyền microphone',
            message: 'Vui lòng vào Cài đặt để cấp quyền microphone cho ứng dụng.',
            confirmLabel: 'Mở Cài đặt',
            cancelLabel: 'Để sau',
            onConfirm: () => Linking.openSettings(),
          });
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
      setErrorMessage('Không thể bắt đầu ghi âm. Thử lại sau.');
      setTimeout(() => setState('idle'), 2500);
    }
  };

  const stopAndProcess = async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    setState('processing');
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('Không lấy được file ghi âm.');

      const result = await voiceParseLogs(uri, logType);

      // Validate số liệu trước khi điền form
      const validationError = validateParsed(result);
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
      const msg = err?.message || 'Xử lý giọng nói thất bại. Thử lại sau.';
      setState('error');
      setErrorMessage(msg);
      onError?.(msg);
      setTimeout(() => { setState('idle'); setErrorMessage(''); }, 3000);
    }
  };

  const handlePress = () => {
    if (premiumLoading) return;

    // Chưa premium → hiện modal nâng cấp
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

  // ─── UI helpers ───────────────────────────────────────────────────

  const iconBg = !isPremium
    ? colors.surfaceMuted
    : state === 'recording'
    ? colors.primary
    : state === 'done'
    ? colors.emeraldLight
    : state === 'error'
    ? '#fef2f2'
    : colors.primaryLight;

  const renderIcon = () => {
    if (premiumLoading) return <ActivityIndicator size="small" color={colors.primary} />;
    if (!isPremium) return <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />;
    if (state === 'processing') return <ActivityIndicator size="small" color={colors.primary} />;
    if (state === 'done') return <Ionicons name="checkmark" size={22} color={colors.emerald} />;
    if (state === 'recording') return <Ionicons name="stop" size={22} color="#fff" />;
    return <Ionicons name="mic" size={22} color={colors.primary} />;
  };

  const voiceHint: Record<string, string> = {
    glucose:        'Nói: "đường huyết 95 lúc đói" hoặc "120 sau ăn"',
    blood_pressure: 'Nói: "huyết áp 120/80" hoặc "tâm thu 130 tâm trương 85"',
    weight:         'Nói: "cân nặng 65 kg" hoặc "65.5 cân"',
    water:          'Nói: "uống 250ml" hoặc "một ly nước 300ml"',
    insulin:        'Nói: "4 đơn vị NovoRapid trước ăn"',
    meal:           'Nói: "bữa sáng 400 kcal" hoặc "cơm trưa"',
  };
  const hint = voiceHint[logType] ?? 'Nói rõ chỉ số sức khoẻ của bạn';

  const mainLabel = !isPremium
    ? 'Nhập bằng giọng nói (Premium)'
    : state === 'recording'
    ? 'Đang ghi... Nhấn để dừng'
    : state === 'processing'
    ? 'Đang xử lý...'
    : state === 'done'
    ? 'Đã điền xong!'
    : state === 'error'
    ? 'Thử lại'
    : 'Nhập bằng giọng nói';

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <>
      {appModal}
      <Pressable
        onPress={handlePress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.container,
          !isPremium && styles.containerLocked,
          pressed && styles.pressed,
        ]}
      >
        <Animated.View style={[styles.iconWrap, { backgroundColor: iconBg }, pulseStyle]}>
          {renderIcon()}
        </Animated.View>

        <View style={styles.textWrap}>
          <Text
            style={[
              styles.label,
              !isPremium && styles.labelLocked,
              state === 'error' && styles.labelError,
              state === 'done' && styles.labelDone,
            ]}
          >
            {mainLabel}
          </Text>

          {state === 'idle' && isPremium && (
            <Text style={styles.hint}>{hint}</Text>
          )}
          {state === 'idle' && !isPremium && (
            <Text style={styles.hint}>Nâng cấp Premium để dùng tính năng này</Text>
          )}
          {state === 'error' && errorMessage ? (
            <Text style={styles.hintError}>{errorMessage}</Text>
          ) : null}
        </View>

        {/* Chỉ hiện khi đang ghi */}
        {state === 'recording' && <View style={styles.recDot} />}

        {/* Badge Premium khi chưa nâng cấp */}
        {!isPremium && !premiumLoading && (
          <View style={styles.premiumBadge}>
            <MaterialCommunityIcons name="crown" size={12} color="#fff" />
          </View>
        )}
      </Pressable>

      {/* Modal nâng cấp Premium */}
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
            <Text style={styles.modalTitle}>Tính năng Premium</Text>
            <Text style={styles.modalDesc}>
              Khai báo số liệu sức khoẻ bằng giọng nói — AI tự động nhận diện
              chỉ số và điền vào form cho bạn.
            </Text>
            <View style={styles.featureList}>
              {[
                'Nhận diện tiếng Việt (Whisper AI)',
                'Tự điền đường huyết, huyết áp',
                'Nhận dạng ngữ cảnh bữa ăn',
              ].map((f) => (
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
                router.push('/subscription');
              }}
            >
              <MaterialCommunityIcons name="crown" size={18} color="#fff" />
              <Text style={styles.upgradeBtnText}>Nâng cấp ngay</Text>
            </Pressable>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => setShowUpgradeModal(false)}
            >
              <Text style={styles.cancelBtnText}>Để sau</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 14,
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
    fontSize: 12,
    color: colors.textSecondary,
  },
  hintError: {
    fontSize: 12,
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
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalDesc: {
    fontSize: 14,
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
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
