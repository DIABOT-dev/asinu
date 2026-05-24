/**
 * Plain "Restore purchases" link — Apple Guideline 3.1.1 requires this
 * to be reachable even when the user IS premium (e.g. they switched
 * App Store account, or signed into a different Asinu account on the
 * same device). Hidden when env.paymentMethod !== 'iap'.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';
import { ScaledText as Text } from '../../components/ScaledText';
import { colors, spacing, typography } from '../../styles';
import { env } from '../../lib/env';
import { restorePurchases } from './iap.service';

type Props = {
  onRestored?: () => void;
};

export function RestoreLink({ onRestored }: Props) {
  const { t } = useTranslation('subscription');
  const [busy, setBusy] = useState(false);

  if (env.paymentMethod !== 'iap') return null;

  const handlePress = async () => {
    setBusy(true);
    try {
      const res = await restorePurchases();
      if (res.restored > 0) {
        Alert.alert(
          t('restoreSuccess'),
          t('restoreSuccessDesc', { count: res.restored }),
        );
        onRestored?.();
      } else {
        Alert.alert(t('restoreNoneTitle'), t('restoreNoneBody'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable style={styles.btn} onPress={handlePress} disabled={busy}>
      {busy ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Text style={styles.text}>{t('restorePurchases')}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  text: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
