import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { TextInput } from '../../src/components/TextInput';
import { colors, spacing, typography } from '../../src/styles';

type OnboardingRole = 'self' | 'caregiver';

const diabetesOptions = ['Chưa chẩn đoán', 'Tiền đái tháo đường', 'Tuýp 1', 'Tuýp 2', 'Thai kỳ', 'Không rõ'];
const durationOptions = ['Dưới 1 năm', '1-3 năm', '3-5 năm', 'Trên 5 năm', 'Mới phát hiện'];
const treatmentOptions = ['Ăn uống + vận động', 'Thuốc uống', 'Insulin', 'TP bổ sung', 'Chưa dùng gì', 'Khác'];
const comorbidityOptions = [
  'Mỡ máu cao',
  'Cao huyết áp',
  'Men gan cao',
  'Dạ dày/trào ngược',
  'Mất ngủ',
  'Gout',
  'Tê tay chân',
  'Mờ mắt',
  'Hay mệt/choáng',
  'Khác'
];
const allergyOptions = ['Không dị ứng', 'Hải sản', 'Sữa', 'Đậu/hạt', 'Thuốc (ghi rõ)', 'Kiêng theo chế độ', 'Khác'];
const concernOptions = ['Đường huyết cao', 'HbA1c cao', 'Cân nặng', 'Thuốc/insulin', 'Sức khỏe tổng', 'Không rõ'];
const goalOptions = ['Ổn định đường huyết', 'Giảm HbA1c', 'Giảm cân', 'Giảm thuốc/insulin', 'Khỏe hơn', 'Tự tin hơn'];
const relationOptions = ['Bố', 'Mẹ', 'Vợ', 'Chồng', 'Con', 'Anh/Chị/Em', 'Người thân khác'];
const genderOptions = ['Nam', 'Nữ', 'Khác'];

const stepsSelf = ['anthro', 'diabetes', 'treatment', 'comorbidity', 'concern', 'tone'] as const;
const stepsCaregiver = ['relation', 'anthro', 'diabetes', 'treatment', 'comorbidity', 'concern', 'tone'] as const;

