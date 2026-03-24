import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

export const OfflineBanner = ({ message }: { message?: string }) => {
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.warning,
      padding: spacing.md,
      borderRadius: 12,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md
    },
    text: {
      color: colors.textPrimary,
      fontWeight: '700'
    }
  }), [isDark]);
  const displayMessage = message ?? t('offlineBanner');
  return (
    <View style={styles.container}>
      <Text style={[styles.text, { fontSize: scaledTypography.size.md }]}>{displayMessage}</Text>
    </View>
  );
};
