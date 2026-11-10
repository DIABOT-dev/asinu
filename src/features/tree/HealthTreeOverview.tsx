import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RippleRefreshScrollView } from '../../components/RippleRefresh';
import { ScaledText as Text } from '../../components/ScaledText';
import { Screen } from '../../components/Screen';
import { HealthJournalCalendar } from '../../components/HealthJournalCalendar';
import { useThemeColors } from '../../hooks/useThemeColors';
import { getBottomTabBarHeight, spacing } from '../../styles';
import { useHealthTreeOverview } from './useHealthTreeOverview';
import { useAuthStore } from '../auth/auth.store';

export function HealthTreeOverview() {
  const userId = useAuthStore((state) => state.profile?.id);
  return <HealthTreeOverviewContent key={userId ?? 'signed-out'} />;
}

function HealthTreeOverviewContent() {
  const { t } = useTranslation('tree');
  const { refreshing, refreshKey, refresh } = useHealthTreeOverview({ includeHealthScore: false });
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Screen style={{ backgroundColor: isDark ? colors.background : '#F2F7F4' }}>
      <RippleRefreshScrollView
        refreshing={refreshing}
        onRefresh={refresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.lg,
            paddingBottom: getBottomTabBarHeight(insets.bottom) + spacing.lg,
          },
        ]}
      >
        <View style={styles.pageHeader} testID="health-journal-header">
          <View style={styles.headerCopy}>
            <Text allowFontScaling accessibilityRole="header" style={[styles.pageTitle, { color: colors.textPrimary }]}>
              {t('journalTitle')}
            </Text>
          </View>
          <Image source={require('../../../assets/images/missions/icons-v2/checkin-v2.png')}
            style={styles.headerArtwork} resizeMode="contain" accessible={false} />
        </View>
        <View style={styles.section}>
          <HealthJournalCalendar refreshKey={refreshKey} showAttention={false} />
        </View>
      </RippleRefreshScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.lg, gap: 24 },
  section: { width: '100%', maxWidth: 680 },
  pageHeader: { width: '100%', maxWidth: 680, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  headerCopy: { flex: 1, minWidth: 0 },
  pageTitle: { fontSize: 26, fontWeight: '700' },
  headerArtwork: { width: 88, height: 96, flexShrink: 0 },
});
