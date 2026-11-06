import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { AppState, StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

const OCEAN_LOOP = require('../../../assets/images/profile/profile-ocean-wave-loop-v2.webp');
const OCEAN_POSTER = require('../../../assets/images/profile/profile-ocean-wave-poster-v2.webp');

/** Bundled ocean footage: each frame changes the water and foam, with no audio. */
export function ProfileOceanWave() {
  const reducedMotion = useReducedMotion();
  const [foreground, setForeground] = useState(false);
  const [failed, setFailed] = useState(false);

  useFocusEffect(useCallback(() => {
    let focused = true;
    setForeground(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      if (focused) setForeground(state === 'active');
    });
    return () => {
      focused = false;
      subscription.remove();
      setForeground(false);
    };
  }, []));

  const playing = foreground && !reducedMotion && !failed;
  return (
    <Image
      // Remounting releases the animated decoder on blur/background, including web.
      key={playing ? 'ocean-loop' : 'ocean-poster'}
      source={playing ? OCEAN_LOOP : OCEAN_POSTER}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      autoplay={playing}
      transition={0}
      accessible={false}
      onError={playing ? () => setFailed(true) : undefined}
    />
  );
}
