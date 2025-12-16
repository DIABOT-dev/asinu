import { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';
import { ListItem } from '../../src/components/ListItem';
import { Screen } from '../../src/components/Screen';
import { spacing } from '../../src/styles';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { StateLoading } from '../../src/components/state/StateLoading';
import { StateError } from '../../src/components/state/StateError';
import { OfflineBanner } from '../../src/components/OfflineBanner';

export default function LogsIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;
  const fetchLogs = useLogsStore((state) => state.fetchRecent);
  const status = useLogsStore((state) => state.status);
  const errorState = useLogsStore((state) => state.errorState);
  const isStale = useLogsStore((state) => state.isStale);

  useEffect(() => {
    if (status === 'idle') {
      const controller = new AbortController();
      fetchLogs(controller.signal);
      return () => controller.abort();
    }
  }, [status, fetchLogs]);

  return (
    <Screen>
      {isStale || errorState === 'remote-failed' ? <OfflineBanner /> : null}
      {status === 'loading' ? <StateLoading /> : null}
      {errorState === 'no-data' ? <StateError onRetry={() => fetchLogs()} message="Không tải dữ liệu được" /> : null}
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: padTop }]}>
        <H1SectionHeader title="Ghi nhật ký" subtitle="Chọn loại ghi" />
        <ListItem title="Đường huyết" onPress={() => router.push('/logs/glucose')} />
        <ListItem title="Huyết áp" onPress={() => router.push('/logs/blood-pressure')} style={{ marginTop: spacing.md }} />
        <ListItem title="Thuốc/Insulin" onPress={() => router.push('/logs/medication')} style={{ marginTop: spacing.md }} />
        <ListItem title="Insulin" onPress={() => router.push('/logs/insulin')} style={{ marginTop: spacing.md }} />
        <ListItem title="Bữa ăn" onPress={() => router.push('/logs/meal')} style={{ marginTop: spacing.md }} />
        <ListItem title="Nước uống" onPress={() => router.push('/logs/water')} style={{ marginTop: spacing.md }} />
        <ListItem title="Cân nặng" onPress={() => router.push('/logs/weight')} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md
  }
});
