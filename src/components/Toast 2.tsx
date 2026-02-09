import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../styles';

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

export const Toast = ({ visible, message, type = 'success', duration = 2000, position = 'center', onHide }: ToastProps) => {
  const [isHidden, setIsHidden] = useState(!visible);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setIsHidden(false);
      opacity.setValue(0);
      scale.setValue(0.8);
      
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.8,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsHidden(true);
          onHide?.();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else if (!visible) {
      setIsHidden(true);
    }
  }, [visible, duration, onHide]);

  if (isHidden) {
    return null;
  }

  const getPositionStyle = () => {
    const screenHeight = Dimensions.get('window').height;
    
    if (position === 'center') {
      return {
        top: screenHeight / 2 - 50,
        left: spacing.lg,
        right: spacing.lg,
      };
    } else if (position === 'bottom') {
      return {
        bottom: insets.bottom + spacing.xl,
        left: spacing.lg,
        right: spacing.lg,
      };
    } else {
      return {
        top: insets.top + spacing.xl,
        left: spacing.lg,
        right: spacing.lg,
      };
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        type === 'error' ? styles.errorContainer : styles.successContainer,
        getPositionStyle(),
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    borderRadius: 16,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
    minHeight: 60,
    justifyContent: 'center',
  },
  successContainer: {
    backgroundColor: colors.success,
  },
  errorContainer: {
    backgroundColor: colors.danger,
  },
  message: {
    color: '#FFFFFF',
    fontSize: typography.size.lg,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
});
