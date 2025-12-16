import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../styles';
import { Button } from '../Button';

type Props = {
  message?: string;
  onRetry?: () => void;
};

export const StateError = ({ message = 'Có lỗi xảy ra', onRetry }: Props) => (
  <View style={styles.container}>
    <Text style={styles.title}>Không tải được dữ liệu</Text>
    <Text style={styles.subtitle}>{message}</Text>
    {onRetry ? <Button label="Thử lại" onPress={onRetry} style={{ marginTop: spacing.md }} /> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.textPrimary
  },
  subtitle: {
    color: colors.textSecondary,
    textAlign: 'center'
  }
});
