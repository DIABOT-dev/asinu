/**
 * DailyCheckinCard
 * - No session today → show morning prompt
 * - Session exists, next_checkin_at in future → hide (user already responded)
 * - Session exists, next_checkin_at passed → show follow-up prompt
 * - Session resolved → hide
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { checkinApi, type CheckinSession } from '../features/checkin/checkin.api';
import { colors, radius, spacing } from '../styles';

export function DailyCheckinCard() {
  const router = useRouter();
  const [session, setSession] = useState<CheckinSession | null | undefined>(undefined);

  useEffect(() => {
    checkinApi.getToday()
      .then(res => setSession(res.session))
      .catch(() => setSession(null));
  }, []);

  if (session === undefined) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  // No session today → initial morning check-in
  if (!session) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, styles.cardPrompt, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/checkin')}
      >
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons name="heart-half" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.promptTitle}>Check-in sức khoẻ</Text>
            <Text style={styles.sub}>Hôm nay bạn cảm thấy thế nào?</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </View>
      </Pressable>
    );
  }

  // Session resolved → nothing to show
  if (session.resolved_at) return null;

  // next_checkin_at in future → user already responded, hide card
  if (session.next_checkin_at && new Date(session.next_checkin_at) > new Date()) {
    return null;
  }

  // next_checkin_at passed (or null) → time for follow-up
  const followUpLabel = session.flow_state === 'high_alert'
    ? 'Asinu cần kiểm tra lại tình trạng của bạn'
    : 'Đã đến giờ cập nhật sức khoẻ';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, styles.cardFollowUp, pressed && { opacity: 0.9 }]}
      onPress={() => router.push(`/checkin?mode=followup&checkin_id=${session.id}`)}
    >
      <View style={styles.row}>
        <View style={styles.iconWrapFollow}>
          <Ionicons name="pulse" size={22} color="#d97706" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.followTitle}>Cập nhật sức khoẻ</Text>
          <Text style={styles.sub}>{followUpLabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#d97706" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#fef3c7',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary + '22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapFollow: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: '#d97706' + '22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptTitle:  { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  followTitle:  { fontSize: 15, fontWeight: '700', color: '#d97706' },
  sub:          { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
