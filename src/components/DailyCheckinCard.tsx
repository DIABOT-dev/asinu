import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
/**
 * DailyCheckinCard
 * - No session today → show the quick "I'm fine" action
 * - Session exists, next_checkin_at in future → hide (user already responded)
 * - Session exists, next_checkin_at passed → show follow-up prompt
 * - Session resolved → hide
 */
import { Ionicons } from '@expo/vector-icons';

import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { checkinApi, type CheckinSession } from '../features/checkin/checkin.api';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

// Cache session across hot reloads to prevent flash
let _cachedSession: CheckinSession | null | undefined;

export const DailyCheckinCard = React.memo(function DailyCheckinCard() {
  const router = useRouter();
  const { t } = useTranslation('home');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const [session, setSession] = useState<CheckinSession | null | undefined>(_cachedSession);

  useFocusEffect(
    useCallback(() => {
      checkinApi.getToday()
        .then(res => {
          _cachedSession = res.session;
          setSession(res.session);
        })
        .catch(() => {
          _cachedSession = null;
          setSession(null);
        });
    }, [])
  );

  if (session === undefined) {
    return null; // Don't show loading spinner, wait silently
  }

  // Keep the quick positive check-in available alongside the immediate flow.
  if (!session) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, styles.cardFine, pressed && { opacity: 0.9 }]}
        onPress={() => router.push({ pathname: '/checkin', params: { preset_status: 'fine' } })}
        accessibilityRole="button"
        accessibilityLabel={t('checkinFine')}
      >
        <View style={styles.row}>
          <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
          <View style={styles.textColumn}>
            <Text style={styles.fineTitle}>{t('checkinFine')}</Text>
            <Text style={styles.sub}>{t('checkinFineSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={28} color={colors.primary} />
        </View>
      </Pressable>
    );
  }

  if (session.resolved_at) {
    return null;
  }

  // Triage not completed (user exited mid-flow) → show card to continue
  const triageIncomplete = session.initial_status !== 'fine' && !session.triage_completed_at;

  // The user already responded; wait until the scheduled follow-up.
  if (!triageIncomplete && session.next_checkin_at && new Date(session.next_checkin_at) > new Date()) {
    return null;
  }

  // next_checkin_at passed (or null) → time for follow-up
  const followUpLabel = session.flow_state === 'high_alert'
    ? t('checkinFollowHighAlert')
    : t('checkinFollowDefault');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, styles.cardFollowUp, pressed && { opacity: 0.9 }]}
      onPress={() => router.push(`/checkin?mode=followup&checkin_id=${session.id}`)}
    >
      <View style={styles.row}>
        <Ionicons name="pulse" size={22} color="#d97706" />
        <View style={styles.textColumn}>
          <Text style={styles.followTitle}>{t('checkinFollowTitle')}</Text>
          <Text style={styles.sub}>{followUpLabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#d97706" />
      </View>
    </Pressable>
  );
});

/**
 * Always-visible entry point for an immediate check-in.
 * `mode=random` lets the user start a new check-in before the scheduled follow-up.
 */
export const InstantCheckinCard = React.memo(function InstantCheckinCard() {
  const router = useRouter();
  const { t } = useTranslation('home');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, styles.cardInstant, pressed && { opacity: 0.9 }]}
      onPress={() => router.push({ pathname: '/checkin', params: { mode: 'random' } })}
      accessibilityRole="button"
      accessibilityLabel={t('checkinInstantTitle')}
    >
      <View style={styles.row}>
        <Ionicons name="pulse" size={48} color={colors.premiumDark} />
        <View style={styles.textColumn}>
          <Text style={styles.instantTitle}>{t('checkinInstantTitle')}</Text>
          <Text style={styles.sub}>{t('checkinInstantSub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={28} color={colors.premiumDark} />
      </View>
    </Pressable>
  );
});

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    cardFollowUp: {
      borderColor: colors.border,
      backgroundColor: colors.premiumLight,
    },
    cardFine: {
      minHeight: 184,
      justifyContent: 'center',
      borderRadius: radius.xl,
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
      paddingVertical: spacing.xxl,
    },
    cardInstant: {
      minHeight: 184,
      justifyContent: 'center',
      borderRadius: radius.xl,
      borderColor: colors.premiumDark,
      backgroundColor: colors.premiumLight,
      paddingVertical: spacing.xxl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    textColumn: {
      flex: 1,
      minWidth: 0,
    },
    followTitle:  { fontSize: typography.size.sm, fontWeight: '700', color: '#d97706' },
    fineTitle:    { fontSize: typography.size.xl, fontWeight: '800', color: colors.textPrimary },
    instantTitle: { fontSize: typography.size.lg + 4, fontWeight: '800', color: colors.textPrimary },
    sub:          { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: spacing.xs },
  });
}
