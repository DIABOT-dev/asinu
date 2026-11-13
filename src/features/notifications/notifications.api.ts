import { apiClient } from '../../lib/apiClient';
import { notifyTaskReminderPreferenceChanged } from '../../lib/device-permission-events';
import { tokenStore } from '../../lib/tokenStore';

export interface NotificationData {
  id: number;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  priority?: 'low' | 'medium' | 'high' | 'critical';
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

/**
 * Delete a single notification
 */
export async function deleteNotification(notificationId: number): Promise<{ ok: boolean; error?: string }> {
  return apiClient<{ ok: boolean; error?: string }>(`/api/notifications/${notificationId}`, { method: 'DELETE' });
}

/**
 * Delete all notifications
 */
export async function deleteAllNotifications(): Promise<{ ok: boolean; error?: string }> {
  return apiClient<{ ok: boolean; error?: string }>('/api/notifications', { method: 'DELETE' });
}

export interface NotificationPreferences {
  ok: boolean;
  reminder_assistant_enabled?: boolean;
  // Legacy hour-only (kept for backward compat)
  morning_hour: number | null;
  evening_hour: number | null;
  water_hour:   number | null;
  inferred_morning_hour: number | null;
  inferred_evening_hour: number | null;
  inferred_water_hour:   number | null;
  inferred_at: string | null;
  effective_morning_hour: number;
  effective_evening_hour: number;
  effective_water_hour:   number;
  // HH:MM time strings (new)
  morning_time:   string | null;
  afternoon_time: string | null;
  evening_time:   string | null;
  inferred_morning_time:   string | null;
  inferred_afternoon_time: string | null;
  inferred_evening_time:   string | null;
  effective_morning_time:   string;
  effective_afternoon_time: string;
  effective_evening_time:   string;
  reminders_enabled: boolean;
  health_feed_enabled: boolean;
  error?: string;
}

export type ReminderSlot = 'morning' | 'afternoon' | 'evening';
export type ReminderAssistantPlan = {
  ok: boolean;
  status: 'ready' | 'clarify' | 'unsupported' | 'unchanged';
  question?: string;
  planToken?: string;
  changes?: Array<{ slot: ReminderSlot; before: string; time: string }>;
};
export type ReminderAssistantResult = {
  ok: boolean;
  status: 'applied';
  preferences: NotificationPreferences;
};

export const planReminderTimes = (text: string, signal?: AbortSignal) =>
  apiClient<ReminderAssistantPlan>('/api/notifications/reminder-assistant/plan', {
    method: 'POST', body: { text }, timeoutMs: 45000, signal,
  });
export async function applyReminderTimes(token: string, signal?: AbortSignal) {
  preferenceRead = null;
  try {
    return await apiClient<ReminderAssistantResult>('/api/notifications/reminder-assistant/apply', {
      method: 'POST', body: { token }, signal,
    });
  } finally { preferenceRead = null; }
}

let preferenceRead: { token: string | null; request: Promise<NotificationPreferences> } | null = null;

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const token = tokenStore.getToken();
  if (preferenceRead?.token === token) return preferenceRead.request;
  // Permission rows mounted together share only the pending read, never cached consent.
  const read = { token, request: apiClient<NotificationPreferences>('/api/notifications/preferences') };
  preferenceRead = read;
  try {
    return await read.request;
  } finally {
    if (preferenceRead === read) preferenceRead = null;
  }
}

export async function updateNotificationPreferences(prefs: {
  morning_hour?: number | null;
  evening_hour?: number | null;
  water_hour?:   number | null;
  morning_time?: string | null;
  afternoon_time?: string | null;
  evening_time?: string | null;
  reminders_enabled?: boolean;
  health_feed_enabled?: boolean;
}): Promise<NotificationPreferences> {
  // A read started before a save must not satisfy the refresh after that save.
  preferenceRead = null;
  let response: NotificationPreferences;
  try {
    response = await apiClient<NotificationPreferences>('/api/notifications/preferences', {
      method: 'PUT',
      body: prefs,
    });
  } finally {
    preferenceRead = null;
  }
  if (response.ok && typeof prefs.reminders_enabled === 'boolean') {
    notifyTaskReminderPreferenceChanged();
  }
  return response;
}
