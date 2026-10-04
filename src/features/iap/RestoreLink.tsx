/**
 * Plain "Restore purchases" link — Apple Guideline 3.1.1 requires this
 * to be reachable even when the user has an active plan (e.g. they switched
 * App Store account, or signed into a different Asinu account on the
 * same device). Hidden when env.paymentMethod !== 'iap'.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { colors, spacing, typography } from '../../styles';
import { env } from '../../lib/env';
import { restorePurchases } from './iap.service';
import { SubscriptionFeedbackModal, type SubscriptionFeedback } from './SubscriptionFeedbackModal';

type Props = {
  onRestored?: () => void;
};

export function RestoreLink({ onRestored }: Props) {
  const { t } = useTranslation('subscription');
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const [feedback, setFeedback] = useState<SubscriptionFeedback | null>(null);
  const [busy, setBusy] = useState(false);

  if (env.paymentMethod !== 'iap') {
    return null;
  }

  const handlePress = async () => {
    setBusy(true);
    try {
      const res = await restorePurchases();
      if (res.restored > 0) {
        onRestored?.();
        setFeedback({
          kind: 'success',
          title: t('restoreSuccess'),
          message: t('restoreSuccessDesc', { count: res.restored }),
        });
      } else if (res.errors.length > 0) {
        if (res.errors.includes('IAP_SUBSCRIPTION_EXPIRED')) {
          setFeedback({
            kind: 'warning',
            title: t('iapRestoreExpiredTitle'),
            message: t('iapRestoreExpiredBody'),
          });
        } else {
          setFeedback({
            kind: 'error',
            title: t('iapRestoreFailedTitle'),
            message: t('iapRestoreFailedBody'),
          });
        }
      } else {
        setFeedback({
          kind: 'info',
          title: t('restoreNoneTitle'),
          message: t('restoreNoneBody'),
        });
      }
    } catch (error) {
      console.warn('[iap] restore action failed', error);
      setFeedback({
        kind: 'error',
        title: t('iapRestoreFailedTitle'),
        message: t('iapRestoreFailedBody'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityHint={t('restorePurchasesDesc')}
        accessibilityLabel={t('restorePurchases')}
        accessibilityRole="button"
        disabled={busy}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.btn,
          pressed && styles.pressed,
          busy && styles.busy,
        ]}
      >
        <View style={styles.leading}>
          {busy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh-outline" size={21} color={colors.primary} />
          )}
          <View style={styles.copy}>
            <Text style={styles.title}>{t('restorePurchases')}</Text>
            <Text style={styles.description}>{t('restorePurchasesDesc')}</Text>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={isDark ? '#64748b' : '#94a3b8'}
        />
      </Pressable>
      <SubscriptionFeedbackModal feedback={feedback} onDismiss={() => setFeedback(null)} />
    </>
  );
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    btn: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.lg,
      minHeight: 60,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
    },
    pressed: {
      opacity: 0.68,
    },
    busy: {
      opacity: 0.72,
    },
    leading: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      minWidth: 0,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: isDark ? '#f8fafc' : '#0f172a',
      fontSize: typography.size.sm,
      fontWeight: '700',
      lineHeight: 20,
    },
    description: {
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: typography.size.xs,
      lineHeight: 17,
      marginTop: 2,
    },
  });
}
