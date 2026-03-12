import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { getLegalText } from '../../src/constants/LegalText';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, spacing } from '../../src/styles';

export default function LegalContentScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const contentKey = type === 'privacy' ? 'privacy' : 'terms';
  const content = getLegalText()[contentKey];
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  return (
    <>
      <Stack.Screen options={{ title: content.title }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{content.title}</Text>
          {content.updated ? <Text style={styles.updated}>{content.updated}</Text> : null}
          {content.sections.map((section, index) => {
            const isHeading = /^(\d+\.|[IVX]+\.)/.test(section);
            return (
              <Text key={`${contentKey}-${index}`} style={[styles.paragraph, isHeading && styles.heading]}>
                {section}
              </Text>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.sm
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: '800',
    color: colors.textPrimary
  },
  updated: {
    color: colors.textSecondary,
    marginBottom: spacing.sm
  },
  paragraph: {
    color: colors.textPrimary,
    fontSize: typography.size.sm,
    lineHeight: 22
  },
  heading: {
    fontWeight: '700',
    marginTop: spacing.sm
  }
});
}
