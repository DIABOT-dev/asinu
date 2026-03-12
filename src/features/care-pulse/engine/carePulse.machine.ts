import { EngineEvent, EngineState } from '../types';

const MORNING_START_HOUR = 6;
const MORNING_END_HOUR = 10;
const EVENING_START_HOUR = 19;
const EVENING_END_HOUR = 22;

const TIRED_INTERVAL_MS = 4 * 60 * 60 * 1000;
const EMERGENCY_INTERVAL_MS = 90 * 60 * 1000;
const EMERGENCY_ESCALATION_SILENCE_COUNT = 2;
const EMERGENCY_ESCALATION_DELAY_MS = 20 * 60 * 1000;

const toDate = (iso: string | null | undefined) => (iso ? new Date(iso) : null);
const toIso = (date: Date) => date.toISOString();

const setTime = (date: Date, hour: number, minute = 0) => {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isWithinWindow = (date: Date, startHour: number, endHour: number) => {
  const start = setTime(date, startHour);
  const end = setTime(date, endHour);
  return date >= start && date < end;
};

const computeNormalSchedule = (now: Date, lastCheckInAt: Date | null) => {
  const morningStart = setTime(now, MORNING_START_HOUR);
  const morningEnd = setTime(now, MORNING_END_HOUR);
  const eveningStart = setTime(now, EVENING_START_HOUR);
  const eveningEnd = setTime(now, EVENING_END_HOUR);

  const inMorning = now >= morningStart && now < morningEnd;
  const inEvening = now >= eveningStart && now < eveningEnd;

  if (inMorning) {
    const checkedIn = Boolean(
      lastCheckInAt && isSameDay(lastCheckInAt, now) && isWithinWindow(lastCheckInAt, MORNING_START_HOUR, MORNING_END_HOUR)
    );
    if (checkedIn) {
      return { nextAskAt: toIso(eveningStart), cooldownUntil: toIso(morningEnd) };
    }
    return { nextAskAt: toIso(morningStart), cooldownUntil: null };
  }

  if (inEvening) {
    const checkedIn = Boolean(
      lastCheckInAt && isSameDay(lastCheckInAt, now) && isWithinWindow(lastCheckInAt, EVENING_START_HOUR, EVENING_END_HOUR)
    );
    if (checkedIn) {
      return { nextAskAt: toIso(setTime(addDays(now, 1), MORNING_START_HOUR)), cooldownUntil: toIso(eveningEnd) };
    }
    return { nextAskAt: toIso(eveningStart), cooldownUntil: null };
  }

  if (now < morningStart) {
    return { nextAskAt: toIso(morningStart), cooldownUntil: null };
  }
  if (now < eveningStart) {
    return { nextAskAt: toIso(eveningStart), cooldownUntil: null };
  }
  return { nextAskAt: toIso(setTime(addDays(now, 1), MORNING_START_HOUR)), cooldownUntil: null };
};

const computeTiredSchedule = (now: Date, lastCheckInAt: Date | null) => {
  if (!lastCheckInAt) {
    return { nextAskAt: toIso(now), cooldownUntil: null };
  }
  const nextAsk = new Date(lastCheckInAt.getTime() + TIRED_INTERVAL_MS);
  return { nextAskAt: toIso(nextAsk), cooldownUntil: toIso(nextAsk) };
};

const computeEmergencySchedule = (now: Date, lastCheckInAt: Date | null, lastAskAt: Date | null) => {
  const base = lastAskAt || lastCheckInAt;
  if (!base) {
    return { nextAskAt: toIso(now), cooldownUntil: null };
  }
  const nextAsk = new Date(base.getTime() + EMERGENCY_INTERVAL_MS);
  return { nextAskAt: toIso(nextAsk), cooldownUntil: null };
};

export const computeNext = (state: EngineState, event: EngineEvent, now: Date): EngineState => {
  let nextState: EngineState = { ...state };

  if (event.type === 'CHECK_IN') {
    nextState = {
      ...nextState,
      currentStatus: event.status,
      lastCheckInAt: toIso(now),
      lastTriggerSource: event.triggerSource,
      silenceCount: 0,
      emergencyArmed: event.status === 'EMERGENCY',
      emergencyLastAskAt: event.status === 'EMERGENCY' ? toIso(now) : null,
      escalationNeeded: false
    };
  } else if (event.type === 'POPUP_SHOWN') {
    nextState = {
      ...nextState,
      emergencyLastAskAt: nextState.currentStatus === 'EMERGENCY' ? toIso(now) : nextState.emergencyLastAskAt
    };
  } else if (event.type === 'POPUP_DISMISSED') {
    if (nextState.currentStatus === 'EMERGENCY' && nextState.emergencyArmed) {
      nextState = { ...nextState, silenceCount: nextState.silenceCount + 1 };
    }
  } else if (event.type === 'RESET_EMERGENCY') {
    nextState = {
      ...nextState,
      currentStatus: 'NORMAL',
      lastCheckInAt: toIso(now),
      silenceCount: 0,
      emergencyArmed: false,
      emergencyLastAskAt: null,
      escalationNeeded: false
    };
  }

  const lastCheckIn = toDate(nextState.lastCheckInAt);
  const lastAsk = toDate(nextState.emergencyLastAskAt);

  const schedule =
    nextState.currentStatus === 'TIRED'
      ? computeTiredSchedule(now, lastCheckIn)
      : nextState.currentStatus === 'EMERGENCY'
        ? computeEmergencySchedule(now, lastCheckIn, lastAsk)
        : computeNormalSchedule(now, lastCheckIn);

  const shouldEscalate =
    nextState.currentStatus === 'EMERGENCY' &&
    nextState.emergencyArmed &&
    nextState.silenceCount >= EMERGENCY_ESCALATION_SILENCE_COUNT &&
    Boolean(lastAsk) &&
    now.getTime() - (lastAsk as Date).getTime() >= EMERGENCY_ESCALATION_DELAY_MS;

  return {
    ...nextState,
    nextAskAt: schedule.nextAskAt,
    cooldownUntil: schedule.cooldownUntil,
    escalationNeeded: shouldEscalate
  };
};
