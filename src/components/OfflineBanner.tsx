import { StyleSheet, Text, View } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, spacing } from '../styles';

export const OfflineBanner = ({ message = 'Đang dùng dữ liệu cũ (offline/lỗi mạng).' }: { message?: string }) => {
  const scaledTypography = useScaledTypography();
  return (
    <View style={styles.container}>
      <Text style={[styles.text, { fontSize: scaledTypography.size.md }]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
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
});
