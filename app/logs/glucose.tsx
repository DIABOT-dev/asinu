import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { spacing, colors } from '../../src/styles';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { Screen } from '../../src/components/Screen';
import { validateGlucosePayload } from '../../src/features/logs/logs.validation';

export default function GlucoseLogScreen() {
  const [value, setValue] = useState('');
  const [tags, setTags] = useState('Trước ăn');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createGlucose = useLogsStore((state) => state.createGlucose);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  const handleSubmit = async () => {
    const result = validateGlucosePayload(value, tags.split(',').map((t) => t.trim()), notes);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await createGlucose(result.value);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: padTop }]}>
        <H1SectionHeader title="Đường huyết" subtitle="Ghi nhanh" />
        <TextInput label="Giá trị (mg/dL)" keyboardType="numeric" value={value} onChangeText={setValue} error={errors.value} />
        <TextInput label="Tags" value={tags} onChangeText={setTags} placeholder="Trước ăn, Sau ăn" />
        <TextInput label="Ghi chú" value={notes} onChangeText={setNotes} multiline />
        <Button label="Lưu" onPress={handleSubmit} />
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
  }
});
