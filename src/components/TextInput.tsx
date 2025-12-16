import { TextInput as RNTextInput, StyleSheet, View, Text, TextInputProps } from 'react-native';
import { colors, spacing, radius, typography } from '../styles';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export const TextInput = ({ label, error, style, ...rest }: Props) => {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <RNTextInput
        style={[
          styles.input,
          style,
          error ? { borderColor: colors.danger } : { borderColor: colors.border }
        ]}
        placeholderTextColor={colors.textSecondary}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
    fontSize: typography.size.sm,
    fontWeight: '600'
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: typography.size.md
  },
  error: {
    color: colors.danger,
    fontSize: typography.size.sm
  }
});
