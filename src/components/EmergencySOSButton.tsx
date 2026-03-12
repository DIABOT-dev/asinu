/**
 * Emergency SOS Button
 * Press-and-hold 2 seconds to confirm → alerts care circle + sends location.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { useModal } from '../hooks/useModal';
import { checkinApi } from '../features/checkin/checkin.api';
import { colors, radius, spacing } from '../styles';

export function EmergencySOSButton() {
  const router = useRouter();
  const { showInfo, modal } = useModal();
  const [loading, setLoading] = useState(false);
  const pressProgress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);

  const startHold = () => {
    holdAnim.current = Animated.timing(pressProgress, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    });
    holdAnim.current.start(({ finished }) => {
      if (finished) triggerSOS();
    });
  };

  const cancelHold = () => {
    holdAnim.current?.stop();
    Animated.timing(pressProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const triggerSOS = async () => {
    setLoading(true);
    try {
      let location: { lat: number; lng: number; accuracy?: number } | undefined;

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        location = {
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
        };
      }

      const result = await checkinApi.emergency(location);

      showInfo('Đã gửi tín hiệu khẩn cấp', result.message);
    } catch {
      showInfo('Lỗi', 'Không gửi được tín hiệu khẩn cấp. Vui lòng gọi 115 trực tiếp.');
    } finally {
      setLoading(false);
      pressProgress.setValue(0);
    }
  };

  const ringWidth = pressProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.wrapper}>
      {modal}
      <Pressable
        onPressIn={startHold}
        onPressOut={cancelHold}
        style={({ pressed }) => [
          styles.button,
          pressed && { transform: [{ scale: 0.96 }] },
          loading && { opacity: 0.7 },
        ]}
        disabled={loading}
      >
        {/* Progress ring */}
        <Animated.View style={[styles.progressRing, { width: ringWidth }]} />

        <Ionicons name="warning" size={20} color="#fff" />
        <Text style={styles.label}>SOS</Text>
      </Pressable>
      <Text style={styles.hint}>Giữ 2 giây để gửi</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 4 },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dc2626',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    overflow: 'hidden',
    position: 'relative',
    minWidth: 80,
    justifyContent: 'center',
  },

  progressRing: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  label: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  hint:  { fontSize: 10, color: colors.textSecondary },
});
