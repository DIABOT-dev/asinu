import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/ui/theme';

export type PillTagProps = {
  label: string;
  icon?: ReactNode;
  selected?: boolean;
  onPress?: () => void;
};

export const PillTag = ({ label, icon, selected = false, onPress }: PillTagProps) => {
  const Container = onPress ? Pressable : View;
  return (
    <Container style={[styles.pill, selected && styles.pillSelected]} onPress={onPress}>
      {icon}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Container>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs
  },
  pillSelected: {
    backgroundColor: colors.primary + '11',
    borderColor: colors.primary
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14
  },
  labelSelected: {
    color: colors.primary,
    fontWeight: '600'
  }
});
