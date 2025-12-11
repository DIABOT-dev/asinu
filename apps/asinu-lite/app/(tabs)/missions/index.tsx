import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMissionActions } from '../../../src/features/missions/useMissionActions';
import { H1SectionHeader } from '../../../src/ui-kit/H1SectionHeader';
import { Button } from '../../../src/components/Button';
import { Screen } from '../../../src/components/Screen';
import { colors, spacing, typography } from '../../../src/styles';
import { StateLoading } from '../../../src/components/state/StateLoading';
import { StateError } from '../../../src/components/state/StateError';
import { StateEmpty } from '../../../src/components/state/StateEmpty';
import { OfflineBanner } from '../../../src/components/OfflineBanner';

export default function MissionsScreen() {
  const { missions, status, isStale, errorState, fetchMissions, toggleComplete } = useMissionActions();
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  useEffect(() => {
    // ensure data ready
  }, []);

  return (
    <Screen>
      {isStale || errorState === 'remote-failed' ? <OfflineBanner /> : null}
      {status === 'loading' && missions.length === 0 ? <StateLoading /> : null}
      {errorState === 'no-data' && missions.length === 0 ? (
        <StateError onRetry={() => fetchMissions()} message="Khong tai du lieu duoc" />
      ) : null}
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: padTop }]}>
        {status === 'success' && missions.length === 0 ? <StateEmpty /> : null}
        <H1SectionHeader title="Nhiem vu" subtitle="Cap nhat trong ngay" />
        {missions.map((mission) => (
          <View key={mission.id} style={styles.card}>
            <Text style={styles.title}>{mission.title}</Text>
            <Text style={styles.description}>{mission.description}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{mission.category}</Text>
              <Text style={styles.meta}>Diem: {mission.points ?? 0}</Text>
            </View>
            <Button
              label={mission.completed ? 'Da hoan thanh' : 'Danh dau hoan thanh'}
              variant={mission.completed ? 'warning' : 'primary'}
              onPress={() => toggleComplete(mission.id)}
            />
          </View>
        ))}
        {status === 'loading' && <Text style={styles.description}>Dang tai du lieu...</Text>}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.md
  },
  card: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: '700'
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.size.md
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  meta: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: typography.size.sm
  }
});
