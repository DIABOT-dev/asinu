import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useThemeColors } from '../../hooks/useThemeColors';

/** Quiet medical details stay at the edges so profile rows remain easy to read. */
export function ProfileHealthcareBackground() {
  const { isDark } = useThemeColors();
  const detailColor = isDark ? '#76B7AE' : '#78B9AE';

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.background]}
    >
      <LinearGradient
        colors={isDark
          ? ['#14282D', '#101D29', '#101D29', '#142B2D']
          : ['#F0F8F7', '#FCFDFD', '#FCFDFD', '#EDF7F4']}
        locations={[0, 0.25, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={170} height={154} viewBox="0 0 180 160" style={styles.heart}>
        <Path
          d="M90 142C62 121 22 92 22 59C22 25 64 15 90 47C116 15 158 25 158 59C158 92 118 121 90 142Z"
          fill={detailColor}
          opacity={isDark ? 0.08 : 0.07}
        />
        <Path
          d="M24 82H59L72 62L88 105L103 72L115 82H156"
          fill="none"
          stroke={detailColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={isDark ? 0.18 : 0.15}
        />
      </Svg>
      <Svg width={76} height={76} viewBox="0 0 80 80" style={styles.cross}>
        <Path
          d="M31 12H49V31H68V49H49V68H31V49H12V31H31Z"
          fill="none"
          stroke={detailColor}
          strokeWidth={2}
          strokeLinejoin="round"
          opacity={isDark ? 0.13 : 0.11}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { overflow: 'hidden' },
  heart: { position: 'absolute', top: -18, right: -28 },
  cross: { position: 'absolute', bottom: 24, left: -20 },
});
