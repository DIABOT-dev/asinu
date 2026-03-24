import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

type DeleteAccountModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function DeleteAccountModal({ visible, onClose, onConfirm }: DeleteAccountModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: spacing.xl,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1.5,
      borderColor: colors.danger,
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      fontWeight: '800',
      textAlign: 'center',
      color: colors.danger,
      marginBottom: spacing.md,
    },
    warningText: {
      fontWeight: '700',
      textAlign: 'center',
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    warningBox: {
      backgroundColor: colors.surfaceMuted,
      padding: spacing.md,
      borderRadius: 12,
      marginBottom: spacing.lg,
      borderWidth: 1.5,
      borderColor: colors.danger,
    },
    warningItem: {
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      lineHeight: 22,
    },
    confirmSection: {
      marginBottom: spacing.lg,
    },
    confirmLabel: {
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      fontWeight: '600',
    },
    confirmWord: {
      fontWeight: '800',
      color: colors.danger,
    },
    input: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      padding: spacing.md,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    button: {
      flex: 1,
      padding: spacing.md,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    cancelButton: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    deleteButton: {
      backgroundColor: colors.danger,
      borderWidth: 1.5,
      borderColor: colors.danger,
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    buttonText: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    deleteButtonText: {
      color: '#fff',
    },
  }), [isDark]);
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');

  const CONFIRMATION_WORD = t('deleteConfirmWord');

  const handleConfirm = async () => {
    if (inputValue.trim().toUpperCase() !== CONFIRMATION_WORD) {
      return;
    }

    setIsDeleting(true);
    try {
      await onConfirm();
      setInputValue('');
    } catch (error) {

    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setInputValue('');
      onClose();
    }
  };

  const isConfirmEnabled = inputValue.trim().toUpperCase() === CONFIRMATION_WORD && !isDeleting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable 
        style={styles.overlay} 
        onPress={handleClose}
      >
        <Pressable 
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Icon cảnh báo */}
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons 
              name="alert-circle" 
              size={64} 
              color={colors.danger} 
            />
          </View>

          {/* Tiêu đề */}
          <Text style={[styles.title, { fontSize: scaledTypography.size.xl }]}>
            {t('deleteAccountConfirm')}
          </Text>

          {/* Nội dung cảnh báo */}
          <Text style={[styles.warningText, { fontSize: scaledTypography.size.md }]}>
            {t('deleteAccountWarning')}
          </Text>
          
          <View style={styles.warningBox}>
            <Text style={[styles.warningItem, { fontSize: scaledTypography.size.sm }]}>
              • {t('deleteWarning1')}
            </Text>
            <Text style={[styles.warningItem, { fontSize: scaledTypography.size.sm }]}>
              • {t('deleteWarning2')}
            </Text>
            <Text style={[styles.warningItem, { fontSize: scaledTypography.size.sm }]}>
              • {t('deleteWarning3')}
            </Text>
            <Text style={[styles.warningItem, { fontSize: scaledTypography.size.sm }]}>
              • {t('deleteWarning4')}
            </Text>
          </View>

          {/* Input xác nhận */}
          <View style={styles.confirmSection}>
            <Text style={[styles.confirmLabel, { fontSize: scaledTypography.size.sm }]}>
              {t('deleteConfirmPrompt', { word: CONFIRMATION_WORD })}
            </Text>
            <TextInput
              style={[styles.input, { fontSize: scaledTypography.size.md }]}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={t('deleteConfirmPlaceholder', { word: CONFIRMATION_WORD })}
              autoCapitalize="characters"
              editable={!isDeleting}
            />
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isDeleting}
            >
              <Text style={[styles.buttonText, { fontSize: scaledTypography.size.md }]}>
                {tc('cancel')}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.button, 
                styles.deleteButton,
                !isConfirmEnabled && styles.buttonDisabled
              ]}
              onPress={handleConfirm}
              disabled={!isConfirmEnabled}
            >
              {isDeleting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.buttonText, styles.deleteButtonText, { fontSize: scaledTypography.size.md }]}>
                  {t('deleteAccount')}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
