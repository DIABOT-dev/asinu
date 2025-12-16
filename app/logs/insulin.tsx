import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { spacing, colors } from '../../src/styles';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { Screen } from '../../src/components/Screen';
import { validateInsulinPayload } from '../../src/features/logs/logs.validation';

export default function InsulinLogScreen() {
  const [insulinType, setInsulinType] = useState('');
  const [dose, setDose] = useState('');
  const [mealId, setMealId] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createInsulin = useLogsStore((state) => state.createInsulin);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  const handleSubmit = async () => {
    const result = validateInsulinPayload(insulinType, dose, mealId, notes);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await createInsulin(result.value);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: padTop }]}>
        <H1SectionHeader title="Insulin" subtitle="Ghi nhanh" />
        <TextInput label="Loai insulin" value={insulinType} onChangeText={setInsulinType} error={errors.insulin_type} />
        <TextInput label="Lieu (u)" keyboardType="numeric" value={dose} onChangeText={setDose} error={errors.dose_units} />
        <TextInput label="Meal ID" value={mealId} onChangeText={setMealId} placeholder="Tuy chon" />
        <TextInput label="Ghi chu" value={notes} onChangeText={setNotes} multiline />
        {errors.insulin_type ? <Text style={styles.error}>{errors.insulin_type}</Text> : null}
        {errors.dose_units ? <Text style={styles.error}>{errors.dose_units}</Text> : null}
        <Button label="Luu" onPress={handleSubmit} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  error: {
    color: colors.danger,
    fontWeight: '600'
  }
});
