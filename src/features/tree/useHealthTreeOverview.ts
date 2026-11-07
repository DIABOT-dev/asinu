import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuthStore } from "../auth/auth.store";
import { checkinApi, type HealthScoreData } from "../checkin/checkin.api";

type OverviewState = {
  userId: string | null;
  score: HealthScoreData | null;
  loading: boolean;
  refreshing: boolean;
  error: boolean;
};

export function useHealthTreeOverview({ includeHealthScore = true }: { includeHealthScore?: boolean } = {}) {
  const userId = useAuthStore((state) => state.profile?.id) ?? null;
  const focused = useRef(false);
  const request = useRef(0);
  const calendarOwner = useRef<string | null>(null);
  const [state, setState] = useState<OverviewState>({
    userId: null,
    score: null,
    loading: true,
    refreshing: false,
    error: false,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(
    async (refreshing = false) => {
      if (!focused.current || !userId) return;
      const requestId = ++request.current;
      // The calendar loads itself on mount. Later visits and explicit refreshes
      // invalidate it immediately, independently of the health-score request.
      if (calendarOwner.current === userId) {
        setRefreshKey((value) => value + 1);
      }
      calendarOwner.current = userId;
      setState((previous) => {
        const score = previous.userId === userId ? previous.score : null;
        return {
          userId,
          score,
          loading: !score && !refreshing,
          refreshing,
          error: false,
        };
      });
      if (!includeHealthScore) {
        setState({ userId, score: null, loading: false, refreshing: false, error: false });
        return;
      }
      try {
        const score = await checkinApi.getHealthScore();
        if (focused.current && request.current === requestId) {
          setState({
            userId,
            score,
            loading: false,
            refreshing: false,
            error: false,
          });
        }
      } catch {
        if (focused.current && request.current === requestId) {
          setState((previous) => ({
            ...previous,
            loading: false,
            refreshing: false,
            error: true,
          }));
        }
      }
    },
    [userId, includeHealthScore]
  );

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void load();
      return () => {
        focused.current = false;
        request.current++;
      };
    }, [load])
  );

  const currentUser = state.userId === userId;
  return {
    score: currentUser ? state.score : null,
    loading: !currentUser || state.loading,
    refreshing: currentUser && state.refreshing,
    error: currentUser && state.error,
    refreshKey,
    refresh: () => load(true),
    retry: () => load(),
  };
}
