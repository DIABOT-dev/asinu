import { ReactNode, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput as RNTextInput, TextInputProps, View } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
};

export const TextInput = ({ label, error, style, leftIcon, rightElement, onFocus, onBlur, ...rest }: Props) => {
  const scaledTypography = useScaledTypography();
  const [focused, setFocused] = useState(false);
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    outer: {
      width: '100%',
      gap: spacing.xs,
    },
    label: {
      color: colors.textSecondary,
      fontWeight: '600',
    },
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    iconLeft: {
      marginRight: spacing.sm,
    },
    iconRight: {
      marginLeft: spacing.sm,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      paddingVertical: 0,
    },
    error: {
      color: colors.danger,
    },
  }), [isDark]);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;
  const bgColor = error ? '#fff5f5' : focused ? colors.primaryLight : colors.surface;

  return (
    <View style={styles.outer}>
      {label ? (
        <Text style={[styles.label, { fontSize: scaledTypography.size.sm }]}>{label}</Text>
      ) : null}
      <View style={[styles.wrapper, { borderColor, backgroundColor: bgColor }, style as any]}>
        {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
        <RNTextInput
          style={[styles.input, { fontSize: scaledTypography.size.md }]}
          placeholderTextColor={colors.textSecondary}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
        {rightElement ? <View style={styles.iconRight}>{rightElement}</View> : null}
      </View>
      {error ? (
        <Text style={[styles.error, { fontSize: scaledTypography.size.sm }]}>{error}</Text>
      ) : null}
    </View>
  );
};
