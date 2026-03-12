import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from './ScaledText';
import { colors, radius, spacing } from '../styles';

export const DATA_CONSENT_KEY = '@asinu/data_consent_v1';

export async function hasDataConsent(): Promise<boolean> {
  const val = await AsyncStorage.getItem(DATA_CONSENT_KEY);
  return val === 'true';
}

export async function saveDataConsent(): Promise<void> {
  await AsyncStorage.setItem(DATA_CONSENT_KEY, 'true');
}

export async function revokeDataConsent(): Promise<void> {
  await AsyncStorage.removeItem(DATA_CONSENT_KEY);
}

type Props = {
  visible: boolean;
  onAgree: () => void;
};

const DATA_ITEMS_VI = [
  'Chỉ số sức khoẻ bạn nhập (đường huyết, huyết áp, cân nặng, nước uống...)',
  'Thông tin cá nhân cơ bản (tuổi, giới tính, mục tiêu sức khoẻ)',
  'Lịch sử trò chuyện với AI để cải thiện tư vấn',
  'Thông báo nhắc nhở theo dõi sức khoẻ hàng ngày',
];

const DATA_ITEMS_EN = [
  'Health metrics you enter (glucose, blood pressure, weight, water intake...)',
  'Basic personal info (age, gender, health goals)',
  'AI chat history to improve personalized advice',
  'Daily health tracking reminder notifications',
];

export function DataConsentModal({ visible, onAgree }: Props) {
  const { i18n } = useTranslation();
  const isVi = i18n.language !== 'en';
  const items = isVi ? DATA_ITEMS_VI : DATA_ITEMS_EN;

  const handleAgree = async () => {
    await saveDataConsent();
    onAgree();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
          </View>

          <Text style={styles.title}>
            {isVi ? 'Đồng ý sử dụng dữ liệu' : 'Data Usage Consent'}
          </Text>

          <Text style={styles.intro}>
            {isVi
              ? 'Để cung cấp trải nghiệm theo dõi và tư vấn sức khoẻ cá nhân hoá, Asinu cần thu thập một số dữ liệu của bạn.'
              : 'To provide personalised health tracking and AI advice, Asinu needs to collect some of your data.'}
          </Text>

          <View style={styles.dataBox}>
            <Text style={styles.dataBoxLabel}>
              {isVi ? 'Dữ liệu được thu thập:' : 'Data collected:'}
            </Text>
            {items.map((item, i) => (
              <View key={i} style={styles.dataRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.dataText}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.note}>
            {isVi
              ? 'Dữ liệu của bạn được bảo mật, không chia sẻ với bên thứ ba vì mục đích thương mại. Bạn có thể rút lại sự đồng ý bất kỳ lúc nào trong Cài đặt.'
              : 'Your data is kept private and not sold to third parties. You may revoke consent at any time in Settings.'}
          </Text>

          <View style={styles.buttons}>
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => {}}>
              <Text style={styles.btnSecondaryText}>
                {isVi ? 'Không đồng ý' : 'Decline'}
              </Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleAgree}>
              <Text style={styles.btnPrimaryText}>
                {isVi ? 'Tôi đồng ý' : 'I Agree'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>
            {isVi
              ? 'Bạn phải đồng ý để sử dụng ứng dụng. Nhấn "Tôi đồng ý" để tiếp tục.'
              : 'Consent is required to use the app. Tap "I Agree" to continue.'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xxl,
    gap: spacing.md,
    paddingBottom: spacing.xxl + 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  intro: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  dataBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  dataBoxLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  dataRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  dataText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  note: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    backgroundColor: colors.surfaceMuted,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    opacity: 0.7,
  },
});
