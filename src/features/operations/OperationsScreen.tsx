import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/Screen';
import { ScaledText as Text } from '../../components/ScaledText';
import { HomeFeatureGrid } from '../../components/HomeFeatureGrid';
import { useThemeColors } from '../../hooks/useThemeColors';
import { getBottomTabBarHeight, spacing } from '../../styles';
import { ProfileHealthcareBackground } from '../profile/ProfileHealthcareBackground';
import { V21HomeCard } from '../v21/V21HomeCard';

export default function OperationsScreen() {
  const { t } = useTranslation('common');
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Screen>
      <ProfileHealthcareBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
          {t('tabActions')}
        </Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: getBottomTabBarHeight(insets.bottom) + spacing.md,
          },
        ]}
      >
        <V21HomeCard
          renderShortcuts={(access) => <HomeFeatureGrid {...access} />}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  title: { fontSize: 26, fontWeight: '700' },
});
