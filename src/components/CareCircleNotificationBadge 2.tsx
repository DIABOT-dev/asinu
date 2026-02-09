import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../features/auth/auth.store';
import { useCareCircle } from '../features/care-circle';
import { colors, spacing, typography } from '../styles'; 

export function CareCircleNotificationBadge() {
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const { invitations, fetchInvitations } = useCareCircle();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchInvitations();
  }, []);

  useEffect(() => {
    // Count invitations where current user is addressee and status is pending
    const count = invitations.filter(
      (inv) => inv.addressee_id === profile?.id && inv.status === 'pending'
    ).length;
    setPendingCount(count);
  }, [invitations, profile?.id]);

  if (pendingCount === 0) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push('/care-circle')}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Lời mời kết nối</Text>
          <Text style={styles.subtitle}>
            Bạn có {pendingCount} lời mời đang chờ
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    padding: spacing.md,
    marginBottom: spacing.md
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
  },
  badgeText: {
    color: colors.surface,
    fontSize: typography.size.md,
    fontWeight: '700'
  },
  textContainer: {
    flex: 1
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary
  }
});
