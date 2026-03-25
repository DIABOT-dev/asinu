import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { radius, spacing } from '../styles';

export type ToastType = 'success' | 'error';

export type ToastProps = {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
};

const CONFIG = {
  success: {
    icon: 'check-circle' as const,
    color: '#08b8a2',
    bg: '#f0fdfb',
    border: '#08b8a2',
  },
  error: {
    icon: 'alert-circle' as const,
    color: '#e05252',
    bg: '#fef2f2',
    border: '#e05252',
  },
};

export const Toast = ({ visible, message, type = 'success', duration = 2500, onHide }: ToastProps) => {
  const scaledTypography = useScaledTypography();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 7, tension: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.85, duration: 200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => onHide?.());
      }, duration);

      return () => clearTimeout(timer);
    } else {
      scale.setValue(0.85);
      opacity.setValue(0);
    }
  }, [visible, duration]);

  const cfg = CONFIG[type];

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { opacity }]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: cfg.bg,
            borderColor: cfg.border,
            transform: [{ scale }],
          },
        ]}
      >
        <MaterialCommunityIcons name={cfg.icon} size={scaledTypography.size.lg} color={cfg.color} />
        <Text style={[styles.message, { fontSize: scaledTypography.size.sm, color: cfg.color }]}>
          {message}
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: Dimensions.get('window').width - spacing.lg * 2,
    minWidth: 200,
  },
  message: {
    flex: 1,
    fontWeight: '500',
  },
});
