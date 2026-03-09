import { apiClient } from '../../lib/apiClient';

export interface NotificationData {
  id: number;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface NotificationsResponse {
  ok: boolean;
  notifications?: NotificationData[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    unreadCount: number;
  };
  error?: string;
}

/**
 * Fetch notifications from backend
 */
export async function fetchNotifications(page = 1, limit = 20): Promise<NotificationsResponse> {
  return apiClient<NotificationsResponse>(`/api/notifications?page=${page}&limit=${limit}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: number): Promise<{ ok: boolean; error?: string }> {
  return apiClient<{ ok: boolean; error?: string }>(`/api/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    }
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<{ ok: boolean; error?: string }> {
  return apiClient<{ ok: boolean; error?: string }>('/api/notifications/mark-all-read', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    }
  });
}

export interface NotificationPreferences {
  ok: boolean;
  // User-set (null = auto)
  morning_hour: number | null;
  evening_hour: number | null;
  water_hour:   number | null;
  // Auto-inferred from behavior
  inferred_morning_hour: number | null;
  inferred_evening_hour: number | null;
  inferred_water_hour:   number | null;
  inferred_at: string | null;
  // What will actually fire
  effective_morning_hour: number;
  effective_evening_hour: number;
  effective_water_hour:   number;
  error?: string;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiClient<NotificationPreferences>('/api/notifications/preferences');
}

export async function updateNotificationPreferences(prefs: {
  morning_hour: number | null;
  evening_hour: number | null;
  water_hour:   number | null;
}): Promise<NotificationPreferences> {
  return apiClient<NotificationPreferences>('/api/notifications/preferences', {
    method: 'PUT',
    body: prefs,
  });
}
