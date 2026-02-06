import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';

type ButtonVariant = 'primary' | 'secondary' | 'warning' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export const Button = ({ label, onPress, variant = 'primary', disabled, style, textStyle }: ButtonProps) => {
  const scaledTypography = useScaledTypography();
  const variantStyles = useMemo(() => {
    const palette =
      variant === 'secondary'
        ? colors.secondary
        : variant === 'warning'
          ? colors.warning
          : colors.primary;
    const backgroundColor = variant === 'ghost' ? 'transparent' : palette;
    const textColor = variant === 'ghost' ? colors.textPrimary : colors.surface;
    const borderColor = variant === 'ghost' ? colors.border : palette;
    
    return { backgroundColor, textColor, borderColor };
  }, [variant]);

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
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1
  },
  label: {
    fontWeight: '600',
    fontFamily: 'System'
  }
});
