import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { colors, radius, spacing } from '../styles';

type Props = {
  visible: boolean;
  onClose: () => void;
};

// Keywords triggering the disclaimer (user message OR AI reply)
const MEDICAL_KEYWORDS = [
  'thuốc', 'bệnh', 'chữa', 'điều trị', 'chẩn đoán', 'triệu chứng',
  'viêm', 'dược', 'kê đơn', 'liều', 'uống thuốc', 'tiêm', 'vaccine',
  'kháng sinh', 'paracetamol', 'ibuprofen', 'aspirin', 'thuốc tây',
  'đơn thuốc', 'phẫu thuật', 'nhập viện', 'cấp cứu', 'drug', 'medicine',
  'medication', 'prescription', 'diagnosis', 'symptom', 'fever', 'pain',
];

export function containsMedicalKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return MEDICAL_KEYWORDS.some((kw) => lower.includes(kw));
}

export function MedicalDisclaimerModal({ visible, onClose }: Props) {
  const { t } = useTranslation('chat');
  const lines = t('medDisclaimer.lines', { returnObjects: true }) as string[];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning" size={36} color={colors.warning} />
          </View>

          <Text style={styles.title}>{t('medDisclaimer.title')}</Text>

          <View style={styles.lines}>
            {lines.map((line, i) => (
              <View key={i} style={styles.lineRow}>
                <Text style={styles.bullet}>{'\u2022'}</Text>
                <Text style={styles.lineText}>{line}</Text>
              </View>
            ))}
          </View>

          <View style={styles.buttons}>
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onClose}>
              <Text style={styles.btnSecondaryText}>{t('medDisclaimer.gotIt')}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onClose}>
              <Text style={styles.btnPrimaryText}>{t('medDisclaimer.agree')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  lines: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  lineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  lineText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    backgroundColor: colors.surfaceMuted,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
