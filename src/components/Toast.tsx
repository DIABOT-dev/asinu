import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../styles';
import { ScaledText } from './ScaledText';

type ToastType = 'success' | 'error';
type ToastPosition = 'top' | 'bottom' | 'center';

type ToastProps = {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  position?: ToastPosition;
  onHide?: () => void;
};

const ICON: Record<ToastType, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  success: 'check-circle',
  error: 'alert-circle',
};

const ACCENT: Record<ToastType, string> = {
  success: colors.primary,
  error: colors.danger,
};

export const Toast = ({
  visible,
  message,
  type = 'success',
  duration = 2000,
  position = 'top',
  onHide,
}: ToastProps) => {
  const [isHidden, setIsHidden] = useState(!visible);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setIsHidden(false);
      opacity.setValue(0);
      translateY.setValue(position === 'top' ? -20 : 20);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
          Animated.timing(translateY, {
            toValue: position === 'top' ? -16 : 16,
            duration: 220,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsHidden(true);
          onHide?.();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setIsHidden(true);
    }
  }, [visible, duration, onHide]);

  if (isHidden) return null;

  const getPositionStyle = () => {
    const screenHeight = Dimensions.get('window').height;
    if (position === 'center') {
      return { top: screenHeight / 2 - 36, left: spacing.lg, right: spacing.lg };
    }
    if (position === 'bottom') {
      return { bottom: insets.bottom + spacing.xl, left: spacing.lg, right: spacing.lg };
    }
    // top: positioned at 1/4 of screen (between top edge and center)
    return { top: screenHeight * 0.25 - 36, left: spacing.lg, right: spacing.lg };
  };

  const accent = ACCENT[type];

  return (
    <Animated.View
      style={[
        styles.container,
        getPositionStyle(),
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: accent + '28' }]}>
        <MaterialCommunityIcons name={ICON[type]} size={20} color={accent} />
      </View>
      <ScaledText style={styles.message} numberOfLines={2}>
        {message}
      </ScaledText>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 14,
    zIndex: 9999,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
