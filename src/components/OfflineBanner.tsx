import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '../styles';
import { ScaledText } from './ScaledText';

export const OfflineBanner = ({ message }: { message?: string }) => {
  const { t } = useTranslation('common');
  const displayMessage = message ?? t('offlineBanner');
  return (
    <View style={styles.container}>
      <ScaledText style={styles.text}>{displayMessage}</ScaledText>
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
    fontWeight: '700',
    fontSize: 15,
  }
});
