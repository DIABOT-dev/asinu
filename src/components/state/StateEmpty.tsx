import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../styles';

type Props = {
  message?: string;
};

export const StateEmpty = ({ message = 'Chưa có dữ liệu' }: Props) => (
  <View style={styles.container}>
    <Text style={styles.title}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center'
  },
  title: {
    fontSize: typography.size.md,
    color: colors.textSecondary
  }
});
