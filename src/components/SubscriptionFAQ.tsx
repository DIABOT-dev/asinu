import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { Image } from 'expo-image';
import { ScaledText as Text } from './ScaledText';
import { useThemeColors } from '../hooks/useThemeColors';
import { radius, spacing } from '../styles';

const FAQ_LEAVES = require('../../assets/images/subscription/faq_leaves.png');
const QUESTION_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ANIMATION_CONFIG = {
  duration: 200,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

type FAQItemProps = {
  num: number;
  question: string;
  answer: string;
  isOpen: boolean;
  isDark: boolean;
  textColor: string;
  secondaryColor: string;
  onToggle: (idx: number) => void;
};

const FAQItem = memo(function FAQItem({
  num,
  question,
  answer,
  isOpen,
  isDark,
  textColor,
  secondaryColor,
  onToggle,
}: FAQItemProps) {
  const handlePress = useCallback(() => {
    onToggle(num - 1);
  }, [onToggle, num]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.qItem,
        isOpen && (isDark ? styles.qItemOpenDark : styles.qItemOpen),
        pressed && styles.pressedState,
      ]}
    >
      <View style={styles.qHeaderRow}>
        <View
          style={[
            styles.numberBadge,
            isOpen
              ? (isDark ? styles.numberBadgeOpenDark : styles.numberBadgeOpen)
              : (isDark ? styles.numberBadgeDark : styles.numberBadgeNormal),
          ]}
        >
          <Text
            style={[
              styles.numberText,
              isOpen ? styles.numberTextOpen : styles.numberTextNormal,
            ]}
          >
            {num}
          </Text>
        </View>

        <Text
          style={[
            styles.questionText,
            { color: isOpen ? (isDark ? '#fb923c' : '#9a3412') : textColor },
            isOpen && styles.questionTextBold,
          ]}
        >
          {question}
        </Text>

        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={isOpen ? '#ea580c' : secondaryColor}
          style={styles.chevronIcon}
        />
      </View>

      {isOpen && (
        <View style={styles.answerWrap}>
          <Text style={[styles.answerText, { color: isDark ? '#fed7aa' : '#7c2d12' }]}>
            {answer}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

export const SubscriptionFAQ = memo(function SubscriptionFAQ() {
  const { t } = useTranslation('subscription');
  const { colors, isDark } = useThemeColors();
  // Default question 4 is open matching design
  const [openIndex, setOpenIndex] = useState<number | null>(3);

  const toggleQuestion = useCallback((idx: number) => {
    LayoutAnimation.configureNext(ANIMATION_CONFIG);
    setOpenIndex((prev) => (prev === idx ? null : idx));
  }, []);

  const cardStyle = useMemo(
    () => [
      styles.card,
      {
        backgroundColor: colors.surface,
        borderColor: isDark ? colors.border : '#e2e8f0',
      },
    ],
    [colors.surface, colors.border, isDark]
  );

  return (
    <View style={cardStyle}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.helpIconWrap}>
            <Text style={styles.helpQuestionMark}>?</Text>
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('faqTitle')}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t('faqSubtitle')}
            </Text>
          </View>
        </View>
        <Image
          source={FAQ_LEAVES}
          style={styles.headerLeaves}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="high"
        />
      </View>

      {/* Questions list */}
      <View style={styles.body}>
        {QUESTION_INDICES.map((i) => (
          <FAQItem
            key={i}
            num={i}
            question={t(`faq.q${i}`)}
            answer={t(`faq.a${i}`)}
            isOpen={openIndex === i - 1}
            isDark={isDark}
            textColor={colors.textPrimary}
            secondaryColor={colors.textSecondary}
            onToggle={toggleQuestion}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    marginBottom: spacing.xs,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  helpIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpQuestionMark: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ea580c',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
  },
  headerLeaves: {
    width: 60,
    height: 32,
    opacity: 0.85,
  },
  body: {
    paddingTop: spacing.xs,
    gap: 4,
  },
  pressedState: {
    opacity: 0.85,
  },
  qItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  qItemOpen: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  qItemOpenDark: {
    backgroundColor: '#431407',
    borderWidth: 1,
    borderColor: '#7c2d12',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  qHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  numberBadgeNormal: {
    backgroundColor: '#d1fae5',
  },
  numberBadgeDark: {
    backgroundColor: 'rgba(5, 150, 105, 0.3)',
  },
  numberBadgeOpen: {
    backgroundColor: '#ffedd5',
  },
  numberBadgeOpenDark: {
    backgroundColor: '#7c2d12',
  },
  numberText: {
    fontSize: 13,
    fontWeight: '700',
  },
  numberTextNormal: {
    color: '#059669',
  },
  numberTextOpen: {
    color: '#ea580c',
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  questionTextBold: {
    fontWeight: '700',
  },
  chevronIcon: {
    marginLeft: 6,
  },
  answerWrap: {
    paddingLeft: 36,
    paddingTop: 8,
    paddingRight: 4,
  },
  answerText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
