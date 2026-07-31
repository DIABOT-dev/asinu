import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { useThemeColors } from '../hooks/useThemeColors';
import { colors, radius, spacing } from '../styles';

export const AI_DATA_CONSENT_KEY = '@asinu/ai_data_consent_v1';

export async function hasAiDataConsent(): Promise<boolean> {
  return (await AsyncStorage.getItem(AI_DATA_CONSENT_KEY)) === 'true';
}

export async function saveAiDataConsent(): Promise<void> {
  await AsyncStorage.setItem(AI_DATA_CONSENT_KEY, 'true');
}

export async function revokeAiDataConsent(): Promise<void> {
  await AsyncStorage.removeItem(AI_DATA_CONSENT_KEY);
}

type Props = {
  visible: boolean;
  onAgree: () => void;
  onDecline: () => void;
};

export function AiDataConsentModal({ visible, onAgree, onDecline }: Props) {
  const { t } = useTranslation('common');
  const typography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(typography), [typography, isDark]);
  const dataItems = [t('aiDataConsentItem1'), t('aiDataConsentItem2'), t('aiDataConsentItem3')];

  const handleAgree = async () => {
    await saveAiDataConsent();
    onAgree();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDecline}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.iconWrap}>
              <Ionicons name="sparkles-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.title}>{t('aiDataConsentTitle')}</Text>
            <Text style={styles.intro}>{t('aiDataConsentIntro')}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('aiDataConsentLabel')}</Text>
              {dataItems.map((item) => (
                <View key={item} style={styles.row}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.rowText}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="locate-outline" size={18} color={colors.primary} />
              <Text style={styles.infoText}>{t('aiDataConsentPurpose')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={18} color={colors.primary} />
              <Text style={styles.infoText}>{t('aiDataConsentRecipient')}</Text>
            </View>
            <Text style={styles.optional}>{t('aiDataConsentOptional')}</Text>

            <View style={styles.actions}>
              <Pressable style={[styles.button, styles.declineButton]} onPress={onDecline}>
                <Text style={styles.declineText}>{t('aiDataConsentDecline')}</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.agreeButton]} onPress={() => { void handleAgree(); }}>
                <Ionicons name="checkmark" size={18} color={colors.surface} />
                <Text style={styles.agreeText}>{t('aiDataConsentAgree')}</Text>
              </Pressable>
            </View>
            <Text style={styles.footer}>{t('aiDataConsentFooter')}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    card: {
      width: '100%',
      maxHeight: '90%',
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 14,
    },
    content: {
      gap: spacing.md,
      paddingBottom: spacing.xs,
    },
    iconWrap: {
      alignSelf: 'center',
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    title: {
      color: colors.textPrimary,
      fontSize: typography.size.lg,
      lineHeight: 28,
      fontWeight: '800',
      textAlign: 'center',
    },
    intro: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      lineHeight: 21,
      textAlign: 'center',
    },
    section: {
      padding: spacing.md,
      gap: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    sectionLabel: {
      color: colors.textPrimary,
      fontSize: typography.size.xs,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    rowText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: typography.size.xs,
      lineHeight: 19,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    infoText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: typography.size.xs,
      lineHeight: 19,
    },
    optional: {
      color: colors.textSecondary,
      fontSize: typography.size.xs,
      lineHeight: 18,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    button: {
      minHeight: 48,
      flex: 1,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    declineButton: {
      backgroundColor: colors.surfaceMuted,
    },
    declineText: {
      color: colors.textSecondary,
      fontSize: typography.size.xs,
      fontWeight: '700',
    },
    agreeButton: {
      backgroundColor: colors.primary,
    },
    agreeText: {
      color: colors.surface,
      fontSize: typography.size.xs,
      fontWeight: '700',
    },
    footer: {
      color: colors.textSecondary,
      fontSize: typography.size.xs,
      lineHeight: 18,
      opacity: 0.75,
      textAlign: 'center',
    },
  });
}
