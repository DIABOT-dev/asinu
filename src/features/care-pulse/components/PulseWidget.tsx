import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useScaledTypography } from '../../../hooks/useScaledTypography';
import { colors, spacing } from '../../../styles';
import { useCarePulseStore } from '../store/carePulse.store';
import { PulseStatus, TriggerSource } from '../types';

type Props = {
  triggerSource?: TriggerSource;
  onComplete?: () => void;
};

export const PulseWidget = ({ triggerSource = 'HOME_WIDGET', onComplete }: Props) => {
  const { t } = useTranslation('home');
  const styles = useMemo(() => createPulseWidgetStyles(), []);
  const checkIn = useCarePulseStore((state) => state.checkIn);
  const scaledTypography = useScaledTypography();

  const OPTIONS: { label: string; status: PulseStatus }[] = [
    { label: t('pulseNormal'), status: 'NORMAL' },
    { label: t('pulseTired'), status: 'TIRED' },
    { label: t('pulseEmergency'), status: 'EMERGENCY' }
  ];

  const handlePress = async (status: PulseStatus) => {
    await checkIn(status, undefined, triggerSource);
    onComplete?.();
  };

  return (
    <View style={styles.container}>
      {OPTIONS.map((option) => (
        <Pressable
          key={option.status}
          onPress={() => handlePress(option.status)}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={[styles.buttonText, { fontSize: scaledTypography.size.md }]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
};

function createPulseWidgetStyles() { return StyleSheet.create({
  container: { gap: spacing.md },
  button: {
    paddingVertical: spacing.lg, paddingHorizontal: spacing.lg,
    borderRadius: 16, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center'
  },
  buttonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonText: { fontWeight: '700', color: colors.textPrimary }
}); }
