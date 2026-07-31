import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { HealthSourcesSection } from '../../src/components/HealthSourcesSection';
import { colors, spacing } from '../../src/styles';

export default function HealthSourcesScreen() {
  const { t } = useTranslation('common');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('healthSourcesTitle')}</Text>
          <Text style={styles.intro}>{t('healthSourcesIntro')}</Text>
        </View>
        <HealthSourcesSection />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  intro: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
  },
});
