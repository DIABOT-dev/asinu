/**
 * DailyCheckinCard
 * - No session today → show morning prompt
 * - Session exists, next_checkin_at in future → hide (user already responded)
 * - Session exists, next_checkin_at passed → show follow-up prompt
 * - Session resolved → hide
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { checkinApi, type CheckinSession } from '../features/checkin/checkin.api';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

function getCheckinGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t('checkinGreetingMorning');
  if (hour < 14) return t('checkinGreetingAfternoon');
  if (hour < 18) return t('checkinGreetingEvening2');
  return t('checkinGreetingEvening');
}

// Cache session across hot reloads to prevent flash
let _cachedSession: CheckinSession | null | undefined = undefined;

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

  // No session today → initial morning check-in
  if (!session) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, styles.cardPrompt, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/checkin')}
      >
        <View style={styles.row}>
          <Ionicons name="heart-half" size={24} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.promptTitle}>{t('checkinTitle')}</Text>
            <Text style={styles.sub}>{getCheckinGreeting(t)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </View>
      </Pressable>
    );
  }

  // Session resolved → nothing to show
  if (session.resolved_at) return null;

  // Triage not completed (user exited mid-flow) → show card to continue
  const triageIncomplete = session.initial_status !== 'fine' && !session.triage_completed_at;

  // next_checkin_at in future → user already responded, hide card
  // BUT if triage is incomplete, still show card
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
        <View style={{ flex: 1 }}>
          <Text style={styles.followTitle}>{t('checkinFollowTitle')}</Text>
          <Text style={styles.sub}>{followUpLabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#d97706" />
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
    cardPrompt: {
      borderColor: colors.primary + '44',
      backgroundColor: colors.primaryLight,
    },
    cardFollowUp: {
      borderColor: '#d97706' + '44',
      backgroundColor: colors.premiumLight,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    promptTitle:  { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary },
    followTitle:  { fontSize: typography.size.sm, fontWeight: '700', color: '#d97706' },
    sub:          { fontSize: typography.size.xs, color: colors.textSecondary, marginTop: 2 },
  });
}
