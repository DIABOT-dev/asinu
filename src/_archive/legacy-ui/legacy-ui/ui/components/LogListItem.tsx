import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/ui/theme';
import { formatTimestamp } from '@/lib/utils/formatters';

export type LogListItemProps = {
  title: string;
  subtitle: string;
  timestamp: string;
  status: 'scheduled' | 'completed' | 'missed';
  onPress?: () => void;
};

const statusColors: Record<LogListItemProps['status'], string> = {
  scheduled: colors.warning,
  completed: colors.success,
  missed: colors.danger
};

export const LogListItem = ({ title, subtitle, timestamp, status, onPress }: LogListItemProps) => {
  const Container = onPress ? Pressable : View;

  return (
    <Container style={styles.wrapper} onPress={onPress}>
      <View style={[styles.statusDot, { backgroundColor: statusColors[status] }]} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.timestamp}>{formatTimestamp(timestamp)}</Text>
        <Text style={[styles.status, { color: statusColors[status] }]}>{status}</Text>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 20,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999
  },
  content: {
    flex: 1,
    gap: spacing.xs
  },
  title: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary
  },
  meta: {
    alignItems: 'flex-end'
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary
  },
  status: {
    fontSize: 12,
    textTransform: 'capitalize',
    fontWeight: '600'
  }
});
