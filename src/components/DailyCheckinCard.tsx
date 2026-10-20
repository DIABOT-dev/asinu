import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
/**
 * DailyCheckinCard
 * - No session today → show the quick "I'm fine" action
 * - Session exists, next_checkin_at in future → hide (user already responded)
 * - Session exists, next_checkin_at passed → show follow-up prompt
 * - Session resolved → hide
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { checkinApi, type CheckinSession } from '../features/checkin/checkin.api';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';
import { GuideTarget } from '../features/guidance/GuidanceProvider';
import { useCheckinPracticeEntry } from '../features/guidance/useCheckinPracticeEntry';

// Cache session across hot reloads to prevent flash
let _cachedSession: CheckinSession | null | undefined;

const checkinCardImages = {
  fine: require('../../assets/images/home/checkin-fine-background-v1.png'),
  unwell: require('../../assets/images/home/checkin-unwell-background-v1.png'),
};

const checkinCardLightTones = {
  fine: {
    background: '#f1faf7',
    border: '#50b7aa',
    overlay: ['rgba(235, 250, 246, 0.90)', 'rgba(245, 252, 249, 0.72)', 'rgba(245, 252, 249, 0.06)'],
  },
  unwell: {
    background: '#fff9ed',
    border: '#df8a30',
    overlay: ['rgba(255, 247, 226, 0.90)', 'rgba(255, 250, 239, 0.72)', 'rgba(255, 250, 239, 0.06)'],
  },
} as const;

function CheckinCardBackground({ tone, isDark }: { tone: keyof typeof checkinCardImages; isDark: boolean }) {
  const lightTone = checkinCardLightTones[tone];
  const tint = isDark
    ? (tone === 'fine' ? colors.primaryLight : colors.premiumLight)
    : lightTone.background;
  const overlayColors: readonly [string, string, string] = isDark
    ? [`${tint}fa`, `${tint}f0`, `${tint}de`]
    : lightTone.overlay;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[artworkStyles.frame, { backgroundColor: tint }]}
    >
      <Image
        source={checkinCardImages[tone]}
        style={artworkStyles.fill}
        contentFit="cover"
        contentPosition="center"
        accessible={false}
      />
      <LinearGradient
        colors={overlayColors}
        locations={[0, 0.46, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={artworkStyles.fill}
      />
    </View>
  );
}

export const DailyCheckinCard = React.memo(function DailyCheckinCard() {
  const router = useRouter();
  const practice = useCheckinPracticeEntry();
  const { t } = useTranslation('home');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography, isDark), [scaledTypography, isDark]);
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
      <GuideTarget step="home.fine">
      <Pressable
        style={({ pressed }) => [styles.card, styles.cardFine, pressed && { opacity: 0.9 }]}
        onPress={() => router.push({ pathname: '/checkin', params: { preset_status: 'fine', ...(practice ? { mode: 'guide' } : {}) } })}
        accessibilityRole="button"
        accessibilityLabel={t('checkinFine')}
      >
        <CheckinCardBackground tone="fine" isDark={isDark} />
        <View style={styles.row}>
          <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
          <View style={styles.textColumn}>
            <Text allowFontScaling style={styles.fineTitle}>{t('checkinFine')}</Text>
            <Text style={styles.sub}>{t('checkinFineSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={28} color={colors.primary} />
        </View>
      </Pressable>
      </GuideTarget>
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
  const practice = useCheckinPracticeEntry();
  const { t } = useTranslation('home');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography, isDark), [scaledTypography, isDark]);

  return (
    <GuideTarget step="home.unwell">
    <Pressable
      style={({ pressed }) => [styles.card, styles.cardInstant, pressed && { opacity: 0.9 }]}
      onPress={() => router.push({ pathname: '/checkin', params: { mode: practice ? 'guide' : 'random' } })}
      accessibilityRole="button"
      accessibilityLabel={t('checkinInstantTitle')}
    >
      <CheckinCardBackground tone="unwell" isDark={isDark} />
      <View style={styles.row}>
        <Ionicons name="pulse" size={48} color={colors.premiumDark} />
        <View style={styles.textColumn}>
          <Text allowFontScaling style={styles.instantTitle}>{t('checkinInstantTitle')}</Text>
          <Text style={styles.sub}>{t('checkinInstantSub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={28} color={colors.premiumDark} />
      </View>
    </Pressable>
    </GuideTarget>
  );
});

const artworkStyles = StyleSheet.create({
  frame: {
    position: 'absolute',
    top: 1.5,
    right: 1.5,
    bottom: 1.5,
    left: 1.5,
    borderRadius: radius.xl - 1.5,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});

function createStyles(typography: ReturnType<typeof useScaledTypography>, isDark: boolean) {
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
      borderColor: isDark ? colors.primary : checkinCardLightTones.fine.border,
      backgroundColor: isDark ? colors.primaryLight : checkinCardLightTones.fine.background,
      paddingVertical: spacing.xxl,
    },
    cardInstant: {
      minHeight: 184,
      justifyContent: 'center',
      borderRadius: radius.xl,
      borderColor: isDark ? colors.premiumDark : checkinCardLightTones.unwell.border,
      backgroundColor: isDark ? colors.premiumLight : checkinCardLightTones.unwell.background,
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
