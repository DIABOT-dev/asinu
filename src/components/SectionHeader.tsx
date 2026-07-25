import { useMemo } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { ScaledText as Text } from './ScaledText';
import { colors, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

type Props = ViewProps & {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export const SectionHeader = ({ title, subtitle, action, style }: Props) => {
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md
    },
    title: {
      fontWeight: '700',
      color: colors.textPrimary,
      fontFamily: 'Inter_700Bold'
    },
    subtitle: {
      color: colors.textSecondary,
      marginTop: spacing.xs,
      fontFamily: 'Inter_400Regular'
    }
  }), [isDark]);

  return (
    <View style={[styles.container, style]}>
      <View>
        <Text style={[styles.title, { fontSize: scaledTypography.size.lg }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { fontSize: scaledTypography.size.md }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
};
