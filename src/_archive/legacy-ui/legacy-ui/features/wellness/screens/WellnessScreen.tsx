import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDemoData } from '@/lib/hooks/useDemoData';
import { colors, spacing } from '@/ui/theme';
import { MetricCard } from '@/ui/components/MetricCard';
import { SectionHeader } from '@/ui/components/SectionHeader';

export const WellnessScreen = () => {
  const data = useDemoData();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionHeader title="Secondary metrics" />
      <View style={styles.grid}>
        {data.metrics.map((metric) => (
          <MetricCard key={metric.id} title={`${metric.label} detail`} value={metric.value} unit={metric.unit} accentColor={metric.accentColor} />
        ))}
      </View>
      <View style={styles.helperCard}>
        <Text style={styles.helperTitle}>Build your own cards</Text>
        <Text style={styles.helperCopy}>Drop-in UI kit components let you compose dashboards for any domain.</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.xl,
    backgroundColor: colors.background
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  helperCard: {
    padding: spacing.xl,
    borderRadius: 28,
    backgroundColor: colors.surface
  },
  helperTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm
  },
  helperCopy: {
    color: colors.textSecondary
  }
});
