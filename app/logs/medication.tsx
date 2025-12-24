import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { spacing } from '../../src/styles';
import { colors } from '../../src/styles/theme';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { Screen } from '../../src/components/Screen';
import { validateMedicationPayload } from '../../src/features/logs/logs.validation';

export default function MedicationLogScreen() {
  const router = useRouter();
  const [medication, setMedication] = useState('Insulin');
  const [dose, setDose] = useState('5u');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createMedication = useLogsStore((state) => state.createMedication);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  const handleSubmit = async () => {
    const result = validateMedicationPayload(medication, dose, notes);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await createMedication(result.value);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true, // Bắt buộc hiện Header
          presentation: 'modal', // Hiệu ứng trượt lên
          title: 'Ghi chỉ số', // (Hoặc giữ nguyên title cũ nếu có)
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.textPrimary },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 0, padding: 10 }}>
              {/* Dùng Icon mũi tên, size 28 cho dễ bấm, màu đen cho tương phản tốt */}
              <Ionicons name="arrow-back" size={28} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <Screen>
        <ScrollView contentContainerStyle={[styles.container, { paddingTop: padTop }]}>
          <H1SectionHeader title="Thuoc / Insulin" subtitle="Ghi nhanh" />
          <TextInput label="Thuoc" value={medication} onChangeText={setMedication} error={errors.medication} />
          <TextInput label="Liều lượng" value={dose} onChangeText={setDose} error={errors.dose} />
          {errors.medication ? <Text style={styles.error}>{errors.medication}</Text> : null}
          {errors.dose ? <Text style={styles.error}>{errors.dose}</Text> : null}
          <TextInput label="Ghi chú" value={notes} onChangeText={setNotes} multiline />
          <Button label="Lưu" onPress={handleSubmit} />
        </ScrollView>
      </Screen>
    </>
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
