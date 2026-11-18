import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Pressable, StyleSheet } from 'react-native';
import { ScaledText as Text } from '../../components/ScaledText';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useThemeColors } from '../../hooks/useThemeColors';
import { ApiError } from '../../lib/apiClient';
import { subscribeHealthAction } from '../../lib/health-action-events';
import { useAuthStore } from '../auth/auth.store';
import { HealthCoinIcon } from './HealthCoinIcon';
import { v21Api } from './v21.api';

export function HomeCoinBalance() {
  const owner = useAuthStore(state => state.profile?.id);
  const token = useAuthStore(state => state.token);
  const router = useGuardedRouter();
  const { t, i18n } = useTranslation('v21');
  const { colors } = useThemeColors();
  const [snapshot, setSnapshot] = useState<{ owner: string; token: string; balance: number }>();

  useFocusEffect(useCallback(() => {
    if (!owner || !token) return;
    let active = true;
    let latest = 0;
    const refresh = async () => {
      const request = ++latest;
      const current = () => active && request === latest &&
        useAuthStore.getState().profile?.id === owner && useAuthStore.getState().token === token;
      try {
        const { balance } = await v21Api.coins();
        if (current() && Number.isFinite(balance)) setSnapshot({ owner, token, balance });
      } catch (error) {
        if (current() && error instanceof ApiError && [401, 403, 404].includes(error.statusCode)) setSnapshot(undefined);
      }
    };
    void refresh();
    const unsubscribe = subscribeHealthAction(() => void refresh());
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => { active = false; unsubscribe(); appState.remove(); };
  }, [owner, token]));

  if (!snapshot || snapshot.owner !== owner || snapshot.token !== token) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('balance', { count: snapshot.balance })}
      accessibilityHint={t('coinsTitle')}
      onPress={() => router.push('/coins')}
      style={({ pressed }) => [styles.badge, { backgroundColor: colors.premiumLight }, pressed && styles.pressed]}
    >
      <HealthCoinIcon size={25} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.amount, { color: colors.textPrimary }]}>
        {snapshot.balance.toLocaleString(i18n.language.startsWith('en') ? 'en-US' : 'vi-VN')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { minHeight: 44, maxWidth: 118, paddingHorizontal: 8, gap: 4, borderRadius: 22, flexDirection: 'row', alignItems: 'center' },
  amount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1 },
  pressed: { opacity: 0.75 },
});
