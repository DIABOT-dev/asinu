import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { colors, spacing } from '../styles';

const SOURCES = [
  {
    icon: 'medkit-outline' as const,
    titleKey: 'healthSourceWhoDiabetes',
    descriptionKey: 'healthSourceWhoDiabetesDesc',
    url: 'https://www.who.int/news-room/fact-sheets/detail/diabetes',
  },
  {
    icon: 'heart-outline' as const,
    titleKey: 'healthSourceAhaBloodPressure',
    descriptionKey: 'healthSourceAhaBloodPressureDesc',
    url: 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings',
  },
  {
    icon: 'restaurant-outline' as const,
    titleKey: 'healthSourceWhoDiet',
    descriptionKey: 'healthSourceWhoDietDesc',
    url: 'https://www.who.int/en/news-room/fact-sheets/detail/healthy-diet',
  },
] as const;

export function HealthSourcesSection() {
  const { t } = useTranslation('common');

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <Ionicons name="library-outline" size={22} color={colors.primary} />
        <Text style={styles.heading}>{t('healthSourcesLabel')}</Text>
      </View>
      {SOURCES.map((source) => (
        <Pressable
          key={source.url}
          style={({ pressed }) => [styles.sourceRow, pressed && styles.sourceRowPressed]}
          onPress={() => {
            void Linking.openURL(source.url).catch(() => {});
          }}
          accessibilityRole="link"
          accessibilityLabel={t(source.titleKey)}
        >
          <Ionicons name={source.icon} size={22} color={colors.primary} />
          <View style={styles.sourceCopy}>
            <Text style={styles.sourceTitle}>{t(source.titleKey)}</Text>
            <Text style={styles.sourceDescription}>{t(source.descriptionKey)}</Text>
          </View>
          <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  sourceRowPressed: {
    opacity: 0.7,
  },
  sourceCopy: {
    flex: 1,
    gap: 2,
  },
  sourceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sourceDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
