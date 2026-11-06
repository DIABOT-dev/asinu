import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';

type Props = {
  levels: readonly { key: string; color: string }[];
  activeKey?: string | null;
  label: string;
  reference?: string;
};

/** A categorical scale, with no invented numeric score or medical thresholds. */
export function ReadingLevelIndicator({ levels, activeKey, label, reference }: Props) {
  const { colors } = useThemeColors();
  const { t } = useTranslation('common');
  const { t: tl } = useTranslation('logs');
  const insets = useSafeAreaInsets();
  const [showReference, setShowReference] = useState(false);
  const active = levels.find(level => level.key === activeKey);

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        {reference ? (
          <Pressable
            style={styles.button}
            accessibilityRole="button"
            accessibilityLabel={tl('readingLevelReference')}
            onPress={() => setShowReference(true)}
          >
            <Ionicons name="information-circle-outline" size={21} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        accessibilityHint={reference}
        style={styles.track}
      >
        {levels.map(level => (
          <View key={level.key} style={styles.segmentWrap}>
            <View style={[styles.segment, { backgroundColor: active ? level.color : colors.border }]} />
            {active?.key === level.key ? (
              <View style={[styles.marker, { borderTopColor: colors.textPrimary }]} />
            ) : null}
          </View>
        ))}
      </View>
      {reference ? (
        <Modal visible={showReference} transparent animationType="fade" onRequestClose={() => setShowReference(false)}>
          <View style={[styles.overlay, { paddingVertical: Math.max(insets.top, insets.bottom, 20) }]}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
              accessibilityRole="button"
              accessibilityLabel={t('close')}
              onPress={() => setShowReference(false)}
            />
            <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
              <View style={styles.heading}>
                <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{tl('readingLevelReference')}</Text>
                <Pressable style={styles.button} accessibilityRole="button" accessibilityLabel={t('close')} onPress={() => setShowReference(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView style={styles.scroll}>
                <Text style={[styles.reference, { color: colors.textPrimary }]}>{reference}</Text>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: 4, marginTop: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, fontSize: 16, fontWeight: '600' },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  track: { flexDirection: 'row', gap: 3, paddingTop: 9 },
  segmentWrap: { flex: 1, alignItems: 'center' },
  segment: { height: 10, width: '100%', borderRadius: 5 },
  marker: { position: 'absolute', top: -9, width: 0, height: 0, borderStyle: 'solid', borderBottomWidth: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  dialog: { width: '100%', maxWidth: 480, maxHeight: '85%', borderRadius: 24, padding: 20 },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
  reference: { fontSize: 16, lineHeight: 24 },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
