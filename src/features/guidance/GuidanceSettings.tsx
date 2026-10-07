import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { showToast } from '../../stores/toast.store';
import { useGuidanceStore } from './guidance.store';
import { guideColors as c } from './guidance.model';

export function useReviewGuidance(destination: 'home' | 'checkin' = 'home') {
  const router = useGuardedRouter();
  const { t } = useTranslation('onboarding');
  const busy = useRef(false);
  return async () => {
    if (busy.current) return;
    busy.current = true;
    const account = useGuidanceStore.getState().account;
    try {
      if (destination === 'checkin') {
        router.replace({ pathname: '/checkin', params: { mode: 'guide', guide: String(Date.now()) } });
        return;
      }
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
        onValueChange={readAloud => update({ readAloud })} trackColor={{ true: c.actionBackground }} />
    </View>
    <Pressable disabled={!ready || busy} accessibilityRole="button" accessibilityLabel={t('guidance.review')}
      accessibilityState={{ disabled: !ready || busy, busy }}
      onPress={() => { setBusy(true); void review().finally(() => setBusy(false)); }}
      style={({ pressed }) => [styles.row, styles.reviewAction, { opacity: !ready || busy ? 0.5 : pressed ? 0.8 : 1 }]}>
      <Ionicons name="book-outline" size={28} color={c.onAction} />
      <Text allowFontScaling style={[styles.label, styles.reviewLabel]}>{t('guidance.review')}</Text>
      <Ionicons name="chevron-forward" size={24} color={c.onAction} />
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  container: { backgroundColor: c.background, borderRadius: 18, borderColor: c.border, borderWidth: 1 },
  row: { minHeight: 60, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 22, color: c.ink, fontWeight: '700', flex: 1 },
  reviewAction: { backgroundColor: c.actionBackground, borderRadius: 18 },
  reviewLabel: { color: c.onAction },
});
