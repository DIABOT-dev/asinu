import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';
import { NoInternetModal } from './NoInternetModal';

export const OfflineBanner = ({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void | Promise<void>;
}) => {
  const [showModal, setShowModal] = useState(false);
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.warning,
          padding: spacing.md,
          borderRadius: 12,
          marginHorizontal: spacing.xl,
          marginBottom: spacing.md,
        },
        text: {
          color: colors.textPrimary,
          fontWeight: '700',
        },
      }),
    [isDark]
  );
  const displayMessage = message ?? t('offlineBanner');
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={displayMessage}
        onPress={() => setShowModal(true)}
        style={styles.container}
      >
        <Text style={[styles.text, { fontSize: scaledTypography.size.md }]}>
          {displayMessage}
        </Text>
      </Pressable>
      <NoInternetModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onRetry={
          onRetry
            ? async () => {
                await onRetry();
                setShowModal(false);
              }
            : undefined
        }
      />
    </>
  );
};
