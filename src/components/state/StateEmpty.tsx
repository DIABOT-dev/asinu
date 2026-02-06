import { StyleSheet, Text, View } from 'react-native';
import { useScaledTypography } from '../../hooks/useScaledTypography';
import { colors, spacing } from '../../styles';

type Props = {
  message?: string;
};

export const StateEmpty = ({ message = 'Chưa có dữ liệu' }: Props) => {
  const scaledTypography = useScaledTypography();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontSize: scaledTypography.size.md }]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center'
  },
  title: {
    color: colors.textSecondary
  }
});
