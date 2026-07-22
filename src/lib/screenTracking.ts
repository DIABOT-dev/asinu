import { apiClient } from './apiClient';

/**
 * Report a route change to ASINU. Tracking is best-effort and callers should
 * intentionally swallow failures so navigation is never blocked by telemetry.
 */
export const trackScreenViewed = (screenName: string, featureCode?: string): Promise<{ ok: boolean }> =>
  apiClient<{ ok: boolean }>('/api/mobile/engagement/screen-view', {
    method: 'POST',
    body: {
      screen_name: screenName,
      ...(featureCode ? { feature_code: featureCode } : {}),
    },
    timeoutMs: 4000,
  });
