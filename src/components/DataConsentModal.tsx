import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

export const DATA_CONSENT_KEY = '@asinu/data_consent_v1';

export async function hasDataConsent(): Promise<boolean> {
  const val = await AsyncStorage.getItem(DATA_CONSENT_KEY);
  return val === 'true';
}

export async function saveDataConsent(): Promise<void> {
  await AsyncStorage.setItem(DATA_CONSENT_KEY, 'true');
}

export async function revokeDataConsent(): Promise<void> {
  await AsyncStorage.removeItem(DATA_CONSENT_KEY);
}

type Props = {
  visible: boolean;
  onAgree: () => void;
};

export function DataConsentModal({ visible, onAgree }: Props) {
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);
  const items = [t('dataConsentItem1'), t('dataConsentItem2'), t('dataConsentItem3'), t('dataConsentItem4')];

  const handleAgree = async () => {
    await saveDataConsent();
    onAgree();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
          </View>

          <Text style={styles.title}>
            {t('dataConsentTitle')}
          </Text>

          <Text style={styles.intro}>
            {t('dataConsentIntro')}
          </Text>

          <View style={styles.dataBox}>
            <Text style={styles.dataBoxLabel}>
              {t('dataConsentLabel')}
            </Text>
            {items.map((item, i) => (
              <View key={i} style={styles.dataRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.dataText}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.note}>
            {t('dataConsentNote')}
          </Text>

          <View style={styles.buttons}>
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => {}}>
              <Text style={styles.btnSecondaryText}>
                {t('decline')}
              </Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleAgree}>
              <Text style={styles.btnPrimaryText}>
                {t('iAgree')}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>
            {t('dataConsentFooter')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: spacing.xxl,
      gap: spacing.md,
      paddingBottom: spacing.xxl + 16,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: -4 },
      elevation: 12,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: spacing.xs,
    },
    title: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    intro: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },
    dataBox: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    dataBoxLabel: {
      fontSize: typography.size.xs,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    dataRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'flex-start',
    },
    dataText: {
      flex: 1,
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    note: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      lineHeight: 18,
      textAlign: 'center',
    },
    buttons: {
      flexDirection: 'row',
      gap: spacing.md,
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
    footer: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      textAlign: 'center',
      opacity: 0.7,
    },
  });
}
