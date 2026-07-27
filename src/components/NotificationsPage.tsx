import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { useCallback, useMemo, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal, useAppAlert } from './AppAlertModal';
import { Screen } from './Screen';
import { ScreenBackButton } from './ScreenHeaderButton';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { routeFromNotificationData } from '../lib/notifications';
import { useNotificationStore } from '../stores/notification.store';
import { showToast } from '../stores/toast.store';
import { spacing, typography } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';
import type { Notification } from './NotificationBell';

type IconName = ComponentProps<typeof Ionicons>['name'];
type FilterKey = 'all' | 'reminder' | 'health' | 'activity' | 'system';

const FILTERS: Array<{ key: FilterKey; label: string; icon: IconName }> = [
  { key: 'all', label: 'notificationFilterAll', icon: 'notifications-outline' },
  { key: 'reminder', label: 'notificationFilterReminder', icon: 'alarm-outline' },
  { key: 'health', label: 'notificationFilterHealth', icon: 'heart-outline' },
  { key: 'activity', label: 'notificationFilterActivity', icon: 'pulse-outline' },
  { key: 'system', label: 'notificationFilterSystem', icon: 'settings-outline' },
];

function getNotificationType(notification: Notification): string {
  return notification.type || notification.data?.type || notification.data?.alertType || '';
}

function getNotificationCategory(type: string): Exclude<FilterKey, 'all'> {
  if (
    type.startsWith('reminder') ||
    type === 'morning_checkin' ||
    type.startsWith('checkin') ||
    type === 'engagement'
  ) return 'reminder';

  if (
    type === 'emergency' ||
    type.includes('glucose') ||
    type.includes('blood_pressure') ||
    type === 'health_alert' ||
    type === 'caregiver_alert' ||
    type === 'caregiver_confirmed'
  ) return 'health';

  if (
    type === 'milestone' ||
    type.startsWith('streak') ||
    type === 'weekly_recap' ||
    type === 'weekly_wellness_summary'
  ) return 'activity';

  return 'system';
}

function getNotificationIcon(type: string, read: boolean): IconName {
  if (type === 'emergency') return 'warning-outline';
  if (type.includes('glucose') || type.includes('blood_pressure')) return 'pulse-outline';
  if (type === 'health_alert' || type === 'caregiver_alert') return 'heart-circle-outline';
  if (type === 'care_circle_invitation') return 'person-add-outline';
  if (type.startsWith('care_circle')) return 'people-outline';
  if (type === 'morning_checkin' || type === 'reminder_morning') return 'sunny-outline';
  if (type === 'reminder_afternoon') return 'partly-sunny-outline';
  if (type.startsWith('reminder_medication')) return 'medical-outline';
  if (type.startsWith('reminder')) return 'alarm-outline';
  if (type === 'milestone' || type.startsWith('streak') || type.includes('weekly')) return 'bar-chart-outline';
  if (type.includes('subscription') || type.includes('wallet') || type.includes('payment')) return 'settings-outline';
  return read ? 'mail-open-outline' : 'mail-unread-outline';
}

