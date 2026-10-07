import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { showToast } from '../../stores/toast.store';
import { useGuidanceStore } from './guidance.store';
import { guideColors as c } from './guidance.model';

export function useReviewGuidance() {
  const router = useGuardedRouter();
  const { t } = useTranslation('onboarding');
  const busy = useRef(false);
  return async () => {
    if (busy.current) return;
    busy.current = true;
    const account = useGuidanceStore.getState().account;
    try {
      await useGuidanceStore.getState().replay();
      if (useGuidanceStore.getState().account !== account) return;
      router.replace('/(tabs)/home');
    } catch { if (useGuidanceStore.getState().account === account) showToast(t('guidance.reviewError'), 'error'); }
    finally { busy.current = false; }
  };
}

export function GuidanceSettings() {
  const { t } = useTranslation('onboarding');
  const { progress, ready, update } = useGuidanceStore();
  const review = useReviewGuidance();
  const [busy, setBusy] = useState(false);
  return <View style={styles.container}>
    <View style={styles.row}>
      <Text allowFontScaling style={styles.label}>{t('guidance.readAloud')}</Text>
      <Switch value={progress.readAloud} disabled={!ready} accessibilityLabel={t('guidance.readAloud')}
        onValueChange={readAloud => update({ readAloud })} trackColor={{ true: c.primary }} />
    </View>
    <Pressable disabled={!ready || busy} accessibilityRole="button" accessibilityLabel={t('guidance.review')}
      onPress={() => { setBusy(true); void review().finally(() => setBusy(false)); }} style={styles.row}>
      <Ionicons name="book-outline" size={28} color={c.primary} />
      <Text allowFontScaling style={styles.label}>{t('guidance.review')}</Text>
      <Ionicons name="chevron-forward" size={24} color={c.primary} />
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  container: { backgroundColor: c.background, borderRadius: 18, borderColor: c.border, borderWidth: 1 },
  row: { minHeight: 60, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 22, color: c.ink, fontWeight: '700', flex: 1 },
});
