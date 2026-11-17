import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../auth/auth.store";
import { chatApi } from "../chat/chat.api";
import type { AssistantMessage } from "./assistant-conversation.storage";

export type AssistantRating = "like" | "dislike";
const prefix = "asinu-assistant:";
export function useAssistantMessageFeedback() {
  const owner = useAuthStore((state) => state.profile?.id);
  const token = useAuthStore((state) => state.token);
  const [ratings, setRatings] = useState<Record<string, AssistantRating>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const ready = useRef(false);
  const locks = useRef(new Set<string>());
  const isCurrent = (version: number) =>
    generation.current === version &&
    !!owner &&
    !!token &&
    useAuthStore.getState().profile?.id === owner &&
    useAuthStore.getState().token === token;
  const refresh = async (version: number) => {
    const response = await chatApi.fetchFeedbacks();
    if (!isCurrent(version)) return;
    setRatings(
      Object.fromEntries(
        Object.entries(response)
          .filter(
            ([id, value]) =>
              id.startsWith(prefix) && ["like", "dislike"].includes(value)
          )
          .map(([id, value]) => [id.slice(prefix.length), value])
      )
    );
    ready.current = true;
  };
  useEffect(() => {
    const version = ++generation.current;
    ready.current = false;
    locks.current = new Set();
    setRatings({});
    setPending({});
    setErrors({});
    setLoading(true);
    if (owner && token)
      void refresh(version)
        .catch(() => {})
        .finally(() => {
          if (isCurrent(version)) setLoading(false);
        });
    else setLoading(false);
    return () => {
      generation.current++;
    };
  }, [owner, token]);
  const rate = async (message: AssistantMessage, rating: AssistantRating) => {
    const version = generation.current;
    if (
      message.role !== "assistant" ||
      !isCurrent(version) ||
      locks.current.has(message.id)
    )
      return;
    locks.current.add(message.id);
    setPending((previous) => ({ ...previous, [message.id]: true }));
    setErrors((previous) => ({ ...previous, [message.id]: false }));
    try {
      // A failed prior read must be reconciled before another toggle can be sent.
      if (!ready.current) {
        await refresh(version);
        return;
      }
      const response = await chatApi.sendFeedback(
        prefix + message.id,
        message.text,
        rating
      );
      if (!isCurrent(version)) return;
      if (
        !response.ok ||
        !["saved", "updated", "removed"].includes(response.action)
      )
        throw new Error("Invalid feedback response");
      setRatings((previous) => {
        const next = { ...previous };
        if (response.action === "removed") delete next[message.id];
        else next[message.id] = rating;
        return next;
      });
    } catch {
      if (!isCurrent(version)) return;
      ready.current = false;
      setErrors((previous) => ({ ...previous, [message.id]: true }));
      try {
        await refresh(version);
      } catch {}
    } finally {
      if (isCurrent(version)) {
        locks.current.delete(message.id);
        setPending((previous) => ({ ...previous, [message.id]: false }));
      }
    }
  };
  return { ratings, pending, errors, loading, rate };
}
