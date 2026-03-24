import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

type ToastType = 'success' | 'error';

type ToastProps = {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
};

const CONFIG: Record<ToastType, {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconBg: string;
  iconColor: string;
  accentColor: string;
  label: string;
}> = {
  success: {
    icon: 'check-circle-outline',
    iconBg: '#e6faf8',
    iconColor: '#08b8a2',
    accentColor: '#08b8a2',
    label: 'Thành công',
  },
  error: {
    icon: 'alert-circle-outline',
    iconBg: '#fef2f2',
    iconColor: '#e05252',
    accentColor: '#e05252',
    label: 'Thông báo',
  },
};

export const Toast = ({
  visible,
  message,
  type = 'success',
  duration = 2500,
  onHide,
}: ToastProps) => {
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();

  const cardBg = isDark ? '#1e2a29' : '#ffffff';
  const textPrimary = isDark ? '#f0faf9' : '#1a2e2b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    card: {
      alignItems: 'center',
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.xxl,
      borderRadius: radius.xxl,
      minWidth: 220,
      maxWidth: 300,
      gap: spacing.sm,
      borderWidth: 1.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 12,
    },
    iconWrap: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    label: {
      fontWeight: '700',
      textAlign: 'center',
    },
    message: {
      fontWeight: '400',
      textAlign: 'center',
      lineHeight: 22,
    },
  }), [isDark]);

  const [show, setShow] = useState(false);
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShow(true);
      scale.setValue(0.7);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.85, duration: 180, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => {
          setShow(false);
          onHide?.();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [visible, duration, onHide]);

  if (!show) return null;

  const cfg = CONFIG[type];

  return (
    <Modal visible={show} transparent animationType="none">
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: cfg.accentColor + '55',
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: cfg.iconBg }]}>
            <MaterialCommunityIcons name={cfg.icon} size={38} color={cfg.iconColor} />
          </View>

          {/* Label */}
          <Text style={[styles.label, { fontSize: scaledTypography.size.md, color: cfg.accentColor }]}>
            {cfg.label}
          </Text>

          {/* Message */}
          <Text style={[styles.message, { fontSize: scaledTypography.size.sm, color: textSecondary }]}>
            {message}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
};
