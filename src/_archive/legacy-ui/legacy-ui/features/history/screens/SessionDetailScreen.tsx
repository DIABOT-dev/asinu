import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useDemoData } from '@/lib/hooks/useDemoData';
import { colors, spacing } from '@/ui/theme';
import { TimelineStepper } from '@/ui/components/TimelineStepper';

export const SessionDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useDemoData();
  const entry = data.logs.find((log) => log.id === id);

  if (!entry) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Entry not found</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{entry.title}</Text>
      <Text style={styles.subtitle}>{entry.subtitle}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{entry.status}</Text>
      </View>
      {entry.steps ? <TimelineStepper items={entry.steps} currentIndex={entry.steps.length - 1} /> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background
  },
  title: {
    fontSize: 26,
    color: colors.textPrimary,
    fontWeight: '700'
  },
  subtitle: {
    color: colors.textSecondary
  },
  card: {
    padding: spacing.lg,
    borderRadius: 24,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  label: {
    color: colors.textSecondary
  },
  value: {
    fontSize: 18,
    fontWeight: '600'
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyText: {
    color: colors.textSecondary
  }
});
