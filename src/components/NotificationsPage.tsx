import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
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
import { NotificationIcon } from './NotificationIcon';
import { SkeletonBlock } from './state/Skeleton';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { routeFromNotificationData } from '../lib/notifications';
import { useNotificationStore } from '../stores/notification.store';
import { showToast } from '../stores/toast.store';
import { spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';
import type { Notification } from './NotificationBell';

type FilterKey = 'all' | 'reminder' | 'health' | 'activity' | 'system';

type OpenMenu = {
  scope: 'all' | 'item';
  notificationId?: string;
  anchor: { x: number; y: number; width: number; height: number };
  container: { width: number; height: number };
};

type NotificationListItem =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'notification'; key: string; notification: Notification };

const FILTERS: Array<{ key: FilterKey; labelKey: string }> = [
  { key: 'all', labelKey: 'notificationFilterAll' },
  { key: 'reminder', labelKey: 'notificationFilterReminder' },
  { key: 'health', labelKey: 'notificationFilterHealth' },
  { key: 'activity', labelKey: 'notificationFilterActivity' },
  { key: 'system', labelKey: 'notificationFilterSystem' },
];

function getNotificationType(notification: Notification): string {
  return (
    notification.type ||
    notification.data?.type ||
    notification.data?.alertType ||
    ''
  );
}

