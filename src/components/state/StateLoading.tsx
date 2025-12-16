import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing } from '../../styles';

export const StateLoading = () => (
  <View style={styles.container}>
    <ActivityIndicator color={colors.primary} size="large" />
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
