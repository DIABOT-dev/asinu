import { create } from 'zustand';
import { Notification } from '../components/NotificationBell';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,

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

  markAsRead: (notificationId) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      const unreadCount = notifications.filter(n => !n.read).length;
      
      return { notifications, unreadCount };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  removeNotification: (notificationId) =>
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== notificationId);
      const unreadCount = notifications.filter(n => !n.read).length;
      
      return { notifications, unreadCount };
    }),

  clearAll: () =>
    set({ notifications: [], unreadCount: 0 }),
}));
