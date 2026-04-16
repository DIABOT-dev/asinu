import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showToast } from '../stores/toast.store';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, spacing, typography, radius } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type Notification = {
  id: string;
  type?: string;
  title: string;
  body: string;
  data?: any;
  timestamp: Date;
  read: boolean;
  priority?: NotificationPriority;
};

const PRIORITY_STYLES: Record<NotificationPriority, { borderColor: string; bgTint: string; iconColor: string }> = {
  critical: { borderColor: '#dc2626', bgTint: '#fef2f2', iconColor: '#dc2626' },
  high: { borderColor: '#f59e0b', bgTint: '#fffbeb', iconColor: '#f59e0b' },
  medium: { borderColor: colors.primary, bgTint: colors.primaryLight, iconColor: colors.primary },
  low: { borderColor: 'transparent', bgTint: 'transparent', iconColor: colors.textSecondary },
};

function getPriorityStyle(priority?: NotificationPriority) {
  return PRIORITY_STYLES[priority || 'low'];
}

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onNotificationPress?: (notification: Notification) => void;
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onDelete?: (notificationId: string) => void;
  onDeleteAll?: () => void;
  onOpen?: () => void;
  loading?: boolean;
}

export function NotificationBell({
  notifications,
  unreadCount,
  onNotificationPress,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onDeleteAll,
  onOpen,
  loading = false
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => StyleSheet.create({
    bellButton: {
      position: 'relative',
      padding: spacing.sm,
    },
    badge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: colors.danger,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      color: colors.surface,
      fontSize: typography.size.xxs,
      fontWeight: '700',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    },
    modalWrapper: {
      maxHeight: '85%',
      flexShrink: 1,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      overflow: 'hidden',
      flexShrink: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: typography.size.xl,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    markAllButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    markAllText: {
      fontSize: typography.size.sm,
      color: colors.primary,
      fontWeight: '600',
    },
    closeButton: {
      padding: spacing.xs,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: spacing.xl * 2,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: spacing.xl * 2,
    },
    emptyText: {
      fontSize: typography.size.md,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    listContent: {
      paddingVertical: spacing.sm,
    },
    notificationItem: {
      flexDirection: 'row',
      padding: spacing.md,
      paddingHorizontal: spacing.lg,
      marginHorizontal: spacing.sm,
      marginVertical: spacing.xs / 2,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    notificationItemUnread: {
      backgroundColor: colors.primary + '08',
      shadowOpacity: 0.1,
      elevation: 2,
    },
    notificationIcon: {
      marginRight: spacing.md,
      paddingTop: spacing.xs,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '10',
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationContent: {
      flex: 1,
    },
    notificationTitle: {
      fontSize: typography.size.md,
      fontWeight: '500',
      color: colors.textPrimary,
      marginBottom: spacing.xs / 2,
    },
    notificationTitleUnread: {
      fontWeight: '700',
    },
    notificationBody: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    notificationTime: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    itemActions: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingTop: spacing.xs,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    deleteItemBtn: {
      padding: 4,
    },
    deleteAllButton: {
      padding: spacing.xs,
    },
    confirmOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      zIndex: 100,
      padding: spacing.xl,
    },
    confirmCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: spacing.xl,
      width: '100%',
      maxWidth: 320,
      alignItems: 'center' as const,
    },
    confirmTitle: {
      fontSize: 17,
      fontWeight: '700' as const,
      color: colors.textPrimary,
      textAlign: 'center' as const,
      marginBottom: spacing.xs,
    },
    confirmText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center' as const,
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    confirmButtons: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
      width: '100%',
    },
    confirmCancel: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
    },
    confirmCancelText: {
      fontWeight: '700' as const,
      color: '#fff',
      fontSize: 15,
    },
    confirmDelete: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.danger,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 6,
    },
    confirmDeleteText: {
      fontWeight: '700' as const,
      color: '#fff',
      fontSize: 15,
    },
  }), [isDark]);
  const { t } = useTranslation('common');
  const { t: tLogs } = useTranslation('logs');
  const [confirmTarget, setConfirmTarget] = useState<string | 'all' | null>(null);

  const handleDeleteOne = (id: string) => setConfirmTarget(id);
  const handleDeleteAll = () => setConfirmTarget('all');

  const confirmDelete = () => {
    if (confirmTarget === 'all') {
      onDeleteAll?.();
      showToast(t('allNotifsDeleted'), 'success');
    } else if (confirmTarget) {
      onDelete?.(confirmTarget);
      showToast(t('notifDeleted'), 'success');
    }
    setConfirmTarget(null);
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    if (onNotificationPress) {
      onNotificationPress(notification);
    }
    setIsOpen(false);
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return t('minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('daysAgo', { count: diffDays });
    
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    // Get icon based on notification type
    const notifType = item.type || item.data?.type || item.data?.alertType || '';
    const getNotificationIcon = (): React.ComponentProps<typeof Ionicons>['name'] => {
      if (notifType === 'emergency') return 'warning';
      if (notifType === 'glucose_critical' || notifType === 'blood_pressure_critical') return 'alert-circle';
      if (notifType === 'glucose_warning' || notifType === 'blood_pressure_warning') return 'warning';
      if (notifType === 'health_alert' || notifType === 'caregiver_alert') return 'heart-circle-outline';
      if (notifType === 'care_circle_invitation') return 'person-add-outline';
      if (notifType === 'care_circle_accepted') return 'people-outline';
      if (notifType === 'morning_checkin' || notifType === 'checkin_followup' || notifType === 'checkin_followup_urgent') return 'sunny-outline';
      if (notifType === 'caregiver_confirmed') return 'checkmark-circle-outline';
      if (notifType === 'reminder_afternoon') return 'partly-sunny-outline';
      if (notifType === 'reminder_morning') return 'sunny-outline';
      if (notifType === 'reminder_medication') return 'medical-outline';
      if (notifType.startsWith('reminder')) return 'alarm-outline';
      if (notifType === 'milestone' || notifType.startsWith('streak') || notifType === 'weekly_recap') return 'trophy-outline';
      if (notifType === 'engagement') return 'sparkles-outline';
      return item.read ? 'mail-open-outline' : 'mail-unread-outline';
    };

    const getIconColor = () => {
      if (notifType === 'emergency') return colors.danger;
      if (notifType === 'glucose_critical' || notifType === 'blood_pressure_critical') return colors.danger;
      if (notifType === 'glucose_warning' || notifType === 'blood_pressure_warning') return colors.warning;
      if (notifType === 'health_alert' || notifType === 'caregiver_alert') return '#f59e0b';
      if (notifType === 'care_circle_invitation' || notifType === 'care_circle_accepted') return '#3b82f6';
      if (notifType === 'morning_checkin' || notifType.startsWith('checkin')) return colors.emerald;
      if (notifType.startsWith('reminder')) return colors.primary;
      if (notifType === 'milestone' || notifType.startsWith('streak') || notifType === 'weekly_recap') return '#f59e0b';
      return item.read ? colors.textSecondary : colors.primary;
    };

    const priorityStyle = getPriorityStyle(item.priority);

    const iconBgColor = (() => {
      if (notifType === 'emergency' || item.priority === 'critical') return '#fecaca';
      if (notifType === 'health_alert' || notifType === 'caregiver_alert') return '#fef3c7';
      if (notifType === 'reengagement') return '#dbeafe';
      if (notifType === 'care_circle_invitation' || notifType === 'care_circle_accepted') return '#dbeafe';
      if (notifType === 'morning_checkin' || notifType.startsWith('checkin')) return '#dcfce7';
      if (notifType.startsWith('reminder')) return '#e0f2f1';
      if (notifType === 'milestone' || notifType.startsWith('streak') || notifType === 'weekly_recap') return '#fef3c7';
      return colors.primary + '12';
    })();

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.read && styles.notificationItemUnread,
          item.priority === 'critical' && { backgroundColor: '#fef2f2' },
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.notificationIcon, { backgroundColor: iconBgColor }]}>
          <Ionicons
            name={getNotificationIcon()}
            size={20}
            color={getIconColor()}
          />
        </View>
        <View style={styles.notificationContent}>
          <Text style={[styles.notificationTitle, !item.read && styles.notificationTitleUnread, { fontSize: scaledTypography.size.md }]}>
            {item.title}
          </Text>
          <Text style={[styles.notificationBody, { fontSize: scaledTypography.size.sm }]} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={[styles.notificationTime, { fontSize: scaledTypography.size.xs }]}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>
        <View style={styles.itemActions}>
          {!item.read && <View style={styles.unreadDot} />}
          {onDelete && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); handleDeleteOne(item.id); }}
              hitSlop={12}
              style={styles.deleteItemBtn}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </Pressable>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={styles.bellButton}
        onPress={() => { setIsOpen(true); onOpen?.(); }}
      >
        <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.modalWrapper} onPress={e => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <Text style={[styles.headerTitle, { fontSize: scaledTypography.size.xl }]}>{tLogs('notifications')}</Text>
                <View style={styles.headerActions}>
                  {unreadCount > 0 && onMarkAllAsRead && (
                    <TouchableOpacity onPress={onMarkAllAsRead} style={styles.markAllButton}>
                      <Ionicons name="checkmark-done" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  {notifications.length > 0 && onDeleteAll && (
                    <TouchableOpacity onPress={handleDeleteAll} style={styles.deleteAllButton}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {confirmTarget !== null && (
                <View style={styles.confirmOverlay}>
                  <View style={styles.confirmCard}>
                    <Ionicons name="trash-outline" size={32} color={colors.danger} style={{ marginBottom: spacing.sm }} />
                    <Text style={styles.confirmTitle}>
                      {confirmTarget === 'all' ? t('deleteAllNotifTitle') : t('deleteNotifTitle')}
                    </Text>
                    <Text style={styles.confirmText}>
                      {confirmTarget === 'all' ? t('deleteAllNotifMsg') : t('deleteNotifMsg')}
                    </Text>
                    <View style={styles.confirmButtons}>
                      <Pressable style={styles.confirmCancel} onPress={() => setConfirmTarget(null)}>
                        <Text style={styles.confirmCancelText}>{t('cancel')}</Text>
                      </Pressable>
                      <Pressable style={styles.confirmDelete} onPress={confirmDelete}>
                        <Ionicons name="trash-outline" size={14} color="#fff" />
                        <Text style={styles.confirmDeleteText}>{t('delete')}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { fontSize: scaledTypography.size.md }]}>{tLogs('noNotifications')}</Text>
                </View>
              ) : (
                <FlatList
                  data={notifications}
                  renderItem={renderNotification}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.md }]}
                  bounces={false}
                  overScrollMode="never"
                />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
