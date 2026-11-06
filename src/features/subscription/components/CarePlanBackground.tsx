import React from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '../../../hooks/useThemeColors';

const HEART_ART = require('../../../../assets/images/care-circle/scan_header_heart_ecg.png');

/** Decorative only: plan names and controls remain readable native text. */
export function CarePlanBackground() {
  const { isDark } = useThemeColors();
  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={isDark ? ['#14283e', '#101d2c', '#101d2c'] : ['#edf7ff', '#f8fbff', '#f5f9ff']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.headerArtwork}>
        <View style={[styles.wave, { backgroundColor: isDark ? '#1c3a50' : '#dcedfc' }]} />
        <View style={[styles.waveHighlight, { backgroundColor: isDark ? '#172e43' : '#edf8ff' }]} />
        <Image source={HEART_ART} contentFit="contain" tintColor={isDark ? '#518393' : '#8acde5'} style={styles.heart} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerArtwork: { position: 'absolute', top: 0, left: 0, right: 0, height: 280, overflow: 'hidden' },
  wave: { position: 'absolute', width: 660, height: 260, borderRadius: 330, top: -95, left: -140, transform: [{ rotate: '-13deg' }], opacity: 0.75 },
  waveHighlight: { position: 'absolute', width: 580, height: 200, borderRadius: 290, top: -45, left: -135, transform: [{ rotate: '-13deg' }] },
  heart: { position: 'absolute', top: 92, right: -6, width: 170, height: 128, opacity: 0.34 },
});
