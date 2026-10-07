import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { showToast } from '../../stores/toast.store';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useGuidanceStore } from './guidance.store';
import { ScaledText as Text } from '../../components/ScaledText';

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

export function GuidanceSettings({ style, labelStyle }: { style?: StyleProp<ViewStyle>; labelStyle?: StyleProp<TextStyle> } = {}) {
  const { t } = useTranslation('onboarding');
  const { colors } = useThemeColors();
  const { ready } = useGuidanceStore();
  const review = useReviewGuidance();
  const [busy, setBusy] = useState(false);
  return <Pressable disabled={!ready || busy} accessibilityRole="button" accessibilityLabel={t('guidance.review')}
      accessibilityState={{ disabled: !ready || busy, busy }}
      onPress={() => { setBusy(true); void review().finally(() => setBusy(false)); }}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.border }, style,
        { opacity: !ready || busy ? 0.5 : pressed ? 0.8 : 1 }]}>
      <View style={styles.iconWrap}><Ionicons name="book-outline" size={22} color={colors.primaryText} /></View>
      <Text style={[styles.label, { color: colors.textPrimary }, labelStyle]}>{t('guidance.review')}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>;
}
const styles = StyleSheet.create({
  row: { minHeight: 44, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  label: { fontSize: 15, fontWeight: '600', flex: 1 },
});
