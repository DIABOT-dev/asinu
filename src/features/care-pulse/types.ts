export type PulseStatus = 'NORMAL' | 'TIRED' | 'EMERGENCY';

export type TriggerSource = 'POPUP' | 'HOME_WIDGET' | 'EMERGENCY_BUTTON';

export type EngineState = {
  currentStatus: PulseStatus;
  lastCheckInAt: string | null;
  cooldownUntil: string | null;
  nextAskAt: string | null;
  silenceCount: number;
  emergencyArmed: boolean;
  emergencyLastAskAt: string | null;
  lastAppOpenedAt: string | null;
  episodeId: string | null;
  aps: number;
  tier: number;
  reasons: string[];
  lastTriggerSource?: TriggerSource | null;
  escalationNeeded?: boolean;
};

export type EngineEvent =
  | { type: 'CHECK_IN'; status: PulseStatus; subStatus?: string; triggerSource: TriggerSource }
  | { type: 'POPUP_SHOWN' }
  | { type: 'POPUP_DISMISSED' }
  | { type: 'APP_OPENED' }
  | { type: 'TICK' }
  | { type: 'RESET_EMERGENCY' };

export const initialEngineState: EngineState = {
  currentStatus: 'NORMAL',
  lastCheckInAt: null,
  cooldownUntil: null,
  nextAskAt: null,
  silenceCount: 0,
  emergencyArmed: false,
  emergencyLastAskAt: null,
  lastAppOpenedAt: null,
  episodeId: null,
  aps: 0,
  tier: 0,
  reasons: [],
  lastTriggerSource: null,
  escalationNeeded: false
};
