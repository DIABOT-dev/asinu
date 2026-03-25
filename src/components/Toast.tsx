import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -120, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => onHide?.());
      }, duration);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-120);
      opacity.setValue(0);
    }
  }, [visible, duration]);

  const cfg = CONFIG[type];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          top: insets.top + spacing.sm,
          backgroundColor: cfg.bg,
          borderColor: cfg.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <MaterialCommunityIcons name={cfg.icon} size={scaledTypography.size.lg} color={cfg.color} />
      <Text style={[styles.message, { fontSize: scaledTypography.size.sm, color: cfg.color }]}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 9999,
  },
  message: {
    flex: 1,
    fontWeight: '500',
  },
});