function getNotificationCategory(type: string): Exclude<FilterKey, 'all'> {
  if (type === 'checkin_inactivity_notice') return 'system';
  if (
    type.startsWith('reminder') ||
    type === 'morning_checkin' ||
    type.startsWith('checkin') ||
    type === 'engagement'
  )
    return 'reminder';

  if (
    type === 'emergency' ||
    type.includes('glucose') ||
    type.includes('blood_pressure') ||
    type === 'health_alert' ||
    type === 'caregiver_alert' ||
    type === 'caregiver_confirmed'
  )
    return 'health';

  if (
    type === 'milestone' ||
    type.startsWith('streak') ||
    type === 'weekly_recap' ||
    type === 'weekly_wellness_summary'
  )
    return 'activity';

  return 'system';
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatTime(date: Date, language: string): string {
  return date.toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation('common');
  const { t: tLogs } = useTranslation('logs');
  const { colors, isDark } = useThemeColors();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(
    () => createStyles(colors, scaledTypography),
    [colors, scaledTypography, isDark],
  );
  const { alertState, showAlert, dismissAlert } = useAppAlert();

  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const loading = useNotificationStore((state) => state.loading);
  const loadingMore = useNotificationStore((state) => state.loadingMore);
  const hasMore = useNotificationStore((state) => state.hasMore);
  const page = useNotificationStore((state) => state.page);
  const error = useNotificationStore((state) => state.error);
  const fetchFromBackend = useNotificationStore(
    (state) => state.fetchFromBackend,
  );
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const removeNotification = useNotificationStore(
    (state) => state.removeNotification,
  );
  const clearAll = useNotificationStore((state) => state.clearAll);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [menuHeight, setMenuHeight] = useState(0);
  const pageRef = useRef<View>(null);
  const headerActionsRef = useRef<View>(null);
  const itemActionsRefs = useRef(new Map<string, View>());
  const menuRequest = useRef(0);
  const closeMenu = useCallback(() => {
    menuRequest.current++;
    setMenu(null);
  }, []);
  const openMenu = useCallback(
    (
      scope: OpenMenu['scope'],
      target: View | null,
      notificationId?: string,
    ) => {
      if (menu?.scope === scope && menu.notificationId === notificationId) {
        closeMenu();
        return;
      }
      closeMenu();
      if (!target) return;
      const request = menuRequest.current;
      target.measureInWindow((x, y, width, height) => {
        pageRef.current?.measureInWindow(
          (pageX, pageY, pageWidth, pageHeight) => {
            if (
              request !== menuRequest.current ||
              width <= 0 ||
              height <= 0 ||
              pageWidth <= 0 ||
              pageHeight <= 0
            )
              return;
            setMenuHeight(0);
            setMenu({
              scope,
              notificationId,
              anchor: { x: x - pageX, y: y - pageY, width, height },
              container: { width: pageWidth, height: pageHeight },
            });
          },
        );
      });
    },
    [closeMenu, menu],
  );
  const [expandedNotificationId, setExpandedNotificationId] = useState<
    string | null
  >(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void fetchFromBackend();
      return closeMenu;
    }, [closeMenu, fetchFromBackend]),
  );

  useEffect(() => {
    if (!menu) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        closeMenu();
        return true;
      },
    );
    return () => subscription.remove();
  }, [closeMenu, menu]);

  useEffect(() => {
    // Fresh list data can move an item while its native measurement is pending.
    closeMenu();
  }, [closeMenu, notifications]);

  const filteredNotifications = useMemo(() => {
    const result =
      filter === 'all'
        ? notifications
        : notifications.filter(
            (notification) =>
              getNotificationCategory(getNotificationType(notification)) ===
              filter,
          );
    return [...result].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }, [filter, notifications]);

  const groupedNotifications = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(startOfDay(now).getTime() - 86400000);
    const groups: Array<{ key: string; title: string; items: Notification[] }> =
      [];

    filteredNotifications.forEach((notification) => {
      const day = startOfDay(notification.timestamp);
      const key = day.toISOString();
      let group = groups.find((candidate) => candidate.key === key);
      if (!group) {
        const title = isSameDay(day, now)
          ? t('today')
          : isSameDay(day, yesterday)
            ? t('yesterday')
            : day.toLocaleDateString(
                i18n.language === 'en' ? 'en-US' : 'vi-VN',
                { day: '2-digit', month: '2-digit', year: 'numeric' },
              );
        group = { key, title, items: [] };
        groups.push(group);
      }
      group.items.push(notification);
    });

    return groups;
  }, [filteredNotifications, i18n.language, t]);

  const listItems = useMemo<NotificationListItem[]>(
    () =>
      groupedNotifications.flatMap((group) => [
        {
          kind: 'header' as const,
          key: `header-${group.key}`,
          title: group.title,
        },
        ...group.items.map((notification) => ({
          kind: 'notification' as const,
          key: notification.id,
          notification,
        })),
      ]),
    [groupedNotifications],
  );

  const runAction = useCallback(
    async (action: () => Promise<boolean>, successKey: string) => {
      try {
        const result = await action();
        showToast(
          result ? t(successKey) : t('notificationActionFailed'),
          result ? 'success' : 'error',
        );
      } catch {
        showToast(t('notificationActionFailed'), 'error');
      }
    },
    [t],
  );

  const handleMarkAll = useCallback(() => {
    closeMenu();
    void runAction(markAllAsRead, 'allNotificationsMarkedRead');
  }, [closeMenu, markAllAsRead, runAction]);

  const confirmDeleteAll = useCallback(() => {
    closeMenu();
    showAlert(
      t('deleteAllNotifTitle'),
      t('deleteAllNotifMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => void runAction(clearAll, 'allNotifsDeleted'),
        },
      ],
      { name: 'delete-outline', color: colors.danger },
    );
  }, [clearAll, closeMenu, colors.danger, runAction, showAlert, t]);

  const confirmDeleteOne = useCallback(
    (notification: Notification) => {
      showAlert(
        t('deleteNotifTitle'),
        t('deleteNotifMsg'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            style: 'destructive',
            onPress: () =>
              void runAction(
                () => removeNotification(notification.id),
                'notifDeleted',
              ),
          },
        ],
        { name: 'delete-outline', color: colors.danger },
      );
    },
    [colors.danger, removeNotification, runAction, showAlert, t],
  );

  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      closeMenu();
      if (!notification.read) {
        // Opening a notification marks it as read silently; toast chỉ dành cho thao tác trong menu.
        void markAsRead(notification.id);
      }

      const route = routeFromNotificationData({
        ...(notification.data || {}),
        type: notification.type,
      });
      if (route) {
        setExpandedNotificationId(null);
        router.push(route as any);
      } else {
        setExpandedNotificationId((current) =>
          current === notification.id ? null : notification.id,
        );
      }
    },
    [closeMenu, markAsRead, router],
  );

  const handleRefresh = useCallback(async () => {
    closeMenu();
    setRefreshing(true);
    await fetchFromBackend();
    setRefreshing(false);
  }, [closeMenu, fetchFromBackend]);

  const handleEndReached = useCallback(() => {
    if (!hasMore || loadingMore || loading || listItems.length === 0) return;
    void fetchFromBackend({ page: page + 1, append: true });
  }, [fetchFromBackend, hasMore, listItems.length, loading, loadingMore, page]);

  const renderNotification = (notification: Notification) => {
    const type = getNotificationType(notification);
    const hasDestination = Boolean(
      routeFromNotificationData({
        ...(notification.data || {}),
        type: notification.type,
      }),
    );
    const isExpanded = expandedNotificationId === notification.id;
    return (
      <View key={notification.id} style={styles.notificationItemWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[
            notification.title,
            notification.body,
            formatTime(notification.timestamp, i18n.language),
            !notification.read && t('notificationUnread'),
          ]
            .filter(Boolean)
            .join('. ')}
          accessibilityHint={
            hasDestination
              ? t('viewDetails')
              : t(isExpanded ? 'close' : 'viewDetails')
          }
          accessibilityState={
            hasDestination ? undefined : { expanded: isExpanded }
          }
          onPress={() => handleNotificationPress(notification)}
          style={({ pressed }) => [
            styles.notificationCard,
            !notification.read && styles.notificationCardUnread,
            pressed && styles.notificationCardPressed,
          ]}
        >
          <NotificationIcon type={type} />
          <View style={styles.notificationMain}>
            <View style={styles.notificationTitleRow}>
              <Text
                style={[
                  styles.notificationTitle,
                  !notification.read && styles.notificationTitleUnread,
                ]}
              >
                {notification.title}
              </Text>
              <Pressable
                ref={(node) => {
                  if (node) itemActionsRefs.current.set(notification.id, node);
                  else itemActionsRefs.current.delete(notification.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('notificationMoreActions')}
                accessibilityState={{
                  expanded:
                    menu?.scope === 'item' &&
                    menu.notificationId === notification.id,
                }}
                onPress={(event) => {
                  event.stopPropagation();
                  openMenu(
                    'item',
                    itemActionsRefs.current.get(notification.id) ?? null,
                    notification.id,
                  );
                }}
                style={({ pressed }) => [
                  styles.itemActionsButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
            <Text
              style={styles.notificationBody}
              numberOfLines={isExpanded ? undefined : 2}
            >
              {notification.body}
            </Text>
            <View style={styles.notificationMeta}>
              <Text style={styles.notificationTime}>
                {formatTime(notification.timestamp, i18n.language)}
              </Text>
              {!notification.read && (
                <View style={styles.unreadLabel}>
                  <View style={styles.unreadDot} />
                  <Text style={styles.unreadText}>
                    {t('notificationUnread')}
                  </Text>
                </View>
              )}
              {!hasDestination && (
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                  style={styles.expandIcon}
                />
              )}
            </View>
          </View>
        </Pressable>
      </View>
    );
  };

  const selectedNotification =
    menu?.scope === 'item'
      ? notifications.find(
          (notification) => notification.id === menu.notificationId,
        )
      : null;
  const visibleMenu =
    menu && (menu.scope === 'all' || selectedNotification) ? menu : null;
  const menuWidth = visibleMenu
    ? Math.min(280, visibleMenu.container.width - spacing.lg * 2)
    : 0;
  const minMenuTop = insets.top + spacing.sm;
  const menuBottom = visibleMenu
    ? visibleMenu.container.height - insets.bottom - spacing.sm
    : 0;
  const maxMenuHeight = Math.max(0, menuBottom - minMenuTop);
  const measuredMenuHeight = Math.min(menuHeight || 112, maxMenuHeight);
  const menuLeft = visibleMenu
    ? Math.max(
        spacing.lg,
        Math.min(
          visibleMenu.anchor.x + visibleMenu.anchor.width - menuWidth,
          visibleMenu.container.width - menuWidth - spacing.lg,
        ),
      )
    : 0;
  const menuBelow = visibleMenu
    ? visibleMenu.anchor.y + visibleMenu.anchor.height + spacing.xs
    : 0;
  const menuTop = visibleMenu
    ? Math.max(
        minMenuTop,
        Math.min(
          menuBelow + measuredMenuHeight <= menuBottom
            ? menuBelow
            : visibleMenu.anchor.y - measuredMenuHeight - spacing.xs,
          menuBottom - measuredMenuHeight,
        ),
      )
    : 0;
  const menuActions =
    menu?.scope === 'all'
      ? [
          {
            key: 'read-all',
            label: t('markAllNotificationsRead'),
            icon: 'checkmark-done-outline' as const,
            disabled: unreadCount === 0,
            destructive: false,
            onPress: handleMarkAll,
          },
          {
            key: 'delete-all',
            label: t('deleteAllNotifTitle'),
            icon: 'trash-outline' as const,
            disabled: notifications.length === 0,
            destructive: true,
            onPress: confirmDeleteAll,
          },
        ]
      : selectedNotification
        ? [
            {
              key: 'read',
              label: tLogs('markAsRead'),
              icon: 'checkmark-circle-outline' as const,
              disabled: selectedNotification.read,
              destructive: false,
              onPress: () => {
                closeMenu();
                void runAction(
                  () => markAsRead(selectedNotification.id),
                  'notificationMarkedRead',
                );
              },
            },
            {
              key: 'delete',
              label: t('delete'),
              icon: 'trash-outline' as const,
              disabled: false,
              destructive: true,
              onPress: () => {
                closeMenu();
                confirmDeleteOne(selectedNotification);
              },
            },
          ]
        : [];

  return (
    <>
      <Screen>
        <View
          ref={pageRef}
          collapsable={false}
          style={styles.page}
          onLayout={closeMenu}
        >
          <View
            style={[
              styles.pageContent,
              { paddingTop: insets.top + spacing.sm },
            ]}
            accessibilityElementsHidden={Boolean(visibleMenu)}
            importantForAccessibility={
              visibleMenu ? 'no-hide-descendants' : 'auto'
            }
          >
            <View style={styles.header}>
              <ScreenBackButton
                onPress={() => router.back()}
                accessibilityLabel={t('back')}
                style={styles.headerAction}
              />
              <Text
                style={styles.headerTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {tLogs('notifications')}
              </Text>
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('notificationMoreActions')}
                  ref={headerActionsRef}
                  accessibilityState={{ expanded: menu?.scope === 'all' }}
                  onPress={() => openMenu('all', headerActionsRef.current)}
                  style={({ pressed }) => [
                    styles.headerAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={24}
                    color={colors.textPrimary}
                  />
                </Pressable>
              </View>
            </View>


            <View style={styles.filterRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterContent}
              >
                {FILTERS.map((item) => {
                  const active = item.key === filter;
                  return (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        closeMenu();
                        setFilter(item.key);
                      }}
                      style={({ pressed }) => [
                        styles.filterChip,
                        active && styles.filterChipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          active && styles.filterTextActive,
                        ]}
                      >
                        {t(item.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <FlatList<NotificationListItem>
              data={listItems}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) =>
                item.kind === 'header' ? (
                  <Text style={styles.groupTitle}>{item.title}</Text>
                ) : (
                  renderNotification(item.notification)
                )
              }
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                />
              }
              onScrollBeginDrag={closeMenu}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.3}
              ListEmptyComponent={
                loading && notifications.length === 0 ? (
                  <View
                    accessibilityLabel={t('loading')}
                    accessibilityState={{ busy: true }}
                  >
                    {[0, 1, 2, 3].map((index) => (
                      <View key={index} style={styles.loadingRow}>
                        <SkeletonBlock
                          width={50}
                          height={50}
                          borderRadius={17}
                        />
                        <View style={styles.loadingCopy}>
                          <SkeletonBlock
                            width="76%"
                            height={16}
                            borderRadius={6}
                          />
                          <SkeletonBlock
                            width="96%"
                            height={12}
                            borderRadius={5}
                          />
                          <SkeletonBlock
                            width="64%"
                            height={12}
                            borderRadius={5}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : error && notifications.length === 0 ? (
                  <View style={styles.stateContainer}>
                    <Ionicons
                      name="cloud-offline-outline"
                      size={38}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.stateTitle}>
                      {t('notificationLoadFailed')}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void fetchFromBackend()}
                      style={styles.retryButton}
                    >
                      <Text style={styles.retryText}>{t('retry')}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.stateContainer}>
                    <View style={styles.emptyIcon}>
                      <NotificationIcon type="general" size={38} />
                    </View>
                    <Text style={styles.stateTitle}>
                      {filter === 'all'
                        ? tLogs('noNotifications')
                        : t('notificationFilterEmpty')}
                    </Text>
                    <Text style={styles.stateText}>
                      {t('notificationEmptyHint')}
                    </Text>
                  </View>
                )
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.footerText}>{t('loading')}</Text>
                  </View>
                ) : (
                  <View style={{ height: insets.bottom + spacing.xl }} />
                )
              }
            />
          </View>
          {visibleMenu && (
            <View
              style={styles.menuLayer}
              pointerEvents="box-none"
              onAccessibilityEscape={closeMenu}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('close')}
                onPress={closeMenu}
                style={styles.menuBackdrop}
              />
              <View
                accessibilityViewIsModal
                onLayout={(event) =>
                  setMenuHeight(event.nativeEvent.layout.height)
                }
                style={[
                  styles.floatingMenu,
                  {
                    left: menuLeft,
                    top: menuTop,
                    width: menuWidth,
                    maxHeight: maxMenuHeight,
                    opacity: menuHeight ? 1 : 0,
                  },
                ]}
              >
                <ScrollView style={styles.menuScroll} bounces={false}>
                  {menuActions.map((action) => (
                    <Pressable
                      key={action.key}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: action.disabled }}
                      disabled={action.disabled}
                      onPress={action.onPress}
                      style={({ pressed }) => [
                        styles.menuItem,
                        action.disabled && styles.disabled,
                        pressed && styles.menuItemPressed,
                      ]}
                    >
                      <Ionicons
                        name={action.icon}
                        size={20}
                        color={
                          action.disabled
                            ? colors.textSecondary
                            : action.destructive
                              ? colors.danger
                              : colors.primaryText
                        }
                      />
                      <Text
                        style={[
                          styles.menuText,
                          action.destructive && { color: colors.danger },
                          action.disabled && styles.disabledText,
                        ]}
                      >
                        {action.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
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
    pageContent: { flex: 1 },
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
      textAlign: 'center',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    headerAction: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    menuLayer: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 100,
    },
    menuBackdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    floatingMenu: {
      position: 'absolute',
      paddingVertical: spacing.xs,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      shadowColor: colors.textPrimary,
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 5 },
      elevation: 8,
    },
    menuScroll: { flexGrow: 0, flexShrink: 1 },
    menuItemPressed: { backgroundColor: colors.surfaceMuted },
    menuItem: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    menuText: {
      color: colors.textPrimary,
      fontSize: scaledTypography.size.sm,
      fontWeight: '600',
      flexShrink: 1,
    },
    filterRow: { marginTop: spacing.xs },
    filterContent: {
      paddingHorizontal: spacing.xl,
      gap: 6,
      paddingBottom: spacing.xs,
    },
    filterChip: {
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipActive: { backgroundColor: colors.primaryText },
    filterText: {
      color: colors.textSecondary,
      fontSize: scaledTypography.size.sm,
      fontWeight: '600',
    },
    filterTextActive: { color: colors.primaryLight, fontWeight: '700' },
    list: { flex: 1, marginTop: spacing.xs },
    listContent: { paddingHorizontal: spacing.md, flexGrow: 1 },
    groupTitle: {
      color: colors.textSecondary,
      fontSize: scaledTypography.size.sm,
      fontWeight: '700',
      marginTop: spacing.lg,
      marginBottom: spacing.md,
      marginHorizontal: spacing.sm,
    },
    notificationItemWrap: {
      marginBottom: spacing.sm,
    },
    notificationCard: {
      minHeight: 124,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    notificationCardUnread: { backgroundColor: colors.primaryLight },
    notificationCardPressed: { backgroundColor: colors.surfaceMuted },
    notificationMain: { flex: 1, minWidth: 0 },
    notificationTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
    },
    notificationTitle: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: scaledTypography.size.md,
      fontWeight: '600',
      lineHeight: scaledTypography.size.md * 1.4,
    },
    notificationTitleUnread: { fontWeight: '700' },
    notificationBody: {
      marginTop: spacing.xs,
      color: colors.textSecondary,
      fontSize: scaledTypography.size.sm,
      lineHeight: scaledTypography.size.sm * 1.5,
    },
    notificationTime: {
      color: colors.textSecondary,
      fontSize: scaledTypography.size.xs,
    },
    notificationMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    unreadLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    unreadText: {
      color: colors.primaryText,
      fontSize: scaledTypography.size.xs,
      fontWeight: '600',
    },
    unreadDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.primaryText,
    },
    expandIcon: { marginLeft: 'auto' },
    itemActionsButton: {
      width: 44,
      height: 44,
      marginTop: -10,
      marginBottom: -10,
      marginRight: -10,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    loadingRow: {
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 124,
    },
    loadingCopy: { flex: 1, gap: spacing.sm },
    emptyIcon: {
      padding: spacing.lg,
      borderRadius: 40,
      backgroundColor: colors.primaryLight,
      marginBottom: spacing.sm,
    },
    stateContainer: {
      minHeight: 300,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
    },
    stateTitle: {
      color: colors.textPrimary,
      fontSize: scaledTypography.size.md,
      fontWeight: '700',
      textAlign: 'center',
    },
    stateText: {
      color: colors.textSecondary,
      fontSize: scaledTypography.size.sm,
      lineHeight: scaledTypography.size.sm * 1.6,
      textAlign: 'center',
    },
    footerLoader: {
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    footerText: {
      color: colors.textSecondary,
      fontSize: scaledTypography.size.sm,
    },
    retryButton: {
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    retryText: {
      color: colors.primaryText,
      fontSize: scaledTypography.size.sm,
      fontWeight: '700',
    },
    disabled: { opacity: 0.45 },
    disabledText: { color: colors.textSecondary, opacity: 0.6 },
    pressed: { opacity: 0.76 },
  });
}
