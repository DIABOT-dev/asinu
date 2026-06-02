import { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../ScaledText';
import { colors, spacing } from '../../styles';
import { useThemeColors } from '../../hooks/useThemeColors';

type StateLoadingProps = {
  message?: string;
  overlay?: boolean;
};

export const StateLoading = ({ message, overlay = true }: StateLoadingProps) => {
  const { t } = useTranslation('common');
  const { isDark } = useThemeColors();
  const displayMessage = message ?? t('loading');
  const styles = useMemo(() => StyleSheet.create({
    container: {
      ...(overlay ? StyleSheet.absoluteFillObject : null),
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: overlay
        ? (isDark ? 'rgba(8, 13, 17, 0.68)' : 'rgba(24, 28, 32, 0.52)')
        : 'transparent',
      zIndex: 50,
      elevation: 50,
    },
    indicatorWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    text: {
      color: overlay ? '#f8fafc' : colors.textSecondary,
      fontSize: 18,
      fontWeight: '700',
    },
  }), [isDark]);

  return (
    <View style={styles.container}>
      <View style={styles.indicatorWrap}>
        <ActivityIndicator color={overlay ? '#d1d5db' : colors.primary} size="large" />
        <Text style={styles.text}>{displayMessage}</Text>
      </View>
    </View>
  );
};
