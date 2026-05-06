/**
 * Real-time data sync — dispatch refresh tới các zustand store khi nhận
 * push notification. App tự cập nhật mà không cần reload / pull-refresh.
 *
 * Usage: gọi `dispatchRealtimeRefresh(type)` trong foreground notification
 * handler (SessionProvider). Mỗi notification type sẽ trigger refresh các
 * store liên quan.
 */

// Map notification type → list các store sẽ được refresh.
// Nếu type không có trong map → không refresh gì (chỉ show toast/log).
const REFRESH_BY_TYPE: Record<string, string[]> = {
  // ── Care circle ──
  care_circle_invitation:          ['careCircle', 'notifications'],
  care_circle_accepted:            ['careCircle', 'notifications'],
  care_circle_rejected:            ['careCircle', 'notifications'],
  care_circle_removed:             ['careCircle', 'notifications'],
  care_circle_permission_changed:  ['careCircle', 'notifications'],

  // ── Subscription / Premium ──
  subscription_activated:    ['profile', 'notifications'],
  subscription_expiring_soon:['notifications'],
  subscription_expired:      ['profile', 'notifications'],

  // ── Payment / Wallet ──
  payment_failed:        ['notifications'],
  wallet_topup_success:  ['profile', 'notifications'],
  wallet_low_balance:    ['profile', 'notifications'],

  // ── Health / Logs ──
  health_alert:    ['logs', 'wellness', 'notifications'],

  // ── Caregiver alert (caregiver phía bên kia) ──
  caregiver_alert:     ['notifications'],
  caregiver_confirmed: ['notifications', 'wellness'], // patient nhận confirm → wellness state có thể đổi
  emergency:           ['notifications', 'wellness'],

  // ── Check-in reminders ──
  morning_checkin:           ['notifications'],
  checkin_followup:          ['notifications'],
  checkin_followup_urgent:   ['notifications'],
  evening_checkin:           ['notifications'],
  reminder_morning:          ['notifications'],
  reminder_morning_summary:  ['notifications'],
  reminder_log_morning:      ['notifications'],
  reminder_afternoon:        ['notifications'],
  reminder_evening_summary:  ['notifications'],
  reminder_log_evening:      ['notifications'],
  reminder_glucose:          ['notifications'],
  reminder_bp:               ['notifications'],
  reminder_medication:        ['notifications'],
  reminder_medication_morning:['notifications'],
  reminder_medication_evening:['notifications'],

  // ── Gamification ──
  streak_7:             ['missions', 'tree', 'notifications'],
  streak_14:            ['missions', 'tree', 'notifications'],
  streak_30:            ['missions', 'tree', 'notifications'],
  streak_start:         ['missions', 'tree', 'notifications'],
  streak_milestone:     ['missions', 'tree', 'notifications'],
  milestone:            ['missions', 'tree', 'notifications'],
  weekly_recap:         ['missions', 'notifications'],

  // ── Engagement ──
  weekly_wellness_summary: ['wellness', 'notifications'],
  profile_incomplete:      ['profile', 'notifications'],
  reengagement:            ['notifications'],
  engagement:              ['notifications'],

};

/**
 * Refresh các store dựa trên notification type. Không throw — mọi lỗi log
 * và bỏ qua để không crash app.
 */
export function dispatchRealtimeRefresh(type: string | undefined): void {
  if (!type) return;
  const stores = REFRESH_BY_TYPE[type];
  if (!stores || stores.length === 0) return;

  // Lazy require: tránh circular import giữa providers/stores/lib.
  for (const store of stores) {
    try {
      switch (store) {
        case 'careCircle': {
          const { useCareCircle } = require('../features/care-circle');
          useCareCircle.getState().refresh();
          break;
        }
        case 'notifications': {
          const { useNotificationStore } = require('../stores/notification.store');
          useNotificationStore.getState().fetchFromBackend();
          break;
        }
        case 'profile': {
          const { useProfileStore } = require('../features/profile/profile.store');
          useProfileStore.getState().fetchProfile();
          break;
        }
        case 'missions': {
          const { useMissionsStore } = require('../features/missions/missions.store');
          useMissionsStore.getState().fetchMissions();
          break;
        }
        case 'logs': {
          const { useLogsStore } = require('../features/logs/logs.store');
          useLogsStore.getState().fetchRecent();
          break;
        }
        case 'tree': {
          const { useTreeStore } = require('../features/tree/tree.store');
          useTreeStore.getState().fetchTree();
          break;
        }
        case 'wellness': {
          const { useWellnessStore } = require('../features/wellness/store/wellness.store');
          // Wellness có nhiều fetch khác nhau — fetchAlerts là nhẹ nhất + đủ cho real-time
          useWellnessStore.getState().fetchAlerts();
          break;
        }
        case 'carePulse': {
          const { useCarePulseStore } = require('../features/care-pulse/store/carePulse.store');
          useCarePulseStore.getState().refresh?.();
          break;
        }
        case 'auth': {
          const { useAuthStore } = require('../features/auth/auth.store');
          useAuthStore.getState().bootstrap?.();
          break;
        }
      }
    } catch (err) {
      // Silent — store có thể chưa init / chưa login
    }
  }
}
