import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDemoData } from '@/lib/hooks/useDemoData';
import { LogListItem } from '@/ui/components/LogListItem';
import { colors, spacing } from '@/ui/theme';

export const LogsScreen = () => {
  const router = useRouter();
  const data = useDemoData();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Log history</Text>
        <Text style={styles.subtitle}>Tap any entry to inspect details</Text>
      </View>
      <View style={styles.list}>
        {data.logs.map((log) => (
          <LogListItem
            key={log.id}
            title={log.title}
            subtitle={log.subtitle}
            timestamp={log.timestamp}
            status={log.status}
            onPress={() => router.push(`/logs/${log.id}`)}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    backgroundColor: colors.background,
    gap: spacing.xl
  },
  header: {
    gap: spacing.sm
  },
  title: {
    fontSize: 28,
    color: colors.textPrimary,
    fontWeight: '700'
  },
  subtitle: {
    color: colors.textSecondary
  },
  list: {
    gap: spacing.md
  }
});
