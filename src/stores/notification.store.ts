import { create } from 'zustand';
import { Notification } from '../components/NotificationBell';
import {
    deleteAllNotifications,
    deleteNotification,
    fetchNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
    NotificationData
} from '../features/notifications/notifications.api';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  _fetching: boolean;
  fetchFromBackend: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

// Convert backend notification to UI notification
function convertNotification(data: NotificationData): Notification {
  return {
    id: String(data.id),
    type: data.type,
    title: data.title,
    body: data.message,
    timestamp: new Date(data.created_at.endsWith('Z') ? data.created_at : data.created_at + 'Z'),
    read: data.is_read,
    data: data.data,
    priority: data.priority,
  };
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  _fetching: false,
  fetchFromBackend: async () => {
    // Prevent concurrent fetches (mount + AppState + interval can overlap)
    if (get()._fetching) return;
    set({ _fetching: true });
    // Only show loading on first fetch, not on polling (avoids rerender every 30s)
    const isFirstFetch = get().notifications.length === 0 && !get().error;
    if (isFirstFetch) set({ loading: true, error: null });
    try {
      const response = await fetchNotifications(1, 50);
      if (response.ok && response.notifications) {
        const notifications = response.notifications.map(convertNotification);
        const unreadCount = response.pagination?.unreadCount || 0;
        // Skip set if data hasn't changed (prevents unnecessary rerenders)
        const current = get();
        if (current.unreadCount === unreadCount && current.notifications.length === notifications.length
            && current.notifications[0]?.id === notifications[0]?.id) {
          if (isFirstFetch) set({ loading: false, _fetching: false });
          else set({ _fetching: false });
          return;
        }
        set({ notifications, unreadCount, loading: false, error: null });
      } else {
        set({ error: response.error || 'Failed to fetch', loading: false });
      }
    } catch (error) {
      set({ error: 'Network error', loading: false });
    } finally {
      set({ _fetching: false });
    }
  },

  addNotification: (notification) =>
    set((state) => {
      const newNotification: Notification = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random()}`,
        timestamp: new Date(),
        read: false,
      };
      
      const notifications = [newNotification, ...state.notifications];
      const unreadCount = notifications.filter(n => !n.read).length;
      
      return { notifications, unreadCount };
    }),

  markAsRead: async (notificationId) => {
    const prev = get().notifications;
    // Optimistic update
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      const unreadCount = notifications.filter(n => !n.read).length;
      return { notifications, unreadCount };
    });

    // Sync to backend — rollback on failure
    const numericId = parseInt(notificationId);
    if (!isNaN(numericId)) {
      try {
        await markNotificationAsRead(numericId);
      } catch {
        set({ notifications: prev, unreadCount: prev.filter(n => !n.read).length });
      }
    }
  },

  markAllAsRead: async () => {
    const prev = get().notifications;
    const prevUnread = get().unreadCount;
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));

    // Sync to backend — rollback on failure
    try {
      await markAllNotificationsAsRead();
    } catch {
      set({ notifications: prev, unreadCount: prevUnread });
    }
  },

  removeNotification: async (notificationId) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== notificationId),
      unreadCount: state.notifications.filter((n) => n.id !== notificationId && !n.read).length,
    }));
    const numericId = parseInt(notificationId);
    if (!isNaN(numericId)) {
      await deleteNotification(numericId).catch(() => {});
    }
  },

  clearAll: async () => {
    set({ notifications: [], unreadCount: 0 });
    await deleteAllNotifications().catch(() => {});
  },
}));

