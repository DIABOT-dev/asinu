import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createHealthStoreStorage,
  healthStoreSession,
} from '../../lib/healthStoreSession';

type ConditionDraft = {
  summary: string;
  symptomOnset:
    '' | 'today' | 'two_to_seven_days' | 'over_one_week' | 'ongoing';
  progression: '' | 'improving' | 'stable' | 'worsening';
  severity: '' | 'mild' | 'moderate' | 'severe';
};

const empty: ConditionDraft = {
  summary: '',
  symptomOnset: '',
  progression: '',
  severity: '',
};
const storage = createHealthStoreStorage('consultation_condition_draft_v1');
const lifetime = 24 * 60 * 60 * 1000;

function restore(raw: string | null): ConditionDraft {
  try {
    const value = JSON.parse(raw || 'null');
    if (
      value?.version !== 1 ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= Date.now()
    ) {
      return empty;
    }
    return {
      summary: typeof value.summary === 'string' ? value.summary : '',
      symptomOnset: [
        '',
        'today',
        'two_to_seven_days',
        'over_one_week',
        'ongoing',
      ].includes(value.symptomOnset)
        ? value.symptomOnset
        : '',
      progression: ['', 'improving', 'stable', 'worsening'].includes(
        value.progression,
      )
        ? value.progression
        : '',
      severity: ['', 'mild', 'moderate', 'severe'].includes(value.severity)
        ? value.severity
        : '',
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
            !Object.values(values).some(Boolean) &&
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
        values: { ...latest.current.values, [key]: value },
      };
      latest.current = next;
      setState(next);
      if (!owner || healthStoreSession.capture().owner !== owner) {
        return;
      }
      // Enqueue in the input event itself: Back can unmount before effects run.
      // The shared adapter serializes reads/writes/deletion and rejects stale sessions.
      const operation = Object.values(next.values).some(Boolean)
        ? storage.setItem(
            '',
            JSON.stringify({
              ...next.values,
              version: 1,
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
