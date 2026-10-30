import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import type { StructuredCheckinConclusion } from './checkin-conclusion';

// DoneScreen places this content inside its existing white result card in both
// themes. Match that card's ink and border palette instead of applying dark
// surface text to a light surface.
const resultPalette = {
  heading: '#0F172A',
  body: '#334155',
  muted: '#475569',
  accent: '#08b8a2',
  action: '#0F766E',
  onAction: '#F5FFFC',
  border: '#E2E8F0',
  disclaimer: '#F2F5F4',
};

export function CheckinConclusion({
  result,
  onConnectExpert,
  expertAvailable,
  readOnly = false,
}: {
  result: StructuredCheckinConclusion;
  onConnectExpert: () => void;
  expertAvailable: boolean;
  readOnly?: boolean;
}) {
  const { t } = useTranslation('home');
  if (result.severity === 'emergency') {
    return null;
  }
  const section = (title: string, content: string | string[]) => (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: resultPalette.heading }]}
      >
        {title}
      </Text>
      {Array.isArray(content) ? (
        content.map((line, index) => (
          <View key={`${index}-${line}`} style={styles.item}>
            <Text
              accessible={false}
              style={[styles.bullet, { color: resultPalette.accent }]}
            >
              •
            </Text>
            <Text
              style={[styles.body, styles.grow, { color: resultPalette.body }]}
            >
              {line}
            </Text>
          </View>
        ))
      ) : (
        <Text style={[styles.body, { color: resultPalette.body }]}>
          {content}
        </Text>
      )}
    </View>
  );
  const linkText = t('checkinConclusionExpertLink');
  const linkAt = result.disclaimer.indexOf(linkText);
  return (
    <View style={styles.content} testID="checkin-structured-conclusion">
      {section(t('checkinConclusionMessage'), result.personalMessage)}
      {section(t('checkinConclusionExplanation'), result.explanation)}
      {section(t('checkinConclusionTodo'), result.todo)}
      {section(t('checkinConclusionWarning'), result.seeDoctorWhen)}
      <View
        style={[
          styles.disclaimer,
          { backgroundColor: resultPalette.disclaimer },
        ]}
        testID="checkin-conclusion-disclaimer"
      >
        <Text style={[styles.disclaimerText, { color: resultPalette.muted }]}>
          {linkAt >= 0 ? (
            <>
              {result.disclaimer.slice(0, linkAt)}
              <Text
                accessibilityRole={expertAvailable ? 'link' : undefined}
                accessibilityState={{ disabled: readOnly || !expertAvailable }}
                onPress={
                  readOnly || !expertAvailable ? undefined : onConnectExpert
                }
                style={[
                  styles.disclaimerText,
                  expertAvailable && styles.link,
                  { color: resultPalette.action },
                ]}
              >
                {linkText}
              </Text>
              {result.disclaimer.slice(linkAt + linkText.length)}
            </>
          ) : (
            result.disclaimer
          )}
        </Text>
      </View>
      <View style={[styles.followup, { borderColor: resultPalette.border }]}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: resultPalette.heading }]}
        >
          {t('checkinConclusionFollowup')}
        </Text>
        <Text style={[styles.body, { color: resultPalette.body }]}>
          {result.closeMessage}
        </Text>
      </View>
      {result.needsDoctor && expertAvailable && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: readOnly }}
          disabled={readOnly}
          onPress={onConnectExpert}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: resultPalette.action,
              opacity: pressed || readOnly ? 0.6 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              { color: resultPalette.onAction },
            ]}
          >
            {t('checkinConnectDoctor')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  section: { gap: 8 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  body: { fontSize: 20, lineHeight: 30 },
  item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { fontSize: 22, lineHeight: 30 },
  grow: { flex: 1, flexShrink: 1 },
  disclaimer: { padding: 14, borderRadius: 14 },
  disclaimerText: { fontSize: 15, lineHeight: 23 },
  link: { textDecorationLine: 'underline' },
  followup: { borderTopWidth: 1, paddingTop: 16, gap: 8 },
  button: {
    minHeight: 56,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: resultPalette.onAction,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
});
