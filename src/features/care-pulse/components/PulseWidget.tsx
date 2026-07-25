import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type ComponentProps, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useScaledTypography } from '../../../hooks/useScaledTypography';
import { ScaledText as Text } from '../../../components/ScaledText';
import { colors, iconColors, spacing } from '../../../styles';
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

  const OPTIONS: Array<{
    label: string;
    status: PulseStatus;
    icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
    color: string;
  }> = [
    { label: t('pulseNormal'), status: 'NORMAL', icon: 'emoticon-happy-outline', color: iconColors.emerald },
    { label: t('pulseTired'), status: 'TIRED', icon: 'emoticon-neutral-outline', color: colors.textSecondary },
    { label: t('pulseEmergency'), status: 'EMERGENCY', icon: 'account-alert-outline', color: iconColors.danger }
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
          <MaterialCommunityIcons name={option.icon} size={24} color={option.color} />
          <Text style={[styles.buttonText, { color: option.color, fontSize: scaledTypography.size.md }]}>
            {option.label}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
};

function createPulseWidgetStyles() { return StyleSheet.create({
  container: { gap: spacing.md },
  button: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.lg,
    borderRadius: 16, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border
  },
  buttonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonText: { flex: 1, fontWeight: '700' }
}); }
