import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../auth/auth.store';
import { AsinuAssistantDialog } from './AsinuAssistantDialog';

export const ASINU_ASSISTANT_IMAGE = require('../../../assets/asinu_assistant_listening_v1.png');

export function AsinuAssistantButton() {
  const { t } = useTranslation('settings');
  const token = useAuthStore(state => state.token);
  const [open, setOpen] = useState(false);
  useFocusEffect(useCallback(() => () => setOpen(false), []));
  useEffect(() => { setOpen(false); }, [token]);
  return <>
    <Pressable testID="home-asinu-assistant" accessibilityRole="button"
      accessibilityLabel={t('appAssistant.open')} accessibilityHint={t('appAssistant.openHint')}
      onPress={() => setOpen(true)}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.75, transform: [{ scale: 0.94 }] }]}>
      <Image source={ASINU_ASSISTANT_IMAGE} resizeMode="contain" resizeMethod="resize" style={styles.image} accessible={false} />
    </Pressable>
    {open && token && <AsinuAssistantDialog onClose={() => setOpen(false)} />}
  </>;
}
const styles = StyleSheet.create({
  button: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  image: { width: 58, height: 58 },
});
