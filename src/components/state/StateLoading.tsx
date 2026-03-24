import { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing } from '../../styles';
import { useThemeColors } from '../../hooks/useThemeColors';

export const StateLoading = () => {
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center'
    }
  }), [isDark]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
};
