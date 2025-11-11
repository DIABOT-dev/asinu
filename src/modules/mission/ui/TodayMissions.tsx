"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/interfaces/ui/components/atoms/Card";
import Button from "@/interfaces/ui/components/atoms/Button";
import { apiFetch, ApiError } from "@/lib/http";

type MissionItem = {
  mission_id: string;
  code: string;
  title: string;
  cluster: string;
  energy: number;
  max_per_day: number;
  status: "pending" | "done";
  completed_count: number;
};

type MissionSummary = {
  date: string;
  completed: number;
  total: number;
  energy_earned: number;
  energy_available: number;
};

type MissionsTodayResponse = {
  missions: MissionItem[];
  summary: MissionSummary;
};

type MissionCheckinResponse = {
  mission_id: string;
  added: number;
  status: "pending" | "done";
  today_summary: MissionSummary;
};

type ToastState = {
  id: number;
  message: string;
  variant: "success" | "error";
};

function isMissionFeatureEnabled() {
  const value = (process.env.NEXT_PUBLIC_FEATURE_MISSION || "").toLowerCase();
  return ["1", "true", "on", "yes"].includes(value);
}

export default function TodayMissions() {
  const missionFeatureEnabled = isMissionFeatureEnabled();
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [summary, setSummary] = useState<MissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, variant: ToastState["variant"]) => {
    const id = Date.now();
    setToast({ id, message, variant });
    const timer =
      typeof window !== "undefined" && typeof window.setTimeout === "function"
        ? window.setTimeout
        : setTimeout;
    timer(() => {
      setToast((current) => (current && current.id === id ? null : current));
    }, 2500);
  }, []);

  const fetchMissions = useCallback(async () => {
    if (!missionFeatureEnabled) return;
    try {
      setLoading(true);
      const data = await apiFetch<MissionsTodayResponse>("/api/missions/today", {
        cache: "no-store",
      });
      setMissions(data.missions);
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message || "Không thể tải nhiệm vụ."
          : "Không thể tải nhiệm vụ.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  const handleCheckin = useCallback(
    async (mission: MissionItem) => {
      setPending((state) => ({ ...state, [mission.mission_id]: true }));
      try {
        const data = await apiFetch<MissionCheckinResponse>("/api/missions/checkin", {
          method: "POST",
          body: JSON.stringify({ mission_id: mission.mission_id }),
        });
        if (data.added > 0) {
          showToast(`+${mission.energy} Energy – ${mission.title}`, "success");
        } else {
          showToast("Đã ghi nhận nhiệm vụ này.", "success");
        }
        setSummary(data.today_summary);
        await fetchMissions();
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message || "Không thể cập nhật nhiệm vụ."
            : "Không thể cập nhật nhiệm vụ.";
        showToast(message, "error");
      } finally {
        setPending((state) => {
          const clone = { ...state };
          delete clone[mission.mission_id];
          return clone;
        });
      }
    },
    [fetchMissions, showToast],
  );

  const summaryText = useMemo(() => {
    if (!summary) return "";
    return `Hoàn thành ${summary.completed}/${summary.total} • Energy ${summary.energy_earned}/${summary.energy_available}`;
  }, [summary]);

  if (!missionFeatureEnabled) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-[16px]">Today's Missions</p>
        {summary && <p className="text-sm text-muted">{summaryText}</p>}
      </div>

      <Card className="p-4 space-y-3 border border-primary-100 bg-primary-50">
        {loading && (
          <p className="text-sm text-muted animate-pulse">Đang tải nhiệm vụ hôm nay…</p>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">
            {error}
          </div>
        )}

        {!loading && missions.length === 0 && !error && (
          <p className="text-sm text-muted">Chưa có nhiệm vụ nào khả dụng.</p>
        )}

        <div className="space-y-3">
          {missions.map((mission) => {
            const isDone = mission.status === "done";
            const progressText =
              mission.max_per_day > 1
                ? `${Math.min(mission.completed_count, mission.max_per_day)}/${mission.max_per_day}`
                : isDone
                  ? "Đã xong"
                  : "Chưa hoàn thành";
            return (
              <div
                key={mission.mission_id}
                className="flex items-center justify-between rounded-xl bg-white p-3 border border-primary-100"
              >
                <div>
                  <p className="font-semibold text-sm">{mission.title}</p>
                  <p className="text-xs text-muted">
                    {progressText} · +{mission.energy} Energy
                  </p>
                </div>
                <Button
                  disabled={isDone || pending[mission.mission_id]}
                  onClick={() => handleCheckin(mission)}
                  className={`text-sm px-4 ${
                    isDone ? "bg-gray-200 text-gray-600 cursor-not-allowed" : ""
                  }`}
                >
                  {isDone ? "Đã xong" : pending[mission.mission_id] ? "Đang ghi…" : "Hoàn thành"}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg text-sm ${
            toast.variant === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </section>
  );
}
