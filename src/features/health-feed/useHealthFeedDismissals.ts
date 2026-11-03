import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo } from "react";
import { apiClient } from "../../lib/apiClient";
import { useAuthStore } from "../auth/auth.store";
import { createFeedDismissals, EMPTY_FEED_DISMISSALS } from "./feed-dismissals";

const useDismissals = createFeedDismissals({
  storage: AsyncStorage,
  request: (id, token) =>
    apiClient(`/api/health-feed/feed/${encodeURIComponent(id)}/dismiss`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
  session: () => {
    const auth = useAuthStore.getState();
    return { userId: auth.profile?.id, token: auth.token };
  },
});

export function useHealthFeedDismissals() {
  const profileId = useAuthStore((state) => state.profile?.id);
  const token = useAuthStore((state) => state.token);
  const userId = profileId ? String(profileId) : "";
  const record = useDismissals(
    (state) => state.users[userId] || EMPTY_FEED_DISMISSALS,
  );
  useEffect(() => {
    if (userId) void useDismissals.getState().hydrate(userId);
  }, [userId]);
  const dismiss = useCallback(
    (id: string | number) =>
      useDismissals.getState().dismiss(userId, token, id),
    [userId, token],
  );
  const hiddenIds = useMemo(
    () => new Set(record.hiddenIds),
    [record.hiddenIds],
  );
  return {
    dismiss,
    hiddenIds,
    pendingIds: record.pendingIds,
    hydrated: record.loaded,
    canShowCurated: record.loaded && !record.hasDismissedServerItem,
  };
}
