import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { colors, spacing, typography } from '../styles';

export type Notification = {
  id: string;
  title: string;
  body: string;
  data?: any;
  timestamp: Date;
  read: boolean;
};

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onNotificationPress?: (notification: Notification) => void;
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  loading?: boolean;
}

export function NotificationBell({
  notifications,
  unreadCount,
  onNotificationPress,
  onMarkAsRead,
  onMarkAllAsRead,
  loading = false
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);

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

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    // Get icon based on notification type
    const getNotificationIcon = () => {
      const alertType = item.data?.alertType || item.data?.type;
      if (alertType === 'glucose_critical' || alertType === 'blood_pressure_critical') {
        return 'alert-circle';
      } else if (alertType === 'glucose_warning' || alertType === 'blood_pressure_warning') {
        return 'warning';
      } else if (alertType === 'care_circle_invitation') {
        return 'people-outline';
      } else if (alertType === 'health_alert') {
        return 'heart-outline';
      }
      return item.read ? 'mail-open-outline' : 'mail-unread-outline';
    };

    const getIconColor = () => {
      const alertType = item.data?.alertType || item.data?.type;
      if (alertType === 'glucose_critical' || alertType === 'blood_pressure_critical') {
        return colors.danger;
      } else if (alertType === 'glucose_warning' || alertType === 'blood_pressure_warning') {
        return colors.warning;
      } else if (alertType === 'health_alert') {
        return colors.primary;
      }
      return item.read ? colors.textSecondary : colors.primary;
    };

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.read && styles.notificationItemUnread]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationIcon}>
          <Ionicons
            name={getNotificationIcon()}
            size={24}
            color={getIconColor()}
          />
        </View>
        <View style={styles.notificationContent}>
          <Text style={[styles.notificationTitle, !item.read && styles.notificationTitleUnread]}>
            {item.title}
          </Text>
          <Text style={styles.notificationBody} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.notificationTime}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={styles.bellButton}
        onPress={() => setIsOpen(true)}
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
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Thông báo</Text>
              <View style={styles.headerActions}>
                {unreadCount > 0 && onMarkAllAsRead && (
                  <TouchableOpacity onPress={onMarkAllAsRead} style={styles.markAllButton}>
                    <Text style={styles.markAllText}>Đánh dấu đã đọc</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="notifications-off-outline"
                  size={64}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyText}>Chưa có thông báo</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                renderItem={renderNotification}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 10,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  notificationItemUnread: {
    backgroundColor: colors.primary + '08',
  },
  notificationIcon: {
    marginRight: spacing.md,
    paddingTop: spacing.xs,
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
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    marginTop: spacing.sm,
  },
});
