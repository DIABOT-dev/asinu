import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useScaledTypography } from '../../hooks/useScaledTypography';
import { colors, spacing } from '../../styles';

type Props = {
  message?: string;
};

export const StateEmpty = ({ message }: Props) => {
  const scaledTypography = useScaledTypography();
  const { t } = useTranslation('common');
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontSize: scaledTypography.size.md }]}>{message ?? t('noData')}</Text>
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
