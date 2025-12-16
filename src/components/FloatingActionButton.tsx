import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../styles';

type Props = {
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
};

export const FloatingActionButton = ({ label, onPress, style }: Props) => {
  return (
    <Pressable style={[styles.fab, style]} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5
  },
  label: {
    color: colors.surface,
    fontSize: typography.size.md,
    fontWeight: '700',
    fontFamily: 'System'
  }
});
