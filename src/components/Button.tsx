import React from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { ScaledText as Text } from './ScaledText';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

type ButtonVariant = 'primary' | 'secondary' | 'warning' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export const Button = React.memo(({ label, onPress, variant = 'primary', disabled, style, textStyle }: ButtonProps) => {
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    base: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      alignItems: 'center',
      borderWidth: 1
    },
    label: {
      fontWeight: '600',
      fontFamily: 'Inter_600SemiBold'
    }
  }), [isDark]);
  const variantStyles = useMemo(() => {
    const backgroundColor =
      variant === 'ghost'
        ? 'transparent'
        : variant === 'warning'
          ? colors.premiumLight
          : variant === 'secondary'
            ? colors.surfaceMuted
            : colors.primaryLight;
    const textColor =
      variant === 'warning'
        ? colors.premiumDark
        : variant === 'ghost'
          ? colors.textPrimary
          : colors.primaryDark;
    
    return { backgroundColor, textColor, borderColor: colors.border };
  }, [variant, isDark]);

  const getButtonStyle = useMemo(
    () => ({ pressed }: { pressed: boolean }) => [
      styles.base,
      {
        backgroundColor: variantStyles.backgroundColor,
        opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
        borderColor: variantStyles.borderColor
      },
      style
    ],
    [variantStyles, disabled, style]
  );

  const labelStyle = useMemo(
    () => [styles.label, { color: variantStyles.textColor, fontSize: scaledTypography.size.md }, textStyle],
    [variantStyles.textColor, scaledTypography.size.md, textStyle]
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={getButtonStyle}
    >
      <Text style={labelStyle}>{label}</Text>
    </Pressable>
  );
});
