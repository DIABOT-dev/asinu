import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';

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
  bg: string;
  iconBg: string;
  iconColor: string;
}> = {
  success: {
    icon: 'check-circle',
    bg: colors.primary,
    iconBg: 'rgba(255,255,255,0.2)',
    iconColor: '#fff',
  },
  error: {
    icon: 'alert-circle',
    bg: colors.danger,
    iconBg: 'rgba(255,255,255,0.2)',
    iconColor: '#fff',
  },
};

export const Toast = ({
  visible,
  message,
  type = 'success',
  duration = 2000,
  onHide,
}: ToastProps) => {
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    card: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.xxl,
      minWidth: 200,
      maxWidth: 280,
      gap: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 15,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    message: {
      color: '#fff',
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 24,
    },
  }), []);
  const [show, setShow] = useState(false);
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShow(true);
      scale.setValue(0.6);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
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
        <Animated.View style={[styles.card, { backgroundColor: cfg.bg, opacity, transform: [{ scale }] }]}>
          <View style={[styles.iconWrap, { backgroundColor: cfg.iconBg }]}>
            <MaterialCommunityIcons name={cfg.icon} size={36} color={cfg.iconColor} />
          </View>
          <Text style={[styles.message, { fontSize: scaledTypography.size.md }]}>
            {message}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
};
