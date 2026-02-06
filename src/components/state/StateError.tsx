import { StyleSheet, Text, View } from 'react-native';
import { useScaledTypography } from '../../hooks/useScaledTypography';
import { colors, spacing } from '../../styles';
import { Button } from '../Button';

type Props = {
  message?: string;
  onRetry?: () => void;
};

export const StateError = ({ message = 'Có lỗi xảy ra', onRetry }: Props) => {
  const scaledTypography = useScaledTypography();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontSize: scaledTypography.size.lg }]}>Không tải được dữ liệu</Text>
      <Text style={[styles.subtitle, { fontSize: scaledTypography.size.md }]}>{message}</Text>
      {onRetry ? <Button label="Thử lại" onPress={onRetry} style={styles.retryButton} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
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
});