function getNotificationIconColor(type: string, colors: ReturnType<typeof useThemeColors>['colors']): string {
  if (type === 'emergency' || type.includes('critical')) return colors.danger;
  if (type.includes('warning')) return colors.warning;
  if (type.includes('glucose') || type.includes('blood_pressure')) return colors.primary;
  if (type === 'health_alert' || type === 'caregiver_alert') return colors.danger;
  if (type.startsWith('care_circle')) return '#4f7fa6';
  if (type.startsWith('reminder') || type.startsWith('checkin') || type === 'morning_checkin') return colors.primary;
  if (type === 'milestone' || type.startsWith('streak') || type.includes('weekly')) return colors.premiumDark;
  return colors.textSecondary;
}

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function NotificationsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');
  const { t: tLogs } = useTranslation('logs');
  const { colors, isDark } = useThemeColors();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(colors, scaledTypography), [colors, scaledTypography, isDark]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();

  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const loading = useNotificationStore((state) => state.loading);
  const error = useNotificationStore((state) => state.error);
  const fetchFromBackend = useNotificationStore((state) => state.fetchFromBackend);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const clearAll = useNotificationStore((state) => state.clearAll);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [showActions, setShowActions] = useState(false);
  const [openItemActions, setOpenItemActions] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void fetchFromBackend();
    }, [fetchFromBackend]),
  );

  const filteredNotifications = useMemo(() => {
    const result = filter === 'all'
      ? notifications
      : notifications.filter((notification) => getNotificationCategory(getNotificationType(notification)) === filter);
    return [...result].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [filter, notifications]);

  const groupedNotifications = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(startOfDay(now).getTime() - 86400000);
    const groups: Array<{ key: string; title: string; items: Notification[] }> = [];

    filteredNotifications.forEach((notification) => {
      const day = startOfDay(notification.timestamp);
      const key = day.toISOString();
      let group = groups.find((candidate) => candidate.key === key);
      if (!group) {
        const title = isSameDay(day, now)
          ? t('today')
          : isSameDay(day, yesterday)
            ? t('yesterday')
            : day.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        group = { key, title, items: [] };
        groups.push(group);
      }
      group.items.push(notification);
    });

    return groups;
  }, [filteredNotifications, t]);

  const runAction = useCallback(async (
    action: () => Promise<boolean>,
    successKey: string,
  ) => {
    try {
      const result = await action();
      showToast(result ? t(successKey) : t('notificationActionFailed'), result ? 'success' : 'error');
    } catch {
      showToast(t('notificationActionFailed'), 'error');
    }
  }, [t]);

  const handleMarkAll = useCallback(() => {
    setShowActions(false);
    void runAction(markAllAsRead, 'allNotificationsMarkedRead');
  }, [markAllAsRead, runAction]);

  const confirmDeleteAll = useCallback(() => {
    setShowActions(false);
    showAlert(
      t('deleteAllNotifTitle'),
      t('deleteAllNotifMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => void runAction(clearAll, 'allNotifsDeleted') },
      ],
      { name: 'delete-outline', color: colors.danger },
    );
  }, [clearAll, colors.danger, runAction, showAlert, t]);

  const confirmDeleteOne = useCallback((notification: Notification) => {
    showAlert(
      t('deleteNotifTitle'),
      t('deleteNotifMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => void runAction(() => removeNotification(notification.id), 'notifDeleted') },
      ],
      { name: 'delete-outline', color: colors.danger },
    );
  }, [colors.danger, removeNotification, runAction, showAlert, t]);

  const handleNotificationPress = useCallback((notification: Notification) => {
    setOpenItemActions(null);
    if (!notification.read) {
      // Opening a notification marks it as read silently; toast chỉ dành cho thao tác trong menu.
      void markAsRead(notification.id);
    }

    const route = routeFromNotificationData({ ...(notification.data || {}), type: notification.type });
    if (route) router.push(route as any);
  }, [markAsRead, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFromBackend();
    setRefreshing(false);
  }, [fetchFromBackend]);

  const renderNotification = (notification: Notification) => {
    const type = getNotificationType(notification);
    return (
      <View key={notification.id} style={styles.notificationItemWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={notification.title}
          onPress={() => handleNotificationPress(notification)}
          style={({ pressed }) => [styles.notificationCard, pressed && styles.notificationCardPressed]}
        >
          <View style={styles.notificationIcon}>
            <Ionicons
              name={getNotificationIcon(type, notification.read)}
              size={28}
              color={getNotificationIconColor(type, colors)}
            />
          </View>
          <View style={styles.notificationMain}>
            <View style={styles.notificationTitleRow}>
              <Text style={[styles.notificationTitle, !notification.read && styles.notificationTitleUnread]} numberOfLines={1}>
                {notification.title}
              </Text>
              <Text style={styles.notificationTime}>{formatTime(notification.timestamp)}</Text>
            </View>
            <Text style={styles.notificationBody} numberOfLines={2}>{notification.body}</Text>
          </View>
          <View style={styles.notificationTrailing}>
            {!notification.read && <View style={styles.unreadDot} />}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('notificationMoreActions')}
              hitSlop={10}
              onPress={(event) => {
                event.stopPropagation();
                setOpenItemActions((current) => current === notification.id ? null : notification.id);
              }}
              style={styles.itemActionsButton}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </Pressable>
        {openItemActions === notification.id && (
          <View style={styles.itemActionsMenu}>
            <Pressable
              accessibilityRole="button"
              disabled={notification.read}
              onPress={() => {
                setOpenItemActions(null);
                if (!notification.read) void runAction(() => markAsRead(notification.id), 'notificationMarkedRead');
              }}
              style={({ pressed }) => [styles.itemAction, notification.read && styles.disabled, pressed && styles.pressed]}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={notification.read ? colors.textSecondary : colors.primary} />
              <Text style={[styles.itemActionText, notification.read && styles.disabledText]}>{tLogs('markAsRead')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setOpenItemActions(null);
                confirmDeleteOne(notification);
              }}
              style={({ pressed }) => [styles.itemAction, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[styles.itemActionText, { color: colors.danger }]}>{t('delete')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <Screen>
        <View style={[styles.page, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.header}>
            <ScreenBackButton onPress={() => router.back()} accessibilityLabel={t('back')} />
            <Text style={styles.headerTitle}>{tLogs('notifications')}</Text>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('notificationMoreActions')}
                onPress={() => setShowActions((visible) => !visible)}
                style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
              >
                <Ionicons name="ellipsis-horizontal" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>

          {showActions && (
            <View style={styles.actionsMenu}>
              <Pressable disabled={unreadCount === 0} onPress={handleMarkAll} style={styles.menuItem}>
                <Ionicons name="checkmark-done-outline" size={19} color={colors.primary} />
                <Text style={[styles.menuText, unreadCount === 0 && styles.disabledText]}>{t('markAllNotificationsRead')}</Text>
              </Pressable>
              <Pressable disabled={notifications.length === 0} onPress={confirmDeleteAll} style={styles.menuItem}>
                <Ionicons name="trash-outline" size={19} color={colors.danger} />
                <Text style={[styles.menuText, notifications.length === 0 && styles.disabledText]}>{t('deleteAllNotifTitle')}</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
              {FILTERS.map((item) => {
                const active = item.key === filter;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setFilter(item.key)}
                    style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}
                  >
                    <Ionicons name={item.icon} size={17} color={active ? '#fff' : colors.textSecondary} />
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{t(item.label)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          >
            {loading && notifications.length === 0 ? (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.stateText}>{t('loading')}</Text>
              </View>
            ) : error && notifications.length === 0 ? (
              <View style={styles.stateContainer}>
                <Ionicons name="cloud-offline-outline" size={38} color={colors.textSecondary} />
                <Text style={styles.stateText}>{t('notificationActionFailed')}</Text>
                <Pressable onPress={() => void fetchFromBackend()} style={styles.retryButton}>
                  <Text style={styles.retryText}>{t('retry')}</Text>
                </Pressable>
              </View>
            ) : groupedNotifications.length === 0 ? (
              <View style={styles.stateContainer}>
                <Ionicons name="notifications-off-outline" size={42} color={colors.textSecondary} />
                <Text style={styles.stateText}>{tLogs('noNotifications')}</Text>
              </View>
            ) : (
              groupedNotifications.map((group) => (
                <View key={group.key} style={styles.group}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.items.map(renderNotification)}
                </View>
              ))
            )}
            <View style={{ height: insets.bottom + spacing.xl }} />
          </ScrollView>
        </View>
      </Screen>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
    </>
  );
}

function createStyles(
  colors: ReturnType<typeof useThemeColors>['colors'],
  scaledTypography: ReturnType<typeof useScaledTypography>,
) {
  return StyleSheet.create({
    page: { flex: 1 },
    header: {
      minHeight: 58,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      flex: 1,
      marginHorizontal: spacing.sm,
      color: colors.textPrimary,
      fontSize: scaledTypography.size.xl,
      fontWeight: '800',
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    headerAction: {
      width: 36,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    actionsMenu: {
      alignSelf: 'flex-end',
      marginRight: spacing.lg,
      marginTop: spacing.xs,
      paddingVertical: spacing.xs,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
      zIndex: 2,
    },
    menuItem: {
      minWidth: 210,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    menuText: { color: colors.textPrimary, fontSize: typography.size.sm, fontWeight: '600' },
    filterRow: { marginTop: spacing.sm },
    filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    filterChip: {
      minHeight: 40,
      paddingHorizontal: spacing.md,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { color: colors.textSecondary, fontSize: scaledTypography.size.sm, fontWeight: '500' },
    filterTextActive: { color: '#fff', fontWeight: '700' },
    list: { flex: 1, marginTop: spacing.md },
    listContent: { paddingHorizontal: spacing.lg },
    group: { marginBottom: spacing.sm },
    groupTitle: {
      color: colors.textSecondary,
      fontSize: scaledTypography.size.md,
      fontWeight: '600',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    notificationItemWrap: {
      marginBottom: spacing.md,
    },
    notificationCard: {
      minHeight: 104,
      padding: spacing.md,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
    },
    notificationCardPressed: { backgroundColor: colors.surfaceMuted },
    notificationIcon: {
      width: 42,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    notificationMain: { flex: 1, marginHorizontal: spacing.md },
    notificationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    notificationTitle: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: scaledTypography.size.md,
      fontWeight: '500',
    },
    notificationTitleUnread: { fontWeight: '800' },
    notificationBody: {
      marginTop: spacing.xs,
      color: colors.textSecondary,
      fontSize: scaledTypography.size.sm,
      lineHeight: scaledTypography.size.sm * 1.5,
    },
    notificationTime: { color: colors.textSecondary, fontSize: scaledTypography.size.xs },
    notificationTrailing: {
      minWidth: 40,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
    itemActionsButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    itemActionsMenu: {
      alignSelf: 'flex-end',
      minWidth: 220,
      marginTop: spacing.xs,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
      zIndex: 3,
    },
    itemAction: {
      minHeight: 44,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    itemActionText: {
      color: colors.textPrimary,
      fontSize: scaledTypography.size.sm,
      fontWeight: '600',
    },
    stateContainer: {
      minHeight: 300,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    stateText: { color: colors.textSecondary, fontSize: scaledTypography.size.md, textAlign: 'center' },
    retryButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    retryText: { color: colors.primary, fontSize: scaledTypography.size.sm, fontWeight: '700' },
    disabled: { opacity: 0.45 },
    disabledText: { color: colors.textSecondary, opacity: 0.6 },
    pressed: { opacity: 0.76 },
  });
}
