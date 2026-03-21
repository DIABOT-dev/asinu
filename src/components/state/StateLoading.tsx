import { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing } from '../../styles';

export const StateLoading = () => {
  const styles = useMemo(() => StyleSheet.create({
    container: {
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center'
    }
  }), []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
};
