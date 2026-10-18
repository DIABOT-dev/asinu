import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { QueuedModal } from './QueuedModal';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { useThemeColors } from '../hooks/useThemeColors';
import { colors } from '../styles';

export type NoInternetModalProps = {
  visible: boolean;
  onClose: () => void;
  onRetry?: () => void | Promise<void>;
  title?: string;
  message?: string;
  notice?: string;
  retryText?: string;
  laterText?: string;
  priority?: number;
  interruptible?: boolean;
};

export function NoInternetModal({
  visible,
  onClose,
  onRetry,
  title,
  message,
  notice,
  retryText,
  laterText,
  priority = 10,
  interruptible = true,
}: NoInternetModalProps) {
  const { t } = useTranslation('common');
  const { isDark } = useThemeColors();
  const scaledTypography = useScaledTypography();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
          backgroundColor: 'rgba(10, 24, 30, 0.65)',
        },
        card: {
          width: '92%',
          maxWidth: 360,
          backgroundColor: isDark ? colors.surface : '#FFFFFF',
          borderRadius: 36,
          overflow: 'hidden',
          position: 'relative',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: isDark ? 0.35 : 0.16,
          shadowRadius: 32,
          elevation: 16,
        },
        closeButton: {
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: isDark ? colors.surfaceMuted : '#EEF4F8',
          justifyContent: 'center',
          alignItems: 'center',
        },
        illustration: {
          width: '100%',
          height: 248,
          backgroundColor: isDark ? colors.surface : '#FFFFFF',
        },
        content: {
          paddingHorizontal: 22,
          paddingBottom: 26,
          paddingTop: 6,
          alignItems: 'center',
        },
        title: {
          fontSize: Math.max(22, scaledTypography.size.xl),
          fontWeight: '800',
          color: isDark ? colors.textPrimary : '#0D2734',
          textAlign: 'center',
          marginBottom: 10,
        },
        message: {
          fontSize: Math.max(15, scaledTypography.size.md),
          color: isDark ? colors.textSecondary : '#5E7887',
          textAlign: 'center',
          lineHeight: 22,
          paddingHorizontal: 6,
          marginBottom: notice ? 10 : 22,
        },
        notice: {
          fontSize: scaledTypography.size.sm,
          color: colors.warning,
          textAlign: 'center',
          marginBottom: 16,
        },
        buttonContainer: {
          width: '100%',
          gap: 12,
        },
        retryButton: {
          height: 56,
          borderRadius: 28,
          backgroundColor: '#09BAA6',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        retryText: {
          color: '#FFFFFF',
          fontSize: 17,
          fontWeight: '700',
        },
        laterButton: {
          height: 56,
          borderRadius: 28,
          backgroundColor: isDark ? 'rgba(14, 190, 170, 0.15)' : '#E3F5F5',
          alignItems: 'center',
          justifyContent: 'center',
        },
        laterText: {
          color: isDark ? '#2DD4BF' : '#089E8A',
          fontSize: 17,
          fontWeight: '700',
        },
      }),
    [isDark, notice, scaledTypography]
  );

  return (
    <QueuedModal
      interruptible={interruptible}
      priority={priority}
      visible={visible}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons
              name="close"
              size={20}
              color={isDark ? colors.textSecondary : '#728496'}
            />
          </Pressable>

          <Image
            source={require('../../assets/images/no-internet.png')}
            style={styles.illustration}
            resizeMode="cover"
            accessibilityRole="image"
          />

          <View style={styles.content}>
            <Text style={styles.title}>{title ?? t('noInternetTitle')}</Text>
            <Text style={styles.message}>{message ?? t('noInternetMessage')}</Text>
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <View style={styles.buttonContainer}>
              {onRetry ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={retryText ?? t('noInternetRetry')}
                  onPress={onRetry}
                  style={styles.retryButton}
                >
                  <Ionicons name="reload" size={21} color="#FFFFFF" />
                  <Text style={styles.retryText}>
                    {retryText ?? t('noInternetRetry')}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={laterText ?? t('noInternetLater')}
                onPress={onClose}
                style={styles.laterButton}
              >
                <Text style={styles.laterText}>
                  {laterText ?? t('noInternetLater')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </QueuedModal>
  );
}
