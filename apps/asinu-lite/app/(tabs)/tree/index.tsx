import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTreeStore } from '../../../src/features/tree/tree.store';
import { Screen } from '../../../src/components/Screen';
import { H1SectionHeader } from '../../../src/ui-kit/H1SectionHeader';
import { T1ProgressRing } from '../../../src/ui-kit/T1ProgressRing';
import { C1TrendChart } from '../../../src/ui-kit/C1TrendChart';
import { colors, spacing, typography } from '../../../src/styles';
import { StateLoading } from '../../../src/components/state/StateLoading';
import { StateError } from '../../../src/components/state/StateError';
import { StateEmpty } from '../../../src/components/state/StateEmpty';
import { OfflineBanner } from '../../../src/components/OfflineBanner';

export default function TreeScreen() {
  const summary = useTreeStore((state) => state.summary);
  const history = useTreeStore((state) => state.history);
  const fetchTree = useTreeStore((state) => state.fetchTree);
  const status = useTreeStore((state) => state.status);
  const isStale = useTreeStore((state) => state.isStale);
  const errorState = useTreeStore((state) => state.errorState);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  useEffect(() => {
    const controller = new AbortController();
    fetchTree(controller.signal);
    return () => controller.abort();
  }, [fetchTree]);

  return (
    <Screen>
      {isStale || errorState === 'remote-failed' ? <OfflineBanner /> : null}
      {status === 'loading' && !summary ? <StateLoading /> : null}
      {errorState === 'no-data' && !summary ? <StateError onRetry={() => fetchTree()} message="Khong tai du lieu duoc" /> : null}
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: padTop }]}>
        {status === 'success' && !summary ? <StateEmpty /> : null}
        <H1SectionHeader title="Cay suc khoe" subtitle="Theo doi tien trinh" />
        <View style={styles.row}>
          <T1ProgressRing percentage={summary?.score ?? 0.6} label="Diem" accentColor={colors.warning} />
          <View style={styles.meta}>
            <Text style={styles.metaText}>Chuoi ngay tot: {summary?.streakDays ?? 0}</Text>
            <Text style={styles.metaText}>
              Nhiem vu tuan: {summary?.completedThisWeek ?? 0}/{summary?.totalMissions ?? 0}
            </Text>
          </View>
        </View>
        <C1TrendChart data={history} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center'
  },
  meta: {
    gap: spacing.sm
  },
  metaText: {
    fontSize: typography.size.md,
    color: colors.textPrimary
  }
});
