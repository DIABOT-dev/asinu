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
import { validateInsulinPayload } from '../../src/features/logs/logs.validation';

export default function InsulinLogScreen() {
  const router = useRouter();
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
          <H1SectionHeader title="Insulin" subtitle="Ghi nhanh" />
          <TextInput label="Loại insulin" value={insulinType} onChangeText={setInsulinType} error={errors.insulin_type} />
          <TextInput label="Liều lượng (u)" keyboardType="numeric" value={dose} onChangeText={setDose} error={errors.dose_units} />
          <TextInput label="Bữa ăn" value={mealId} onChangeText={setMealId} placeholder="Tuy chon" />
          <TextInput label="Ghi chú" value={notes} onChangeText={setNotes} multiline />
          {errors.insulin_type ? <Text style={styles.error}>{errors.insulin_type}</Text> : null}
          {errors.dose_units ? <Text style={styles.error}>{errors.dose_units}</Text> : null}
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
