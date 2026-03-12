import { apiClient } from '../../../lib/apiClient';
import { EngineState, PulseStatus } from '../types';

type CarePulseEventType = 'CHECK_IN' | 'POPUP_SHOWN' | 'POPUP_DISMISSED' | 'APP_OPENED';
type CarePulseSource = 'scheduler' | 'manual' | 'push' | 'system';

type SendEventInput = {
  eventType: CarePulseEventType;
  source: CarePulseSource;
  uiSessionId: string;
  selfReport?: PulseStatus;
};

type CarePulseStateResponse = {
  ok: boolean;
  state: EngineState;
  aps: number;
  tier: number;
  reasons: string[];
  state_name: PulseStatus;
};

const generateEventId = () => {
  const cryptoObj = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getClientTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok';
  } catch {
    return 'Asia/Bangkok';
  }
};

export const sendCarePulseEvent = async (input: SendEventInput) => {
  const payload = {
    event_type: input.eventType,
    event_id: generateEventId(),
    client_ts: Date.now(),
    client_tz: getClientTimezone(),
    ui_session_id: input.uiSessionId,
    source: input.source,
    self_report: input.selfReport
  };

  return apiClient<CarePulseStateResponse>('/api/care-pulse/events', {
    method: 'POST',
    body: payload
  });
};

export const fetchCarePulseState = async () => {
  return apiClient<CarePulseStateResponse>('/api/care-pulse/state');
};
