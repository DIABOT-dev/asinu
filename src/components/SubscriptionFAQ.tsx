/**
 * Subscription FAQ — two-level collapsible.
 *
 *   Level 1: the whole block. Tap the header → reveal the question list.
 *            Default state is collapsed so the FAQ doesn't dominate the
 *            screen when the user is in "browsing plans" mode.
 *
 *   Level 2: each question. Tap → reveal its answer.
 *
 * Content lives under `subscription.faq.q1..q10` / `a1..a10` so copy
 * tweaks don't require code changes.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { colors, radius, spacing } from '../styles';

const NUM_QUESTIONS = 10;

// Required to make LayoutAnimation work on Android.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function SubscriptionFAQ() {
  const { t } = useTranslation('subscription');
  const [blockOpen, setBlockOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleBlock = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setBlockOpen((prev) => !prev);
    if (blockOpen) setOpenIndex(null); // collapsing the block also resets question selection
  };

  const toggleQuestion = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex((prev) => (prev === i ? null : i));
  };

  return (
    <View style={styles.card}>
      {/* Header is a gradient pill — tapping it expands/collapses the whole list. */}
      <Pressable onPress={toggleBlock} accessibilityRole="button">
        <LinearGradient
          colors={['#fef3c7', '#fde68a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, blockOpen && styles.headerOpen]}
        >
          <View style={styles.headerIconWrap}>
            <Ionicons name="help-circle" size={22} color="#d97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('faqTitle')}</Text>
            {!blockOpen && (
              <Text style={styles.headerHint}>{t('faqTapHint')}</Text>
            )}
          </View>
          <Ionicons
            name={blockOpen ? 'chevron-up-circle' : 'chevron-down-circle'}
            size={22}
            color="#d97706"
          />
        </LinearGradient>
      </Pressable>

      {blockOpen && (
        <View style={styles.body}>
          {Array.from({ length: NUM_QUESTIONS }, (_, idx) => {
            const i = idx + 1;
            const question = t(`faq.q${i}`);
            const answer = t(`faq.a${i}`);
            const open = openIndex === idx;
            return (
              <Pressable
                key={i}
                onPress={() => toggleQuestion(idx)}
                style={({ pressed }) => [
                  styles.qRow,
                  open && styles.qRowOpen,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.qNumberPill}>
                  <Text style={styles.qNumberText}>{i}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.qHead}>
                    <Text style={styles.question} numberOfLines={open ? undefined : 2}>
                      {question}
                    </Text>
                    <Ionicons
                      name={open ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={open ? '#d97706' : colors.textSecondary}
                    />
                  </View>
                  {open && <Text style={styles.answer}>{answer}</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  headerOpen: {
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400e',
  },
  headerHint: {
    fontSize: 12,
    color: '#a16207',
    marginTop: 2,
  },
  body: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  qRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  qRowOpen: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  qNumberPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  qHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  question: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 19,
  },
  answer: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});
