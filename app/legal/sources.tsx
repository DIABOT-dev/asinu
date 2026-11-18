import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
        <View style={styles.header}>
          <Text style={styles.dataTitle}>{t('addressDataTitle')}</Text>
          <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL('https://diachiviet.com/du-lieu-mo/').catch(() => {}); }}>
            <Text style={styles.dataLink}>{t('addressDataAttribution')}</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL('https://creativecommons.org/licenses/by/4.0/').catch(() => {}); }}>
            <Text style={styles.dataLink}>{t('dataSourceLicense')}</Text>
          </Pressable>
        </View>
        <View style={styles.header}>
          <Text style={styles.dataTitle}>{t('weatherDataTitle')}</Text>
          <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL('https://api.met.no/weatherapi/locationforecast/2.0/documentation').catch(() => {}); }}>
            <Text style={styles.dataLink}>{t('weatherDataAttribution')}</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL('https://creativecommons.org/licenses/by/4.0/').catch(() => {}); }}>
            <Text style={styles.dataLink}>{t('dataSourceLicense')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dataTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  dataLink: { fontSize: 14, color: colors.primaryText, paddingVertical: 10 },
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
