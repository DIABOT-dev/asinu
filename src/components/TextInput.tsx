import { TextInput as RNTextInput, StyleSheet, Text, TextInputProps, View } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export const TextInput = ({ label, error, style, ...rest }: Props) => {
  const scaledTypography = useScaledTypography();
  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { fontSize: scaledTypography.size.sm }]}>{label}</Text> : null}
      <RNTextInput
        style={[
          styles.input,
          { fontSize: scaledTypography.size.md },
          error ? styles.inputError : styles.inputNormal,
          style
        ]}
        placeholderTextColor={colors.textSecondary}
        {...rest}
      />
      {error ? <Text style={[styles.error, { fontSize: scaledTypography.size.sm }]}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.xs
  },
  label: {
    color: colors.textSecondary,
    fontWeight: '600'
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
    color: colors.textPrimary
  },
  inputError: {
    borderColor: colors.danger
  },
  inputNormal: {
    borderColor: colors.border
  },
  error: {
    color: colors.danger
  }
});
