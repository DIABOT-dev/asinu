/**
 * Subscription FAQ. Renders the 10 product-approved Q&A entries from the
 * MVP pricing doc as collapsible rows. Strings live under
 * `subscription.faq.q1..q10` / `subscription.faq.a1..a10` so this list
 * stays content-only and survives copywriting tweaks without code edits.
 */

import { Ionicons } from '@expo/vector-icons';
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
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex((prev) => (prev === i ? null : i));
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="help-circle-outline" size={20} color={colors.textPrimary} />
        <Text style={styles.title}>{t('faqTitle')}</Text>
      </View>
      {Array.from({ length: NUM_QUESTIONS }, (_, idx) => {
        const i = idx + 1;
        const question = t(`faq.q${i}`);
        const answer = t(`faq.a${i}`);
        const open = openIndex === idx;
        return (
          <Pressable
            key={i}
            onPress={() => toggle(idx)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.qRow}>
              <Text style={styles.question} numberOfLines={open ? undefined : 2}>{question}</Text>
              <Ionicons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textSecondary}
              />
            </View>
            {open && <Text style={styles.answer}>{answer}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  row: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  question: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary, lineHeight: 20 },
  answer: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 },
});
