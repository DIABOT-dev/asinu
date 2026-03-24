import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useScaledTypography } from '../../hooks/useScaledTypography';
import { colors, spacing } from '../../styles';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Button } from '../Button';

type Props = {
  message?: string;
  onRetry?: () => void;
};

export const StateError = ({ message, onRetry }: Props) => {
  const scaledTypography = useScaledTypography();
  const { t } = useTranslation('common');
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm
    },
    title: {
      fontWeight: '700',
      color: colors.textPrimary
    },
    subtitle: {
      color: colors.textSecondary,
      textAlign: 'center'
    },
    retryButton: {
      marginTop: spacing.md
    }
  }), [isDark]);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontSize: scaledTypography.size.lg }]}>{t('cannotLoadData')}</Text>
      <Text style={[styles.subtitle, { fontSize: scaledTypography.size.md }]}>{message ?? t('errorOccurred')}</Text>
      {onRetry ? <Button label={t('retry')} onPress={onRetry} style={styles.retryButton} /> : null}
    </View>
  );
};
