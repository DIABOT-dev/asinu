import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/ui/theme';

export type FormScreenLayoutProps = {
  title: string;
  description?: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  children: ReactNode;
};

export const FormScreenLayout = ({
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  children
}: FormScreenLayoutProps) => {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        <View style={styles.formContent}>{children}</View>
        <Pressable style={styles.primaryButton} onPress={onPrimaryAction}>
          <Text style={styles.primaryLabel}>{primaryActionLabel}</Text>
        </Pressable>
        {secondaryActionLabel ? (
          <Pressable onPress={onSecondaryAction}>
            <Text style={styles.secondaryLabel}>{secondaryActionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.xl,
    backgroundColor: colors.background,
    justifyContent: 'center'
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: spacing.xl,
    gap: spacing.lg,
    elevation: 2
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary
  },
  formContent: {
    gap: spacing.md
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 16,
    alignItems: 'center'
  },
  primaryLabel: {
    color: colors.surface,
    fontWeight: '600'
  },
  secondaryLabel: {
    textAlign: 'center',
    color: colors.textSecondary
  }
});
