import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';

type Props = {
  visible: boolean;
  onClose: () => void;
};

// Only trigger for serious medical actions: medication & diagnosis
const MEDICAL_KEYWORDS = [
  'thuốc', 'uống thuốc', 'kê đơn', 'đơn thuốc', 'thuốc tây', 'liều',
  'kháng sinh', 'paracetamol', 'ibuprofen', 'aspirin',
  'chẩn đoán', 'chữa bệnh', 'điều trị',
  'prescription', 'medication', 'diagnosis',
];

export function containsMedicalKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return MEDICAL_KEYWORDS.some((kw) => lower.includes(kw));
}

export function MedicalDisclaimerModal({ visible, onClose }: Props) {
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning" size={36} color={colors.warning} />
          </View>

          <Text style={styles.title}>
            {t('medicalWarningTitle')}
          </Text>

          <View style={styles.lines}>
            {[
              t('medicalWarning1'),
              t('medicalWarning2'),
              t('medicalWarning3'),
              t('medicalWarning4'),
            ].map((line, i) => (
              <View key={i} style={styles.lineRow}>
                <Text style={styles.bullet}>{'\u2022'}</Text>
                <Text style={styles.lineText}>{line}</Text>
              </View>
            ))}
          </View>

          <View style={styles.buttons}>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={onClose}
            >
              <Text style={styles.btnSecondaryText}>
                {t('understood')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={onClose}
            >
              <Text style={styles.btnPrimaryText}>
                {t('agree')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
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
      fontSize: typography.size.md,
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
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    lineText: {
      flex: 1,
      fontSize: typography.size.xs,
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
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    btnPrimary: {
      backgroundColor: colors.primary,
    },
    btnPrimaryText: {
      fontSize: typography.size.sm,
      fontWeight: '700',
      color: '#fff',
    },
  });
}
