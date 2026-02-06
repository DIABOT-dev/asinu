import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useScaledTypography } from '../../../hooks/useScaledTypography';
import { colors, spacing } from '../../../styles';
import { useCarePulseStore } from '../store/carePulse.store';
import { PulseWidget } from './PulseWidget';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export const PulsePopup = ({ visible, onClose }: Props) => {
  const recordPopupDismiss = useCarePulseStore((state) => state.recordPopupDismiss);
  const scaledTypography = useScaledTypography();

  const handleDismiss = () => {
    recordPopupDismiss();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable onPress={handleDismiss} style={styles.closeButton}>
            <Text style={[styles.closeText, { fontSize: scaledTypography.size.md }]}>Đóng</Text>
          </Pressable>
          <Text style={[styles.title, { fontSize: scaledTypography.size.lg }]}>Bạn đang cảm thấy thế nào?</Text>
          <PulseWidget triggerSource="POPUP" onComplete={onClose} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: spacing.xl
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    gap: spacing.lg
  },
  closeButton: {
    alignSelf: 'flex-end'
  },
  closeText: {
    color: colors.textSecondary,
    fontWeight: '600'
  },
  title: {
    fontWeight: '700',
    color: colors.textPrimary
  }
});
