import { create } from 'zustand';
import { Notification } from '../components/NotificationBell';
import {
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
  fetchFromBackend: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (notificationId: string) => void;
  clearAll: () => void;
}

// Convert backend notification to UI notification
function convertNotification(data: NotificationData): Notification {
  return {
    id: String(data.id),
    title: data.title,
    body: data.message,
    timestamp: new Date(data.created_at),
    read: data.is_read,
    data: data.data,
    type: data.type as any,
    priority: data.priority,
  };
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  fetchFromBackend: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetchNotifications(1, 50);
      if (response.ok && response.notifications) {
        const notifications = response.notifications.map(convertNotification);
        const unreadCount = response.pagination?.unreadCount || 0;
        set({ notifications, unreadCount, loading: false });
      } else {
        set({ error: response.error || 'Failed to fetch', loading: false });
      }
    } catch (error) {

      set({ error: 'Network error', loading: false });
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
    // Optimistic update
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      const unreadCount = notifications.filter(n => !n.read).length;
      return { notifications, unreadCount };
    });

    // Sync to backend
    const numericId = parseInt(notificationId);
    if (!isNaN(numericId)) {
      await markNotificationAsRead(numericId);
    }
  },

  markAllAsRead: async () => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));

    // Sync to backend
    await markAllNotificationsAsRead();
  },

  removeNotification: (notificationId) =>
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== notificationId);
      const unreadCount = notifications.filter(n => !n.read).length;
      
      return { notifications, unreadCount };
    }),

  clearAll: () =>
    set({ notifications: [], unreadCount: 0 }),
}));

