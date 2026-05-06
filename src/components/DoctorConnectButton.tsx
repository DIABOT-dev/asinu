import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { colors, spacing } from '../styles';

/**
 * Animated CTA button for "Connect with Doctor" feature.
 *
 * Effects (giống AsinuChatSticker — float + pulse):
 *   1. Pulse scale: 1.0 ↔ 1.04 loop ~1.2s easing sin
 *   2. Glow shadow opacity: 0.25 ↔ 0.55 loop sync với pulse
 *
 * → Hút mắt user, distinguish khỏi action buttons khác trong session card.
 */

type Variant = 'urgent' | 'default';

type Props = {
  text: string;
  onPress: () => void;
  variant?: Variant;
  showIcon?: boolean;
  compact?: boolean;
};

export function DoctorConnectButton({
  text,
  onPress,
  variant = 'default',
  showIcon = false,
  compact = false,
}: Props) {
  // Tách 2 Animated.Value với driver riêng để tránh mix native + JS trên 1 view:
  //   - scale → useNativeDriver:true (transform native-compatible)
  //   - glow  → useNativeDriver:false (shadowOpacity KHÔNG native-compatible)
  // Render 2 Animated.View lồng nhau — outer animate shadow (JS), inner animate
  // transform (native).
  const scale = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    // Loop riêng cho scale (native driver)
    const scaleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.04, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0,  duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    // Loop riêng cho glow (JS driver — shadow không native-compatible)
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.55, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.25, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    scaleLoop.start();
    glowLoop.start();
    return () => { scaleLoop.stop(); glowLoop.stop(); };
  }, [scale, glow]);

  const bg = variant === 'urgent' ? '#dc2626' : colors.primary;
  const padV = compact ? spacing.sm : spacing.md;
  const padH = compact ? spacing.md : spacing.lg;
  const fontSize = compact ? 13 : 15;

  return (
    <Animated.View
      // Outer: shadow animation (JS driver)
      style={[
        styles.wrap,
        {
          shadowColor: bg,
          shadowOpacity: glow as unknown as number,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        },
      ]}
    >
      <Animated.View
        // Inner: transform animation (native driver)
        style={[styles.wrap, { transform: [{ scale }] }]}
      >
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: bg,
              paddingVertical: padV,
              paddingHorizontal: padH,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {showIcon && (
            <Ionicons
              name={variant === 'urgent' ? 'call' : 'medkit'}
              size={compact ? 16 : 18}
              color="#fff"
              style={{ marginRight: spacing.xs }}
            />
          )}
          <Text style={[styles.text, { fontSize }]}>{text}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    alignSelf: 'stretch',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  text: {
    color: '#fff',
    fontWeight: '800',
  },
});
