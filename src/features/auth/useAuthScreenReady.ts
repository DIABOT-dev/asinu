import { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import { loadAsync } from 'expo-font';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export const authScreenLogo = require('../../../assets/icon.png');
let assetsReady = false;
let preparation: Promise<void> | undefined;

/** Both auth screens use the same bundled assets; prepare them once per app run. */
export function prepareAuthScreenAssets(): Promise<void> {
  preparation ??= Promise.allSettled([
    Asset.loadAsync(authScreenLogo),
    loadAsync({ ...Ionicons.font, ...MaterialCommunityIcons.font, ...FontAwesome5.font }),
  ]).then(() => {
    // An asset error must not trap someone outside their account.
    assetsReady = true;
  });
  return preparation;
}

export function useAuthScreenReady(): boolean {
  const [ready, setReady] = useState(() => assetsReady);
  useEffect(() => {
    if (assetsReady) { setReady(true); return; }
    let active = true;
    void prepareAuthScreenAssets().then(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);
  return ready;
}
