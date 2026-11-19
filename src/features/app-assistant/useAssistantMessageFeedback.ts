import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "../../stores/toast.store";
import { useAuthStore } from "../auth/auth.store";
import { chatApi } from "../chat/chat.api";
import type { AssistantMessage } from "./assistant-conversation.storage";

export type AssistantRating = "like" | "dislike";
type RatingSession = {
  owner: string;
  token: string;
  loading: boolean;
  ratings: Record<string, AssistantRating>;
  pending: Set<string>;
};
const prefix = "asinu-assistant:";
export function useAssistantMessageFeedback() {
  const owner = useAuthStore((state) => state.profile?.id);
  const token = useAuthStore((state) => state.token);
  const { t } = useTranslation("settings");
  const [ratings, setRatings] = useState<Record<string, AssistantRating>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<RatingSession | null>(null);
  const session = sessionRef.current;
  const isCurrent = (candidate: RatingSession) => {
    const auth = useAuthStore.getState();
    return sessionRef.current === candidate &&
      auth.profile?.id === candidate.owner && auth.token === candidate.token;
  };
  useEffect(() => {
    setRatings({});
    setPending({});
    setErrors({});
    setLoading(!!owner && !!token);
    if (!owner || !token) return;
    const currentSession: RatingSession = {
      owner, token, loading: true, ratings: {}, pending: new Set(),
    };
    sessionRef.current = currentSession;
    void chatApi.fetchFeedbacks()
      .then(response => {
        if (!isCurrent(currentSession)) return;
        currentSession.ratings = Object.fromEntries(
          Object.entries(response)
            .filter(([id, value]) => id.startsWith(prefix) && (value === "like" || value === "dislike"))
            .map(([id, value]) => [id.slice(prefix.length), value])
        );
        setRatings(currentSession.ratings);
      })
      .catch(() => {})
      .finally(() => {
        if (!isCurrent(currentSession)) return;
        currentSession.loading = false;
        setLoading(false);
      });
    return () => {
      sessionRef.current = null;
    };
  }, [owner, token]);
  const rate = async (message: AssistantMessage, rating: AssistantRating) => {
    if (
      message.role !== "assistant" ||
      !session || !isCurrent(session) || session.loading ||
      session.pending.has(message.id) || session.ratings[message.id] === rating
    )
      return;
    session.pending.add(message.id);
    setPending((previous) => ({ ...previous, [message.id]: true }));
    setErrors((previous) => ({ ...previous, [message.id]: false }));
    try {
      const response = await chatApi.sendFeedback(
        prefix + message.id,
        message.text,
        rating
      );
      if (!isCurrent(session)) return;
      if (
        !response.ok ||
        !["saved", "updated"].includes(response.action)
      )
        throw new Error("Invalid feedback response");
      session.ratings = { ...session.ratings, [message.id]: rating };
      setRatings(session.ratings);
      showToast(t("appAssistant.feedbackThanks"), "success", 3500);
    } catch {
      if (!isCurrent(session)) return;
      // A server commit may have succeeded even when the response never arrived.
      // Let the user explicitly send either choice again using the idempotent API.
      const knownRatings = { ...session.ratings };
      delete knownRatings[message.id];
      session.ratings = knownRatings;
      setErrors((previous) => ({ ...previous, [message.id]: true }));
    } finally {
      if (isCurrent(session)) {
        session.pending.delete(message.id);
        setPending((previous) => ({ ...previous, [message.id]: false }));
      }
    }
  };
  if (!session || !isCurrent(session)) return { ratings: {}, pending: {}, errors: {}, loading: !!owner && !!token, rate };
  return { ratings, pending, errors, loading, rate };
}
