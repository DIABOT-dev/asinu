import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ScaledText as Text } from '../../../components/ScaledText';
import { useGuardedRouter } from '../../../hooks/useGuardedRouter';
import { useScaledTypography } from '../../../hooks/useScaledTypography';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { radius, spacing } from '../../../styles';

const COMPARISON_ART = require('../../../../assets/images/subscription/protected_hero_shield.png');
const SCENARIOS = [
  { key: 'missed', icon: 'sunny-outline' },
  { key: 'unanswered', icon: 'call-outline' },
  { key: 'busy', icon: 'phone-portrait-outline' },
  { key: 'trend', icon: 'heart-outline' },
  { key: 'people', icon: 'people-outline' },
] as const;

/** Entry on the subscription overview. The comparison has its own back stack. */
export function SubscriptionScenarioComparison() {
  const { t } = useTranslation('subscription');
  const router = useGuardedRouter();
  const { colors } = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('comparison.title')}. ${t('comparison.headerSubtitle')}`}
        accessibilityHint={t('comparison.openHint')}
        onPress={() => router.push('/subscription/comparison')}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.headerIcon}>
          <Ionicons name="git-compare-outline" size={26} color={colors.primaryText} />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling style={styles.heading}>{t('comparison.title')}</Text>
          <Text allowFontScaling style={styles.headerSubtitle}>{t('comparison.headerSubtitle')}</Text>
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.headerChevron}>
          <Ionicons name="chevron-forward" size={20} color={colors.primaryText} />
        </View>
      </Pressable>
    </View>
  );
}

export function SubscriptionComparisonContent() {
  const { t } = useTranslation('subscription');
  const { colors } = useThemeColors();
  const { width, fontScale } = useWindowDimensions();
  const { size, scaledSize } = useScaledTypography();
  const textScale = (fontScale || 1) * scaledSize.sm / size.sm;
  // Keep text readable on small screens and with large type instead of shrinking it.
  const stacked = width < 360 || textScale > 1.15;
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.panel} testID="subscription-comparison-content">
      <View style={styles.pageHeader}>
        <Image source={COMPARISON_ART} contentFit="contain" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.heroArt} />
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.pageHeaderIcon}>
          <Ionicons name="git-compare-outline" size={30} color={colors.primaryText} />
        </View>
        <View style={styles.pageHeaderCopy}>
          <Text allowFontScaling accessibilityRole="header" style={styles.pageTitle}>{t('comparison.title')}</Text>
          <Text allowFontScaling style={styles.pageSubtitle}>{t('comparison.headerSubtitle')}</Text>
        </View>
      </View>
      <Text allowFontScaling style={styles.introduction}>{t('comparison.subtitle')}</Text>
      {!stacked && <View style={styles.tableHeader} testID="comparison-table-header">
        <View style={[styles.columnHeading, styles.situationCell]}>
          <Text allowFontScaling accessibilityRole="header" style={styles.columnTitle}>{t('comparison.scenarioLabel')}</Text>
        </View>
        <View style={[styles.columnHeading, styles.freeCell]}>
          <Ionicons accessible={false} name="person-outline" size={20} color={colors.textSecondary} />
          <Text allowFontScaling accessibilityRole="header" style={styles.freeColumnTitle}>{t('comparison.freeLabel')}</Text>
        </View>
        <View style={[styles.columnHeading, styles.anTamCell]}>
          <MaterialCommunityIcons accessible={false} name="crown-outline" size={23} color={colors.primaryText} />
          <Text allowFontScaling accessibilityRole="header" style={styles.anTamColumnTitle}>{t('comparison.anTamLabel')}</Text>
        </View>
      </View>}
      {SCENARIOS.map(({ key, icon }) => (
        <View key={key} testID={`comparison-scenario-${key}`} style={[styles.scenario, stacked && styles.stackedScenario]}>
          <View style={[styles.situation, !stacked && styles.situationCell]}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.scenarioIcon}>
              <Ionicons name={icon} size={26} color={colors.primaryText} />
            </View>
            <Text allowFontScaling accessibilityRole="header" style={styles.scenarioTitle}>{t(`comparison.${key}.title`)}</Text>
          </View>
          <View style={[styles.answer, styles.freeCell, stacked && styles.stackedCell]}>
            {stacked && <Text allowFontScaling style={styles.freeColumnTitle}>{t('comparison.freeLabel')}</Text>}
            <Text allowFontScaling accessibilityLabel={`${t('comparison.freeLabel')}: ${t(`comparison.${key}.free`)}`} style={styles.body}>{t(`comparison.${key}.free`)}</Text>
          </View>
          <View style={[styles.answer, styles.anTamCell, stacked && styles.stackedCell]}>
            {stacked && <Text allowFontScaling style={styles.anTamColumnTitle}>{t('comparison.anTamLabel')}</Text>}
            <Text allowFontScaling accessibilityLabel={`${t('comparison.anTamLabel')}: ${t(`comparison.${key}.anTam`)}`} style={styles.body}>{t(`comparison.${key}.anTam`)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>['colors']) {
  return StyleSheet.create({
    root: { marginTop: spacing.md, marginBottom: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xxl },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
    headerIcon: { width: 32, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1, minWidth: 0, gap: 2 },
    headerChevron: { width: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: 0.85 },
    heading: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
    headerSubtitle: { color: colors.textSecondary, fontSize: 15 },
    panel: { backgroundColor: colors.surface, borderRadius: 28, paddingHorizontal: 10, paddingTop: 22, paddingBottom: 12, borderWidth: 1, borderColor: colors.primaryLight },
    pageHeader: { minHeight: 82, paddingHorizontal: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
    pageHeaderIcon: { width: 34, alignItems: 'center' },
    pageHeaderCopy: { flex: 1, minWidth: 0 },
    pageTitle: { color: colors.textPrimary, fontSize: 28, lineHeight: 38, fontWeight: '800' },
    pageSubtitle: { color: colors.textSecondary, fontSize: 17, fontWeight: '600' },
    heroArt: { position: 'absolute', right: -2, top: -14, width: 132, height: 132, opacity: 0.13 },
    introduction: { color: colors.textPrimary, fontSize: 16, lineHeight: 25, paddingHorizontal: 4, marginTop: 10, marginBottom: 20 },
    tableHeader: { flexDirection: 'row', alignItems: 'stretch', gap: 4, marginBottom: 4 },
    columnHeading: { minWidth: 0, paddingHorizontal: 8, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', gap: 4, borderRadius: 12, backgroundColor: colors.surfaceMuted },
    situationCell: { width: '35%', flexShrink: 1, minWidth: 0 },
    freeCell: { width: '30%', flexShrink: 1, minWidth: 0, backgroundColor: colors.surfaceMuted },
    anTamCell: { width: '35%', flexShrink: 1, minWidth: 0, backgroundColor: colors.primaryLight },
    columnTitle: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    freeColumnTitle: { color: colors.textSecondary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
    anTamColumnTitle: { color: colors.primaryText, fontSize: 14, fontWeight: '700', textAlign: 'center' },
    scenario: { flexDirection: 'row', alignItems: 'stretch', gap: 4, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    stackedScenario: { flexDirection: 'column', gap: 8, paddingVertical: 16 },
    situation: { paddingVertical: 14, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    scenarioIcon: { width: 28, flexShrink: 0, paddingTop: 2 },
    scenarioTitle: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: 14, lineHeight: 21, fontWeight: '700' },
    answer: { paddingHorizontal: 10, paddingVertical: 14, borderRadius: 12, gap: 8 },
    stackedCell: { width: '100%', flexShrink: 0, flexBasis: 'auto', gap: 6, padding: 16 },
    body: { color: colors.textPrimary, fontSize: 14, lineHeight: 21 },
  });
}
