import { EngineState } from '../types';

export type SchedulerContext = {
  isAppForeground: boolean;
  routeName?: string;
};

export const shouldShowPopup = (state: EngineState, now: Date, context: SchedulerContext) => {
  if (!context.isAppForeground) return false;
  if (!state.nextAskAt) return false;
  const nextAsk = new Date(state.nextAskAt);
  if (now < nextAsk) return false;
  if (state.cooldownUntil) {
    const cooldown = new Date(state.cooldownUntil);
    if (now < cooldown) return false;
  }
  return true;
};
