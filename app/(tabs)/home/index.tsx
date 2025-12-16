import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H2HeroBanner } from '../../../src/ui-kit/H2HeroBanner';
import { M1MetricCard } from '../../../src/ui-kit/M1MetricCard';
import { H1SectionHeader } from '../../../src/ui-kit/H1SectionHeader';
import { T1ProgressRing } from '../../../src/ui-kit/T1ProgressRing';
import { C1TrendChart } from '../../../src/ui-kit/C1TrendChart';
import { colors, spacing, typography } from '../../../src/styles';
import { Button } from '../../../src/components/Button';
import { useHomeViewModel } from '../../../src/features/home/home.vm';
import { FloatingActionButton } from '../../../src/components/FloatingActionButton';
import { useAuthStore } from '../../../src/features/auth/auth.store';
import { Screen } from '../../../src/components/Screen';
import { LogEntry } from '../../../src/features/logs/logs.store';
import { StateLoading } from '../../../src/components/state/StateLoading';
import { StateError } from '../../../src/components/state/StateError';
import { OfflineBanner } from '../../../src/components/OfflineBanner';
import AsinuChatSticker from '../../../src/components/AsinuChatSticker';
import ChatModal from '../../../src/components/ChatModal';

export default function HomeScreen() {
  const [isChatOpen, setChatOpen] = useState(false);
  const router = useRouter();
  const {
    quickMetrics,
    missions,
    treeSummary,
    logs,
    logsStatus,
    missionsStatus,
    treeStatus,
    logsError,
    missionsError,
    treeError,
    anyStale,
    refreshAll
  } = useHomeViewModel();
  const profile = useAuthStore((state) => state.profile);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  const hasData = Boolean(treeSummary || missions.length || logs.length);
  const loading = logsStatus === 'loading' && missionsStatus === 'loading' && treeStatus === 'loading' && !hasData;
  const noDataError =
    (logsError === 'no-data' || missionsError === 'no-data' || treeError === 'no-data') && !hasData;

  return (
    <Screen>
      {anyStale ? <OfflineBanner /> : null}
      {loading ? <StateLoading /> : null}
      {noDataError ? <StateError onRetry={refreshAll} message="Không tải dữ liệu được" /> : null}
      {!hasData && !loading && !noDataError ? <StateError onRetry={refreshAll} message="Chưa có dữ liệu" /> : null}
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: padTop }]}
        showsVerticalScrollIndicator={false}
      >
        <H2HeroBanner
          name={profile?.name || 'Người chăm sóc'}
          relationship={profile?.relationship}
          summary="Cùng đồng hành với bạn mỗi ngày."
          action={
            <Button
              label="Cài đặt"
              variant="ghost"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: '#ffffff' }}
              textStyle={{ color: '#ffffff', fontWeight: '600' }}
              onPress={() => router.push('/settings')}
            />
          }
          supporters={['Gia đình', 'Bác sĩ gia đình']}
        />

        <View style={styles.metricsRow}>
          <M1MetricCard
            title="Đường huyết"
            value={quickMetrics.glucose}
            unit="mg/dL"
            trend="flat"
            footnote="Ghi trước bữa sáng"
            accentColor={colors.secondary}
            accentGradient={[colors.secondary, colors.primary]}
            onPress={() => router.push('/logs/glucose')}
          />
          <M1MetricCard
            title="Huyết áp"
            value={quickMetrics.bloodPressure}
            unit="mmHg"
            trend="down"
            accentColor={colors.warning}
            accentGradient={[colors.warning, colors.primary]}
            footnote="Theo dõi sáng nay"
            onPress={() => router.push('/logs/blood-pressure')}
          />
        </View>
        <AsinuChatSticker onPress={() => setChatOpen(true)} />

        <H1SectionHeader title="Nhiệm vụ hôm nay" subtitle="Cố gắng hoàn thành top 3" />
        <View style={styles.cardList}>
          {missions.map((mission) => (
            <View key={mission.id} style={styles.missionCard}>
              <Text style={styles.missionTitle}>{mission.title}</Text>
              <Text style={styles.missionDesc}>{mission.description}</Text>
              <Button
                label={mission.completed ? 'Đã hoàn thành' : 'Hoàn thành'}
                variant={mission.completed ? 'warning' : 'primary'}
                onPress={() => router.push('/missions')}
              />
            </View>
          ))}
        </View>

        <H1SectionHeader title="Cây sức khỏe" subtitle="Tiến trình tuần này" />
        <View style={styles.treeRow}>
          <T1ProgressRing percentage={treeSummary?.score ?? 0.6} label="Điểm" accentColor={colors.warning} />
          <View style={styles.treeStats}>
            <Text style={styles.treeStat}>Chuỗi ngày tốt: {treeSummary?.streakDays ?? 0}</Text>
            <Text style={styles.treeStat}>Nhiệm vụ/tuần: {treeSummary?.completedThisWeek ?? 0}/{treeSummary?.totalMissions ?? 0}</Text>
            <Button label="Xem chi tiết" variant="ghost" onPress={() => router.push('/tree')} />
          </View>
        </View>

        <H1SectionHeader title="Xu hướng" subtitle="7 ngày" />
        <C1TrendChart
          data={
            treeSummary
              ? [
                  { label: 'T2', value: treeSummary.score * 80 },
                  { label: 'T3', value: treeSummary.score * 82 },
                  { label: 'T4', value: treeSummary.score * 78 },
                  { label: 'T5', value: treeSummary.score * 84 },
                  { label: 'T6', value: treeSummary.score * 86 },
                  { label: 'T7', value: treeSummary.score * 88 },
                  { label: 'CN', value: treeSummary.score * 90 }
                ]
              : []
          }
        />

        <H1SectionHeader title="Logs gần đây" subtitle="Ghi nhanh" />
        {logs.slice(0, 3).map((log: LogEntry) => (
          <View key={log.id} style={styles.logRow}>
            <Text style={styles.logType}>{log.type}</Text>
            <Text style={styles.logValue}>
              {log.type === 'glucose' && log.value}
              {log.type === 'blood-pressure' && `${log.systolic}/${log.diastolic}`}
              {log.type === 'medication' && log.medication}
            </Text>
          </View>
        ))}
      </ScrollView>
      <FloatingActionButton label="Ghi nhanh" onPress={() => router.push('/logs')} />
      <ChatModal visible={isChatOpen} onClose={() => setChatOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  cardList: {
    gap: spacing.md
  },
  missionCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm
  },
  missionTitle: {
    fontSize: typography.size.lg,
    fontWeight: '700'
  },
  missionDesc: {
    color: colors.textSecondary,
    fontSize: typography.size.md
  },
  treeRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center'
  },
  treeStats: {
    flex: 1,
    gap: spacing.sm
  },
  treeStat: {
    fontSize: typography.size.md,
    color: colors.textPrimary
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  logType: {
    textTransform: 'capitalize',
    color: colors.textSecondary,
    fontSize: typography.size.sm
  },
  logValue: {
    fontWeight: '700',
    fontSize: typography.size.md
  }
});
