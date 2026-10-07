/**
 * Restore verified Store purchases. This reads the Store account's transactions;
 * it never buys a plan. Hidden when env.paymentMethod !== 'iap'.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
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
  compact?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

export function RestoreLink({ onRestored, compact = false, disabled = false, onBusyChange }: Props) {
  const { t } = useTranslation('subscription');
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const [feedback, setFeedback] = useState<SubscriptionFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const unavailable = busy || disabled;

  if (env.paymentMethod !== 'iap') {
    return null;
  }

  const handlePress = async () => {
    if (busyRef.current || disabled) return;
    busyRef.current = true;
    setBusy(true);
    onBusyChange?.(true);
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
      busyRef.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityHint={t('restorePurchasesDesc')}
        accessibilityLabel={t('restorePurchases')}
        accessibilityRole="button"
        accessibilityState={{ disabled: unavailable, busy }}
        disabled={unavailable}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.btn,
          compact && styles.compactButton,
          pressed && styles.pressed,
          unavailable && styles.busy,
        ]}
      >
        <View style={[styles.leading, compact && styles.compactLeading]}>
          {busy ? (
            <ActivityIndicator size="small" color={compact ? colors.primaryText : colors.primary} />
          ) : (
            <Ionicons name="refresh-outline" size={21} color={compact ? colors.primaryText : colors.primary} />
          )}
          <View style={[styles.copy, compact && styles.compactCopy]}>
            <Text allowFontScaling style={[styles.title, compact && styles.compactTitle]}>{t('restorePurchases')}</Text>
            {!compact ? <Text style={styles.description}>{t('restorePurchasesDesc')}</Text> : null}
          </View>
        </View>
        {!compact ? <Ionicons
          name="chevron-forward"
          size={18}
          color={isDark ? '#64748b' : '#94a3b8'}
        /> : null}
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
    compactButton: {
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: colors.primaryLight,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flexShrink: 1,
      justifyContent: 'center',
      marginTop: 0,
      maxWidth: '100%',
      minHeight: 56,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    compactLeading: {
      alignItems: 'center',
      flex: 0,
      flexDirection: 'row',
      flexShrink: 1,
      gap: spacing.sm,
      justifyContent: 'center',
    },
    compactCopy: {
      flex: 0,
      flexShrink: 1,
    },
    compactTitle: {
      color: colors.primaryText,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
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