export default function OnboardingScreen() {
  const [role, setRole] = useState<OnboardingRole | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState({
    height_cm: '',
    weight_kg: '',
    age: '',
    relation: '',
    patient_gender: '',
    diabetes_status: '',
    disease_duration: '',
    treatment_methods: [] as string[],
    comorbidities: [] as string[],
    comorbidities_extra: '',
    allergies: [] as string[],
    allergies_extra: '',
    main_concern: '',
    goal_3m: '',
    user_call_term: '',
    bot_self_term: ''
  });
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const steps = useMemo(() => {
    if (role === 'caregiver') return stepsCaregiver;
    return stepsSelf;
  }, [role]);

  const currentStep = steps[stepIndex];

  const toggleArray = (key: 'treatment_methods' | 'comorbidities' | 'allergies', value: string) => {
    setState((prev) => {
      const exists = prev[key].includes(value);
      const next = exists ? prev[key].filter((v) => v !== value) : [...prev[key], value];
      return { ...prev, [key]: next };
    });
  };

  const handleNext = () => {
    if (role === null) {
      setRole('self');
      return;
    }
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    router.replace('/(tabs)/home');
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      setRole(null);
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const renderRolePicker = () => (
    <View style={styles.card}>
      <Text style={styles.question}>Bạn đang chăm sóc cho ai?</Text>
      <View style={styles.chipRow}>
        <Chip label="Tôi tự chăm sóc" active={role === 'self'} onPress={() => { setRole('self'); setStepIndex(0); }} />
        <Chip label="Tôi chăm sóc người thân" active={role === 'caregiver'} onPress={() => { setRole('caregiver'); setStepIndex(0); }} />
      </View>
    </View>
  );

  const renderAnthro = () => (
    <View style={styles.card}>
      <Text style={styles.question}>Chỉ số cơ bản</Text>
      <View style={styles.fieldRow}>
        <TextInput label="Chiều cao (cm)" value={state.height_cm} onChangeText={(v) => setState({ ...state, height_cm: v })} keyboardType="numeric" />
        <TextInput label="Cân nặng (kg)" value={state.weight_kg} onChangeText={(v) => setState({ ...state, weight_kg: v })} keyboardType="numeric" />
        <TextInput label="Tuổi" value={state.age} onChangeText={(v) => setState({ ...state, age: v })} keyboardType="numeric" />
      </View>
      {role === 'caregiver' ? (
        <TextInput label="Giới tính người bệnh" value={state.patient_gender} onChangeText={(v) => setState({ ...state, patient_gender: v })} placeholder="Nam/Nữ/Khác" />
      ) : null}
    </View>
  );

  const renderRelation = () => (
    <View style={styles.card}>
      <Text style={styles.question}>Quan hệ với người bệnh</Text>
      <View style={styles.chipRow}>
        {relationOptions.map((opt) => (
          <Chip key={opt} label={opt} active={state.relation === opt} onPress={() => setState({ ...state, relation: opt })} />
        ))}
      </View>
    </View>
  );

  const renderDiabetes = () => (
    <View style={styles.card}>
      <Text style={styles.question}>Tình trạng tiểu đường</Text>
      <View style={styles.chipRow}>
        {diabetesOptions.map((opt) => (
          <Chip key={opt} label={opt} active={state.diabetes_status === opt} onPress={() => setState({ ...state, diabetes_status: opt })} />
        ))}
      </View>
      <Text style={[styles.question, { marginTop: spacing.md }]}>Thời gian mắc</Text>
      <View style={styles.chipRow}>
        {durationOptions.map((opt) => (
          <Chip key={opt} label={opt} active={state.disease_duration === opt} onPress={() => setState({ ...state, disease_duration: opt })} />
        ))}
      </View>
    </View>
  );

  const renderTreatment = () => (
    <View style={styles.card}>
      <Text style={styles.question}>Đang điều trị bằng</Text>
      <View style={styles.chipRow}>
        {treatmentOptions.map((opt) => (
          <Chip key={opt} label={opt} active={state.treatment_methods.includes(opt)} onPress={() => toggleArray('treatment_methods', opt)} />
        ))}
      </View>
    </View>
  );

  const renderComorbidity = () => (
    <View style={styles.card}>
      <Text style={styles.question}>Bệnh kèm / triệu chứng</Text>
      <View style={styles.chipRow}>
        {comorbidityOptions.map((opt) => (
          <Chip key={opt} label={opt} active={state.comorbidities.includes(opt)} onPress={() => toggleArray('comorbidities', opt)} />
        ))}
      </View>
      <TextInput
        label="Ghi thêm (tuỳ chọn)"
        value={state.comorbidities_extra}
        onChangeText={(v) => setState({ ...state, comorbidities_extra: v })}
        placeholder="Nhập thêm nếu cần"
      />
      <Text style={[styles.question, { marginTop: spacing.md }]}>Dị ứng / kiêng</Text>
      <View style={styles.chipRow}>
        {allergyOptions.map((opt) => (
          <Chip key={opt} label={opt} active={state.allergies.includes(opt)} onPress={() => toggleArray('allergies', opt)} />
        ))}
      </View>
      <TextInput
        label="Ghi thêm (tuỳ chọn)"
        value={state.allergies_extra}
        onChangeText={(v) => setState({ ...state, allergies_extra: v })}
        placeholder="Nhập thêm nếu cần"
      />
    </View>
  );

  const renderConcernGoal = () => (
    <View style={styles.card}>
      <Text style={styles.question}>Nỗi lo lớn nhất</Text>
      <View style={styles.chipRow}>
        {concernOptions.map((opt) => (
          <Chip key={opt} label={opt} active={state.main_concern === opt} onPress={() => setState({ ...state, main_concern: opt })} />
        ))}
      </View>
      <Text style={[styles.question, { marginTop: spacing.md }]}>Mục tiêu 1-3 tháng</Text>
      <View style={styles.chipRow}>
        {goalOptions.map((opt) => (
          <Chip key={opt} label={opt} active={state.goal_3m === opt} onPress={() => setState({ ...state, goal_3m: opt })} />
        ))}
      </View>
    </View>
  );

  const renderTone = () => (
    <View style={styles.card}>
      <Text style={styles.question}>Cách xưng hô</Text>
      <TextInput
        label="Asinu gọi bạn là"
        value={state.user_call_term}
        onChangeText={(v) => setState({ ...state, user_call_term: v })}
        placeholder="Anh/Chị/Em/..."
      />
      <TextInput
        label="Asinu tự xưng là"
        value={state.bot_self_term}
        onChangeText={(v) => setState({ ...state, bot_self_term: v })}
        placeholder="Asinu/em/tôi/..."
      />
    </View>
  );

  const renderStep = () => {
    if (role === null) return renderRolePicker();
    switch (currentStep) {
      case 'relation':
        return renderRelation();
      case 'anthro':
        return renderAnthro();
      case 'diabetes':
        return renderDiabetes();
      case 'treatment':
        return renderTreatment();
      case 'comorbidity':
        return renderComorbidity();
      case 'concern':
        return renderConcernGoal();
      case 'tone':
        return renderTone();
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Onboarding</Text>
        <Text style={styles.subtitle}>Vài bước nhanh để Asinu chăm sóc sát hơn</Text>
        {renderStep()}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Bỏ qua" variant="ghost" onPress={() => router.replace('/(tabs)/home')} />
        <Button label="Tiếp tục" onPress={handleNext} />
        <Button label="Quay lại" variant="ghost" onPress={handleBack} />
      </View>
    </View>
  );
}

type ChipProps = { label: string; active?: boolean; onPress: () => void };
const Chip = ({ label, active, onPress }: ChipProps) => (
  <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  header: {
    fontSize: typography.size.xl,
    fontWeight: '800',
    color: colors.textPrimary
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: spacing.sm
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md
  },
  question: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.textPrimary
  },
  fieldRow: {
    gap: spacing.md
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  chipActive: {
    backgroundColor: colors.primary + '22',
    borderColor: colors.primary
  },
  chipText: {
    color: colors.textPrimary
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '700'
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  }
});
