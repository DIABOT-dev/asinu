import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';

/** A single loading state, replaced by the complete form as soon as it is ready. */
export function AuthScreenLoading() {
  const { t } = useTranslation('common');
  const { colors, isDark } = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0A1A2F' : '#FAFCFE' }]}>
      <ActivityIndicator size="large" color={colors.primary}
        accessibilityRole="progressbar" accessibilityLabel={t('loading')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
