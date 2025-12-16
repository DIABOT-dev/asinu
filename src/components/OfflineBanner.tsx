import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../styles';

export const OfflineBanner = ({ message = 'Đang dùng dữ liệu cũ (offline/lỗi mạng).' }: { message?: string }) => (
  <View style={styles.container}>
    <Text style={styles.text}>{message}</Text>
  </View>
);

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
