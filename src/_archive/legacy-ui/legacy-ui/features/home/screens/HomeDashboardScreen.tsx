import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MetricCard } from '@/ui/components/MetricCard';
import { TrendChart } from '@/ui/components/TrendChart';
import { ProgressRing } from '@/ui/components/ProgressRing';
import { PillTag } from '@/ui/components/PillTag';
import { SectionHeader } from '@/ui/components/SectionHeader';
import { LogListItem } from '@/ui/components/LogListItem';
import { ResourceGrid } from '@/features/home/components/ResourceGrid';
import { useDemoData } from '@/lib/hooks/useDemoData';
import { colors, spacing } from '@/ui/theme';

export const HomeDashboardScreen = () => {
  const data = useDemoData();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.greeting}>Welcome back</Text>
        <Text style={styles.subtitle}>Here is a snapshot of your workspace health</Text>
      </View>
      <View style={styles.metricRow}>
        {data.metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            title={metric.label}
            value={metric.value}
            unit={metric.unit}
            delta={metric.delta}
            trend={metric.trend}
            accentColor={metric.accentColor}
          />
        ))}
      </View>
      <View style={styles.section}>
        <SectionHeader title={data.trendSeries.title} actionLabel="View details" onActionPress={() => {}} />
        <TrendChart data={data.trendSeries.data} />
      </View>
      <View style={styles.section}>
        <SectionHeader title="Trackers" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackerRow}>
          {data.trackers.map((tracker) => (
            <View key={tracker.id} style={styles.trackerCard}>
              <ProgressRing percentage={tracker.progress} label={tracker.name} size={140} />
              <Text style={styles.trackerMeta}>Target {tracker.targetValue} {tracker.unit}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={styles.section}>
        <SectionHeader title="Filters" actionLabel="Manage" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {['Primary Metric', 'Secondary Metric', 'Support', 'Custom'].map((label) => (
            <PillTag key={label} label={label} />
          ))}
        </ScrollView>
      </View>
      <View style={styles.section}>
        <SectionHeader title="Recent logs" actionLabel="View all" />
        <View style={styles.logList}>
          {data.logs.map((log) => (
            <LogListItem key={log.id} title={log.title} subtitle={log.subtitle} timestamp={log.timestamp} status={log.status} />
          ))}
        </View>
      </View>
      <ResourceGrid resources={data.resources} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    backgroundColor: colors.background,
    gap: spacing.xl
  },
  hero: {
    gap: spacing.sm
  },
  greeting: {
    fontSize: 28,
    color: colors.textPrimary,
    fontWeight: '700'
  },
  subtitle: {
    color: colors.textSecondary
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  section: {
    gap: spacing.md
  },
  trackerRow: {
    gap: spacing.md
  },
  trackerCard: {
    width: 180,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 28,
    backgroundColor: colors.surface
  },
  trackerMeta: {
    marginTop: spacing.sm,
    color: colors.textSecondary
  },
  filterRow: {
    gap: spacing.sm
  },
  logList: {
    gap: spacing.md
  }
});
