import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { MedicationPurposeTags } from '../v21/MedicationPurposeTags';
import type { AssistantMedicationPurpose as Purpose } from './app-assistant.api';

export function AssistantMedicationPurpose({ purpose }: { purpose: Purpose }) {
  const { t } = useTranslation('v21');
  const { colors } = useThemeColors();
  const matched = purpose.status === 'matched' && purpose.tags.length > 0;
  const source = matched ? purpose.source : undefined;
  const title = matched ? 'medicationPurposeTitle'
    : purpose.status === 'not_selected' ? 'medicationPurposeNotSelected'
    : purpose.status === 'ambiguous' ? 'medicationPurposeAmbiguous'
      : purpose.status === 'unavailable' ? 'medicationPurposeUnavailable' : 'medicationPurposeNotFound';
  return <View style={styles.root}>
    <View style={styles.heading}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>{t(title)}</Text>
      {source && <Pressable accessibilityRole="link"
        accessibilityLabel={t('medicationPurposeSource', { name: source.name })}
        style={styles.source} onPress={() => {
          // Only the manufacturer catalog used by the backend is a source link.
          try {
            const url = new URL(source.url);
            if (url.origin === 'https://dhgpharma.com.vn' && !url.username && !url.password) {
              Linking.openURL(source.url).catch(() => {});
            }
          } catch { /* Leave an invalid source link unopened. */ }
        }}>
        <Ionicons name="information-circle-outline" size={22} color={colors.primaryText} />
      </Pressable>}
    </View>
    {matched && <MedicationPurposeTags codes={purpose.tags} />}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, lineHeight: 22 },
  source: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
