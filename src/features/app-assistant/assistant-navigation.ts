import type { AssistantDestination } from './app-assistant.api';
const routes: Record<Exclude<AssistantDestination, 'early_signal'>, string> = {
  checkin: '/checkin', checkin_history: '/tree', medication: '/medication', logs: '/logs',
  blood_pressure: '/logs/blood-pressure', glucose: '/logs/glucose', water: '/logs/water',
  consultation: '/doctor-consultation', profile: '/profile', reminders: '/reminder-config',
  notifications: '/notifications', care_circle: '/care-circle', scan_qr: '/care-circle/scan',
  missions: '/missions', coins: '/coins',
  health_status: '/health-status', health_tree: '/tree', feed: '/feed', daily_gift: '/checkin-rewards', gift_history: '/checkin-rewards/history',
  call_settings: '/checkin-call/settings', voice_settings: '/checkin-call/voice-settings', app_permissions: '/home?assistant_permissions=1',
  my_qr: '/care-circle/qr', subscription: '/subscription', subscription_plans: '/subscription/plans', wallet: '/wallet',
  terms: '/legal/content?type=terms', privacy_policy: '/legal/content?type=privacy', medical_sources: '/legal/sources',
};
export function assistantRoute(destination: AssistantDestination, owner: string | undefined) {
  if (destination === 'early_signal') return owner ? `/early-signal/${encodeURIComponent(owner)}` : null;
  return Object.hasOwn(routes, destination) ? routes[destination] : null;
}
export function assistantScreenRoute(action: import('./app-assistant.api').AssistantScreen) {
  const { screen, params } = action;
  if (screen === 'feed_article' && /^[\w-]{1,100}$/.test(params.id || '')) return `/feed/${encodeURIComponent(params.id)}`;
  if (screen === 'member' && /^\d+$/.test(params.id || '')) return `/care-circle/member/${params.id}?name=${encodeURIComponent(params.name || '')}`;
  if (screen === 'wallet_topup' && /^\d+$/.test(params.amount || '') && Number(params.amount) >= 10000 && Number(params.amount) <= 10000000)
    return `/wallet?assistant_amount=${params.amount}`;
  if (screen === 'upgrade' && (!params.plan || ['antam_2', 'antam_4', 'antam_8'].includes(params.plan)) && (!params.billing || ['monthly', 'yearly'].includes(params.billing)))
    return `/subscription/plans?${new URLSearchParams({ ...(params.plan ? { assistant_plan: params.plan } : {}), ...(params.billing ? { assistant_billing: params.billing } : {}) }).toString()}`;
  return null;
}
