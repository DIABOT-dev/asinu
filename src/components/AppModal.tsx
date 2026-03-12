import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { colors, radius, spacing } from '../styles';

export type AppModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  iconBg?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void; // undefined = single-button info mode
};

export function AppModal({
  visible,
  title,
  message,
  icon,
  iconColor = colors.primary,
  iconBg = colors.primaryLight,
  confirmLabel = 'OK',
  cancelLabel = 'Huỷ',
  destructive = false,
  onConfirm,
  onCancel,
}: AppModalProps) {
  const dismiss = onCancel ?? onConfirm;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        <View style={styles.card}>
          {icon ? (
            <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
              <Ionicons name={icon} size={30} color={iconColor} />
            </View>
          ) : null}
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.btnRow}>
            {onCancel ? (
              <Pressable style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[
                styles.confirmBtn,
                destructive && styles.destructiveBtn,
                !onCancel && styles.confirmBtnFull,
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmBtnFull: {
    flex: 1,
  },
  destructiveBtn: {
    backgroundColor: colors.danger,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
