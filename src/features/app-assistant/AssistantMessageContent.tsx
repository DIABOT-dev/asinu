import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { assistantTextSpans, parseAssistantMessage } from './assistant-message-format';

/** Clear reading structure without changing or interpreting the assistant's data. */
export function AssistantMessageContent({ text }: { text: string }) {
  const { colors } = useThemeColors();
  const blocks = useMemo(() => parseAssistantMessage(text), [text]);
  const inline = (value: string, size = 16) => assistantTextSpans(value).map((span, index) => span.strong
    ? <Text key={index} style={{ fontSize: size, fontWeight: '600', color: colors.textPrimary }}>{span.text}</Text>
    : span.text);
  return <View testID="assistant-message-content" style={styles.content}>
    {blocks.map((block, index) => {
      if (block.kind === 'heading') return <Text key={index} accessibilityRole="header" selectable
        style={[styles.heading, { color: colors.textPrimary }]}>{inline(block.text, 18)}</Text>;
      if (block.kind === 'list') return <View key={index} style={styles.list}>
        {block.items.map((item, itemIndex) => <View key={itemIndex} style={styles.listItem}>
          <Text style={[styles.marker, { color: colors.primaryText }]}>{item.marker}</Text>
          <Text selectable style={[styles.body, styles.listText, { color: colors.textPrimary }]}>{inline(item.text)}</Text>
        </View>)}
      </View>;
      if (block.kind === 'details') return <View key={index} style={styles.details}>
        {block.items.map((item, itemIndex) => <View key={itemIndex} style={[styles.detailRow,
          { borderBottomColor: colors.border, borderBottomWidth: itemIndex < block.items.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
          <Text selectable style={[styles.detailLabel, { color: colors.textPrimary }]}>{inline(item.label)}</Text>
          <Text selectable style={[styles.detailValue, { color: colors.primaryText }]}>{inline(item.value)}</Text>
        </View>)}
      </View>;
      return <Text key={index} selectable style={[styles.body, { color: colors.textPrimary }]}>{inline(block.text)}</Text>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: 12, minWidth: 0 },
  heading: { fontSize: 18, lineHeight: 27, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 25 },
  list: { gap: 10 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  marker: { fontSize: 16, lineHeight: 25, minWidth: 16, fontWeight: '600' },
  listText: { flex: 1, minWidth: 0 },
  details: { gap: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 10 },
  detailLabel: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 25, fontWeight: '600' },
  detailValue: { maxWidth: '48%', flexShrink: 1, fontSize: 16, lineHeight: 25, textAlign: 'right' },
});
