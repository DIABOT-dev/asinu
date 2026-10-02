import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { useFontSizeStore } from '../stores/font-size.store';
import { useThemeColors } from '../hooks/useThemeColors';
import { radius, spacing } from '../styles';

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
  const fontScale = useFontSizeStore((state) => state.scale);
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(typography, isDark), [typography, isDark]);

  const dataItems = [
    {
      icon: 'chatbubble-ellipses-outline' as const,
      text: t('aiDataConsentItem1'),
    },
    {
      icon: 'mic-outline' as const,
      text: t('aiDataConsentItem2'),
    },
    {
      icon: 'pulse-outline' as const,
      text: t('aiDataConsentItem3'),
    },
  ];

  const shouldStackActions = fontScale === 'large' || fontScale === 'xlarge';

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
          {/* Close button X */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            hitSlop={12}
            style={styles.closeButton}
            onPress={onDecline}
          >
            <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
          </Pressable>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Header: Mascot Image on left, Title block on right */}
            <View style={styles.headerRow}>
              <View style={styles.mascotWrapper}>
                <Image
                  source={require('../../assets/images/asinu_ai_privacy_mascot.png')}
                  style={styles.mascotImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.headerTextCol}>
                <Text style={styles.titlePart1}>{t('aiDataConsentTitlePart1')}</Text>
                <Text style={styles.titlePart2}>{t('aiDataConsentTitlePart2')}</Text>
                <Text style={styles.intro}>{t('aiDataConsentIntro')}</Text>
              </View>
            </View>

            {/* Mint Card: Data items list without icon background circles */}
            <View style={styles.mintCard}>
              <View style={styles.mintCardHeader}>
                <Ionicons
                  name="shield-checkmark"
                  size={20}
                  color={isDark ? '#34d399' : '#059669'}
                  style={styles.noBgIcon}
                />
                <Text style={styles.mintCardTitle}>{t('aiDataConsentLabel')}</Text>
              </View>

              {dataItems.map((item, index) => (
                <View key={item.text}>
                  <View style={styles.dataItemRow}>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={isDark ? '#2dd4bf' : '#087F73'}
                      style={styles.noBgIcon}
                    />
                    <Text style={styles.dataItemText}>{item.text}</Text>
                  </View>
                  {index < dataItems.length - 1 && <View style={styles.dataItemDivider} />}
                </View>
              ))}
            </View>

            {/* Purpose & Recipient Info rows without icon background circles */}
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Ionicons
                  name="sparkles-outline"
                  size={20}
                  color={isDark ? '#38bdf8' : '#0284c7'}
                  style={styles.noBgIcon}
                />
                <Text style={styles.infoTextContainer}>
                  <Text style={styles.infoBoldLabel}>{t('aiDataConsentPurposeLabel')} </Text>
                  <Text style={styles.infoValueText}>{t('aiDataConsentPurposeValue')}</Text>
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={isDark ? '#38bdf8' : '#0284c7'}
                  style={styles.noBgIcon}
                />
                <Text style={styles.infoTextContainer}>
                  <Text style={styles.infoBoldLabel}>{t('aiDataConsentRecipientLabel')} </Text>
                  <Text style={styles.infoValueText}>{t('aiDataConsentRecipientValue')}</Text>
                </Text>
              </View>
            </View>

            {/* Subtle Divider */}
            <View style={styles.footerDivider} />

            {/* Footer Disclaimer */}
            <View style={styles.footerRow}>
              <Ionicons
                name="shield-outline"
                size={16}
                color={isDark ? '#64748b' : '#94a3b8'}
                style={styles.noBgIcon}
              />
              <Text style={styles.footerText}>{t('aiDataConsentFooter')}</Text>
            </View>

            {/* Action Buttons: Decline & Allow ("Cho phép") */}
            <View style={[styles.actions, shouldStackActions && styles.actionsStacked]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('aiDataConsentDecline')}
                style={[
                  styles.button,
                  styles.declineButton,
                  shouldStackActions && styles.stackedButton,
                ]}
                onPress={onDecline}
              >
                <Text style={styles.declineText}>{t('aiDataConsentDecline')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('aiDataConsentAgree')}
                style={[
                  styles.button,
                  styles.agreeButton,
                  shouldStackActions && styles.stackedButton,
                ]}
                onPress={() => { void handleAgree(); }}
              >
                <Text style={styles.agreeText}>{t('aiDataConsentAgree')}</Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" />
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>, isDark: boolean) {
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#475569';
  const mintBg = isDark ? 'rgba(8, 184, 162, 0.12)' : '#f0fbf8';
  const mintBorder = isDark ? 'rgba(45, 212, 191, 0.25)' : '#ccfbf1';
  const mintTitle = isDark ? '#5eead4' : '#134e4a';
  const itemDivider = isDark ? 'rgba(45, 212, 191, 0.15)' : '#e2f4f0';
  const declineBg = isDark ? '#334155' : '#f1f5f9';
  const declineText = isDark ? '#f8fafc' : '#334155';
  const agreeBg = isDark ? '#0d9488' : '#087F73';
  const footerBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9';

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
    },
    card: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '92%',
      backgroundColor: cardBg,
      borderRadius: radius.xxl ?? 28,
      paddingTop: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      position: 'relative',
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 12 },
      elevation: 16,
    },
    closeButton: {
      position: 'absolute',
      top: 14,
      right: 14,
      zIndex: 10,
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      gap: spacing.md,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingRight: spacing.sm,
    },
    mascotWrapper: {
      width: 105,
      height: 115,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mascotImage: {
      width: '100%',
      height: '100%',
    },
    headerTextCol: {
      flex: 1,
      justifyContent: 'center',
    },
    titlePart1: {
      color: textPrimary,
      fontSize: typography.size.md + 1,
      fontWeight: '700',
      lineHeight: 22,
    },
    titlePart2: {
      color: agreeBg,
      fontSize: typography.size.lg + 3,
      fontWeight: '800',
      lineHeight: 30,
      marginTop: 2,
    },
    intro: {
      color: textSecondary,
      fontSize: typography.size.xs,
      lineHeight: 18,
      marginTop: 6,
    },
    mintCard: {
      backgroundColor: mintBg,
      borderColor: mintBorder,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    mintCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      marginBottom: 2,
    },
    mintCardTitle: {
      color: mintTitle,
      fontSize: typography.size.xs + 1,
      fontWeight: '700',
    },
    dataItemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: 2,
    },
    noBgIcon: {
      marginTop: 1,
    },
    dataItemText: {
      flex: 1,
      color: textSecondary,
      fontSize: typography.size.xs,
      lineHeight: 18.5,
    },
    dataItemDivider: {
      height: 1,
      backgroundColor: itemDivider,
      marginVertical: 4,
    },
    infoSection: {
      gap: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    infoTextContainer: {
      flex: 1,
      fontSize: typography.size.xs,
      lineHeight: 19,
    },
    infoBoldLabel: {
      color: textPrimary,
      fontWeight: '700',
      fontSize: typography.size.xs,
    },
    infoValueText: {
      color: textSecondary,
      fontSize: typography.size.xs,
    },
    footerDivider: {
      height: 1,
      backgroundColor: footerBorder,
      marginTop: -2,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    footerText: {
      color: isDark ? '#64748b' : '#94a3b8',
      fontSize: typography.size.xs - 0.5,
      lineHeight: 16,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    actionsStacked: {
      flexDirection: 'column',
    },
    button: {
      minHeight: 48,
      minWidth: 0,
      flex: 1,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    stackedButton: {
      flex: 0,
      width: '100%',
      minHeight: 50,
      paddingHorizontal: spacing.md,
    },
    declineButton: {
      backgroundColor: declineBg,
    },
    declineText: {
      color: declineText,
      fontSize: typography.size.sm,
      fontWeight: '700',
      textAlign: 'center',
    },
    agreeButton: {
      backgroundColor: agreeBg,
      flex: 1.15,
    },
    agreeText: {
      color: '#ffffff',
      fontSize: typography.size.sm,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
}
