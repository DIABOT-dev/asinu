import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createHealthStoreStorage,
  healthStoreSession,
} from '../../lib/healthStoreSession';
import type { ScreeningAnswer } from './useConsultationScreening';

type ConditionDraft = {
  summary: string;
  answers: ScreeningAnswer[];
  locale: '' | 'vi' | 'en';
};

const empty: ConditionDraft = {
  summary: '',
  answers: [],
  locale: '',
};
const storage = createHealthStoreStorage('consultation_condition_draft_v1');
const lifetime = 24 * 60 * 60 * 1000;

function restore(raw: string | null): ConditionDraft {
  try {
    const value = JSON.parse(raw || 'null');
    if (
      ![1, 2].includes(value?.version) ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= Date.now()
    ) {
      return empty;
    }
    return {
      summary: typeof value.summary === 'string' ? value.summary : '',
      locale: ['vi', 'en'].includes(value.locale) ? value.locale : '',
      answers: value.version === 2 && Array.isArray(value.answers)
        && value.answers.length <= 5 && value.answers.every((answer: ScreeningAnswer) =>
          answer && ['red_flags', 'associated', 'onset', 'progression', 'impact'].includes(answer.step)
          && Array.isArray(answer.values) && answer.values.every(item => typeof item === 'string')
          && typeof answer.text === 'string') ? value.answers : [],
    };
  } catch {
    return empty;
  }
}

export function useConsultationDraft(owner: string | null) {
  const [state, setState] = useState({ owner, ready: false, values: empty });
  const submitted = useRef(false);
  const currentOwner = useRef(owner);
  const latest = useRef(state);
  currentOwner.current = owner;
  latest.current = state;

  useEffect(() => {
    let active = true;
    submitted.current = false;
    setState({ owner, ready: !owner, values: empty });
    if (owner) {
      storage
        .getItem('')
        .catch(() => null)
        .then((raw) => {
          if (!active) {
            return;
          }
          const values = restore(raw);
          if (
            raw &&
            !values.summary && !values.answers.length &&
            healthStoreSession.capture().owner === owner
          ) {
            storage.removeItem('').catch(() => {});
          }
          latest.current = { owner, ready: true, values };
          setState(latest.current);
        });
    }
    return () => {
      active = false;
    };
  }, [owner]);

  const ready = state.owner === owner && state.ready;
  const values = state.owner === owner ? state.values : empty;
  const update = useCallback(
    <K extends keyof ConditionDraft>(key: K, value: ConditionDraft[K]) => {
      if (
        currentOwner.current !== owner ||
        latest.current.owner !== owner ||
        !latest.current.ready ||
        submitted.current
      ) {
        return;
      }
      const next = {
        ...latest.current,
        values: {
          ...latest.current.values,
          ...(key === 'summary' || (key === 'locale' && value !== latest.current.values.locale) ? { answers: [] } : {}),
          [key]: value,
        },
      };
      latest.current = next;
      setState(next);
      if (!owner || healthStoreSession.capture().owner !== owner) {
        return;
      }
      // Enqueue in the input event itself: Back can unmount before effects run.
      // The shared adapter serializes reads/writes/deletion and rejects stale sessions.
      const operation = next.values.summary || next.values.answers.length
        ? storage.setItem(
            '',
            JSON.stringify({
              ...next.values,
              version: 2,
              expiresAt: Date.now() + lifetime,
            }),
          )
        : storage.removeItem('');
      operation.catch(() => {});
    },
    [owner],
  );

  const clear = useCallback(async () => {
    if (
      currentOwner.current !== owner ||
      healthStoreSession.capture().owner !== owner
    ) {
      return;
    }
    submitted.current = true;
    await storage.removeItem('').catch(() => {});
    // Keep the completed screen inert until navigation removes it.
  }, [owner]);

  return { values, ready, update, clear };
}
