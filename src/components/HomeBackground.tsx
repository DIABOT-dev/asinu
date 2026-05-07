import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../hooks/useThemeColors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * Animated background cho HomeScreen.
 *
 * Layer:
 *   1. Linear gradient base — vertical mềm (cream-white → off-white)
 *   2. Blob teal top-right — breathing scale 1.0↔1.08 + opacity 0.4↔0.7, ~7s loop
 *   3. Blob accent gold bottom-left — breathing 1.0↔1.06, ~9s loop (offset phase)
 *   4. Subtle dot grid texture (optional, very low opacity)
 *
 * KHÔNG distract content. Chỉ tạo cảm giác "có hơi thở" cho bg phẳng.
 * Pointer events tắt — không chặn scroll/tap content phía trên.
 */
export function HomeBackground() {
  const { colors, isDark } = useThemeColors();

  // 2 animated values cho 2 blob breathe
  const scale1 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.4)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const opacity2 = useRef(new Animated.Value(0.35)).current;
  // Slow drift Y cho subtle parallax feel
  const driftY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Blob 1 — teal top-right, breathe 7s loop
    const blob1 = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale1, { toValue: 1.08, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(scale1, { toValue: 1.0,  duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity1, { toValue: 0.7, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(opacity1, { toValue: 0.4, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    );
    // Blob 2 — gold bottom-left, breathe 9s loop (phase offset cho async feel)
    const blob2 = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale2, { toValue: 1.06, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(scale2, { toValue: 1.0,  duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity2, { toValue: 0.6,  duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(opacity2, { toValue: 0.35, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    );
    // Drift Y — lên xuống ±10px loop 12s, parallax cảm giác "trôi"
    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(driftY, { toValue: -10, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(driftY, { toValue: 0,   duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    blob1.start();
    blob2.start();
    drift.start();
    return () => { blob1.stop(); blob2.stop(); drift.stop(); };
  }, []);

  // Color tones — match clean off-white theme
  const gradientColors: [string, string, string] = isDark
    ? ['#0f1117', '#13191f', '#0f1117']
    : ['#ffffff', '#fbfbfb', '#f5f5f4'];

  const tealColor = colors.primary;     // #08b8a2 hoặc tương tự
  const goldColor = '#fbbf24';

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {/* Layer 1 — gradient base */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Layer 2 — Blob teal top-right (breathing) */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -SCREEN_W * 0.4,
          right: -SCREEN_W * 0.35,
          width: SCREEN_W * 0.95,
          height: SCREEN_W * 0.95,
          borderRadius: SCREEN_W * 0.5,
          backgroundColor: tealColor,
          opacity: Animated.multiply(opacity1, isDark ? new Animated.Value(0.18) : new Animated.Value(0.12)),
          transform: [
            { scale: scale1 },
            { translateY: driftY },
          ],
        }}
      />

      {/* Layer 3 — Blob gold bottom-left (breathing offset) */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: -SCREEN_W * 0.45,
          left: -SCREEN_W * 0.3,
          width: SCREEN_W * 0.9,
          height: SCREEN_W * 0.9,
          borderRadius: SCREEN_W * 0.5,
          backgroundColor: goldColor,
          opacity: Animated.multiply(opacity2, isDark ? new Animated.Value(0.10) : new Animated.Value(0.08)),
          transform: [
            { scale: scale2 },
            { translateY: Animated.multiply(driftY, new Animated.Value(-0.5)) },
          ],
        }}
      />

      {/* Layer 4 — Subtle vignette ở edges để soft focus content giữa */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.025)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
