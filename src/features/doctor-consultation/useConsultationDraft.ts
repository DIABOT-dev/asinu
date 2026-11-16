import { useCallback, useEffect, useRef, useState } from "react";
import {
  createHealthStoreStorage,
  healthStoreSession,
} from "../../lib/healthStoreSession";
import type { ScreeningAnswer } from "./useConsultationScreening";

type ConditionDraft = {
  summary: string;
  answers: ScreeningAnswer[];
  locale: "" | "vi" | "en";
};

const empty: ConditionDraft = {
  summary: "",
  answers: [],
  locale: "",
};
const stores = new Map<string, ReturnType<typeof createHealthStoreStorage>>();
const storageFor = (scope: string) => {
  if (!stores.has(scope))
    stores.set(
      scope,
      createHealthStoreStorage(
        "consultation_condition_draft_v1" +
          (scope
            ? "_case_" +
              Array.from(scope, (c) =>
                c.charCodeAt(0).toString(16).padStart(4, "0")
              ).join("")
            : "")
      )
    );
  return stores.get(scope)!;
};
const lifetime = 24 * 60 * 60 * 1000;

function restore(raw: string | null): ConditionDraft {
  try {
    const value = JSON.parse(raw || "null");
    if (
      ![1, 2].includes(value?.version) ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= Date.now()
    ) {
      return empty;
    }
    return {
      summary: typeof value.summary === "string" ? value.summary : "",
      locale: ["vi", "en"].includes(value.locale) ? value.locale : "",
      answers:
        value.version === 2 &&
        Array.isArray(value.answers) &&
        value.answers.length <= 5 &&
        value.answers.every(
          (answer: ScreeningAnswer) =>
            answer &&
            [
              "red_flags",
              "associated",
              "onset",
              "progression",
              "impact",
            ].includes(answer.step) &&
            Array.isArray(answer.values) &&
            answer.values.every((item) => typeof item === "string") &&
            typeof answer.text === "string"
        )
          ? value.answers
          : [],
    };
  } catch {
    return empty;
  }
}

export function useConsultationDraft(owner: string | null, scope = "") {
  const storage = storageFor(scope);
  const [state, setState] = useState({
    owner,
    scope,
    ready: false,
    values: empty,
  });
  const submitted = useRef(false);
  const currentOwner = useRef(owner);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const latest = useRef(state);
  currentOwner.current = owner;
  latest.current = state;

  useEffect(() => {
    let active = true;
    submitted.current = false;
    setState({ owner, scope, ready: !owner, values: empty });
    if (owner) {
      storage
        .getItem(scope)
        .catch(() => null)
        .then((raw) => {
          if (!active) {
            return;
          }
          const values = restore(raw);
          if (
            raw &&
            !values.summary &&
            !values.answers.length &&
            healthStoreSession.capture().owner === owner
          ) {
            storage.removeItem(scope).catch(() => {});
          }
          latest.current = { owner, scope, ready: true, values };
          setState(latest.current);
        });
    }
    return () => {
      active = false;
    };
  }, [owner, scope]);

  const ready = state.owner === owner && state.scope === scope && state.ready;
  const values =
    state.owner === owner && state.scope === scope ? state.values : empty;
  const update = useCallback(
    <K extends keyof ConditionDraft>(key: K, value: ConditionDraft[K]) => {
      if (
        currentOwner.current !== owner ||
        currentScope.current !== scope ||
        latest.current.owner !== owner ||
        latest.current.scope !== scope ||
        !latest.current.ready ||
        submitted.current
      ) {
        return;
      }
      const next = {
        ...latest.current,
        values: {
          ...latest.current.values,
          ...(key === "summary" ||
          (key === "locale" && value !== latest.current.values.locale)
            ? { answers: [] }
            : {}),
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
      const operation =
        next.values.summary || next.values.answers.length
          ? storage.setItem(
              scope,
              JSON.stringify({
                ...next.values,
                version: 2,
                expiresAt: Date.now() + lifetime,
              })
            )
          : storage.removeItem(scope);
      operation.catch(() => {});
    },
    [owner, scope]
  );

  const clear = useCallback(async () => {
    if (
      currentOwner.current !== owner ||
      currentScope.current !== scope ||
      healthStoreSession.capture().owner !== owner
    ) {
      return;
    }
    submitted.current = true;
    await storage.removeItem(scope).catch(() => {});
    // Keep the completed screen inert until navigation removes it.
  }, [owner, scope]);

  return { values, ready, update, clear };
}
