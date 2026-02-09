import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import DeleteAccountModal from '../../src/components/DeleteAccountModal';
import { Screen } from '../../src/components/Screen';
import { authApi } from '../../src/features/auth/auth.api';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { getExpoPushToken, requestNotificationPermissions } from '../../src/lib/notifications';
import { FontSizeScale, useFontSizeStore } from '../../src/stores/font-size.store';
import { colors, spacing } from '../../src/styles';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';

const FONT_SIZE_OPTIONS: Array<{ value: FontSizeScale; label: string; iconSize: number }> = [
  { value: 'small', label: 'Nhỏ', iconSize: 16 },
  { value: 'normal', label: 'Bình thường', iconSize: 20 },
  { value: 'large', label: 'Lớn', iconSize: 24 },
  { value: 'xlarge', label: 'Rất lớn', iconSize: 28 }
];

const STORAGE_KEY_NOTIFICATIONS = '@app/notifications_enabled';
const STORAGE_KEY_REMINDERS = '@app/reminders_enabled';

export default function SettingsScreen() {
  const logout = useAuthStore((state) => state.logout);
  const { scale, setScale } = useFontSizeStore();
  const scaledTypography = useScaledTypography();
  const [notifications, setNotifications] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  // Load saved preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const [notifPref, reminderPref] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_NOTIFICATIONS),
        AsyncStorage.getItem(STORAGE_KEY_REMINDERS)
      ]);
      
      if (notifPref !== null) setNotifications(notifPref === 'true');
      if (reminderPref !== null) setReminders(reminderPref === 'true');
    } catch (error) {
      console.error('[settings] Failed to load preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationsToggle = async (value: boolean) => {
    if (value) {
      // Request permission when enabling
      const hasPermission = await requestNotificationPermissions();
      
      if (!hasPermission) {
        Alert.alert(
          'Cần quyền thông báo',
          'Vui lòng cho phép thông báo trong Cài đặt của thiết bị để nhận nhắc nhở.',
          [
            { text: 'Để sau', style: 'cancel' },
            { 
              text: 'Mở Cài đặt', 
              onPress: () => {
                // On iOS, this will open Settings app
                // On Android, user needs to manually go to settings
                console.log('[settings] User needs to enable notifications in device settings');
              }
            }
          ]
        );
        return;
      }
      
      // Get push token and send to backend
      const token = await getExpoPushToken();
      if (token) {
        console.log('[settings] Got push token:', token);
        try {
          const response = await authApi.updatePushToken(token);
          if (response.ok) {
            console.log('[settings] Push token sent to backend successfully');
          } else {
            console.error('[settings] Failed to send push token to backend');
          }
        } catch (error) {
          console.error('[settings] Error sending push token:', error);
        }
      }
    }
    
    setNotifications(value);
    await AsyncStorage.setItem(STORAGE_KEY_NOTIFICATIONS, String(value));
    console.log('[settings] Notifications preference saved:', value);
  };

  const handleRemindersToggle = async (value: boolean) => {
    if (value && !notifications) {
      Alert.alert(
        'Bật thông báo trước',
        'Bạn cần bật "Thông báo" trước khi bật "Nhắc nhiệm vụ".',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setReminders(value);
    await AsyncStorage.setItem(STORAGE_KEY_REMINDERS, String(value));
    console.log('[settings] Reminders preference saved:', value);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleDeleteAccount = async () => {
    try {
      const result = await authApi.deleteAccount();
      if (result.ok) {
        // Xóa tất cả dữ liệu local
        await AsyncStorage.multiRemove([
          STORAGE_KEY_NOTIFICATIONS,
          STORAGE_KEY_REMINDERS,
          '@app/font_size_scale'
        ]);
        // Đăng xuất và điều hướng về login
        await logout();
        setShowDeleteModal(false);
        router.replace('/login');
        
        // Hiển thị thông báo sau khi đã chuyển trang
        setTimeout(() => {
          Alert.alert('Thành công', 'Tài khoản của bạn đã được xóa');
        }, 500);
      } else {
        Alert.alert('Lỗi', 'Không thể xóa tài khoản. Vui lòng thử lại');
      }
    } catch (error) {
      console.error('[settings] Delete account error:', error);
      Alert.alert('Lỗi', 'Đã xảy ra lỗi khi xóa tài khoản');
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: padTop }]}>
        <H1SectionHeader title="Cài đặt" />
        
        {/* Font Size Setting */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: scaledTypography.size.md }]}>
            Cỡ chữ ứng dụng
          </Text>
          <View style={styles.fontSizeOptions}>
            {FONT_SIZE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setScale(option.value)}
                style={[
                  styles.fontSizeButton,
                  scale === option.value && styles.fontSizeButtonActive
                ]}
              >
                <MaterialCommunityIcons 
                  name="format-size" 
                  size={option.iconSize} 
                  color={scale === option.value ? '#ffffff' : colors.primary}
                  style={{ marginBottom: 4 }}
                />
                <Text
                  style={[
                    styles.fontSizeButtonText,
                    { fontSize: scaledTypography.size.sm },
                    scale === option.value && styles.fontSizeButtonTextActive
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.fontSizePreview, { fontSize: scaledTypography.size.md }]}>
            Đây là ví dụ về kích thước chữ hiện tại
          </Text>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { fontSize: scaledTypography.size.md }]}>Thông báo</Text>
            <Text style={[styles.subtitle, { fontSize: scaledTypography.size.sm }]}>
              Nhận nhắc nhở log và cập nhật sức khỏe
            </Text>
          </View>
          <Switch 
            value={notifications} 
            onValueChange={handleNotificationsToggle}
            disabled={isLoading}
          />
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { fontSize: scaledTypography.size.md }]}>Nhắc nhiệm vụ</Text>
            <Text style={[styles.subtitle, { fontSize: scaledTypography.size.sm }]}>
              Nhận push khi gần hết ngày
            </Text>
          </View>
          <Switch 
            value={reminders} 
            onValueChange={handleRemindersToggle}
            disabled={isLoading || !notifications}
          />
        </View>

        <Button label="Đăng xuất" variant="warning" onPress={handleLogout} style={{ marginTop: spacing.xl }} />
        
        <Pressable 
          style={styles.deleteAccountButton}
          onPress={() => setShowDeleteModal(true)}
        >
          <MaterialCommunityIcons name="delete-forever" size={20} color="#ffffff" />
          <Text style={[styles.deleteAccountText, { fontSize: scaledTypography.size.sm }]}>
            Xóa tài khoản vĩnh viễn
          </Text>
        </Pressable>

        <Text style={[styles.versionText, { fontSize: scaledTypography.size.xs }]}>
          v.1 (Bản thử nghiệm)
        </Text>
      </ScrollView>

      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background
  },
  section: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: spacing.xs
  },
  fontSizeOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap'
  },
  fontSizeButton: {
    flex: 1,
    minWidth: 70,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  },
  fontSizeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.secondary
  },
  fontSizeButtonText: {
    fontWeight: '600',
    color: colors.textPrimary
  },
  fontSizeButtonTextActive: {
    color: '#ffffff'
  },
  fontSizePreview: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontStyle: 'italic'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  title: {
    fontWeight: '700'
  },
  subtitle: {
    color: colors.textSecondary
  },
  versionText: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.textSecondary,
    width: '100%'
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.danger,
    borderWidth: 0
  },
  deleteAccountText: {
    color: '#ffffff',
    fontWeight: '600'
  }
});
