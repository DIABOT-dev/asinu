import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ScaledText as Text } from '../../../components/ScaledText';
import { useScaledTypography } from '../../../hooks/useScaledTypography';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { radius, spacing } from '../../../styles';

const SCENARIOS = ['missed', 'unanswered', 'busy', 'trend', 'people'] as const;

export function SubscriptionScenarioComparison() {
  const { t } = useTranslation('subscription');
  const { colors } = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const { size, scaledSize } = useScaledTypography();
  const textScale = (fontScale || 1) * scaledSize.sm / size.sm;
  const stackColumns = width < 420 || textScale > 1.15;
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('comparison.title')}. ${t('comparison.headerSubtitle')}`}
        accessibilityHint={t(expanded ? 'comparison.collapseHint' : 'comparison.expandHint')}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(previous => !previous)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.headerIcon}>
          <Ionicons name="git-compare-outline" size={26} color={colors.primaryText} />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling style={styles.heading}>
            {t('comparison.title')}
          </Text>
          <Text allowFontScaling style={styles.headerSubtitle}>
            {t('comparison.headerSubtitle')}
          </Text>
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.headerChevron}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primaryText} />
        </View>
      </Pressable>
      {expanded && <View style={styles.scenarios}>
        <Text allowFontScaling style={styles.body}>{t('comparison.subtitle')}</Text>
        {SCENARIOS.map(scenario => (
          <View key={scenario} testID={`comparison-scenario-${scenario}`} style={styles.scenario}>
            <Text allowFontScaling accessibilityRole="header" style={styles.scenarioTitle}>
              {t(`comparison.${scenario}.title`)}
            </Text>
            <View style={[styles.columns, stackColumns && styles.stackedColumns]}>
              <View style={[styles.answer, stackColumns && styles.stackedCell]}>
                <Text allowFontScaling style={styles.label}>{t('comparison.freeLabel')}</Text>
                <Text allowFontScaling style={styles.body}>{t(`comparison.${scenario}.free`)}</Text>
              </View>
              <View style={[styles.answer, stackColumns && styles.stackedCell, styles.anTamAnswer]}>
                <Text allowFontScaling style={styles.anTamLabel}>{t('comparison.anTamLabel')}</Text>
                <Text allowFontScaling style={styles.body}>{t(`comparison.${scenario}.anTam`)}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>['colors']) {
  return StyleSheet.create({
    root: {
      marginTop: spacing.md, marginBottom: spacing.lg, padding: spacing.lg,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.xxl,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
    headerIcon: { width: 32, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1, minWidth: 0, gap: 2 },
    headerChevron: { width: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: 0.85 },
    heading: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
    headerSubtitle: { color: colors.textSecondary, fontSize: 15 },
    columns: { alignItems: 'stretch', flexDirection: 'row', gap: spacing.md },
    stackedColumns: { flexDirection: 'column' },
    stackedCell: { flexBasis: 'auto', flexGrow: 0, flexShrink: 0 },
    label: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
    scenarios: { gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    scenario: { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: spacing.lg, gap: spacing.md },
    scenarioTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
    body: { color: colors.textPrimary, fontSize: 16 },
    answer: { minWidth: 0, flexGrow: 1, flexShrink: 1, flexBasis: 0, padding: spacing.md, gap: spacing.xs },
    anTamAnswer: { backgroundColor: colors.primaryLight, borderRadius: radius.md },
    anTamLabel: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },
  });
}
