import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, radius, typography } from '../styles';

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
  const palette =
    variant === 'secondary'
      ? colors.secondary
      : variant === 'warning'
        ? colors.warning
        : colors.primary;
  const backgroundColor = variant === 'ghost' ? 'transparent' : palette;
  const textColor = variant === 'ghost' ? colors.textPrimary : colors.surface;
  const borderColor = variant === 'ghost' ? colors.border : palette;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          borderColor
        },
        style
      ]}
    >
      <Text style={[styles.label, { color: textColor }, textStyle]}>{label}</Text>
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
    fontSize: typography.size.md,
    fontWeight: '600',
    fontFamily: 'System'
  }
});
