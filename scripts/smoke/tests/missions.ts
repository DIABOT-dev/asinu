import { requireSession } from "../context";
import { smokeFetch, parseJson } from "../http";
import type { SmokeContext, SmokeResult } from "../types";

type MissionTodayResponse = {
  ok: boolean;
  data: {
    missions: Array<{ mission_id: string; status: string; title: string }>;
    summary: { completed: number; total: number };
  };
};

export async function runMissionSmoke(ctx: SmokeContext): Promise<SmokeResult> {
  requireSession(ctx, "Mission Lite");

  const todayRes = await smokeFetch(ctx, { path: "/api/missions/today" });
  if (todayRes.status === 404) {
    return {
      id: "B",
      name: "Mission Lite",
      status: "skip",
      details: "FEATURE_MISSION disabled (404).",
    };
  }
  if (todayRes.status === 401) {
    return {
      id: "B",
      name: "Mission Lite",
      status: "fail",
      error: new Error("Mission API rejected the provided session."),
    };
  }

  const todayBody = (await parseJson(todayRes)) as MissionTodayResponse;
  if (!todayBody.ok || !Array.isArray(todayBody.data?.missions)) {
    return {
      id: "B",
      name: "Mission Lite",
      status: "fail",
      error: new Error("Unexpected payload from /api/missions/today"),
    };
  }

  const total = todayBody.data.missions.length;
  const pending = todayBody.data.missions.filter((m) => m.status !== "done");

  if (!total) {
    return {
      id: "B",
      name: "Mission Lite",
      status: "fail",
      error: new Error("No missions returned for today."),
    };
  }

  if (!ctx.allowWrites || pending.length === 0) {
    return {
      id: "B",
      name: "Mission Lite",
      status: "pass",
      details: `missions returned=${total}, pending=${pending.length} (writes disabled)`,
    };
  }

  const target = pending[0];
  const checkinRes = await smokeFetch(ctx, {
    path: "/api/missions/checkin",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mission_id: target.mission_id }),
  });

  if (checkinRes.status === 409) {
    return {
      id: "B",
      name: "Mission Lite",
      status: "skip",
      details: "Mission already completed for today (409).",
    };
  }

  const checkinBody = await parseJson(checkinRes);
  if (!checkinRes.ok || !checkinBody.ok) {
    return {
      id: "B",
      name: "Mission Lite",
      status: "fail",
      error: new Error(`Mission check-in failed (${checkinRes.status}).`),
    };
  }

  return {
    id: "B",
    name: "Mission Lite",
    status: "pass",
    details: `Checked in ${target.title}`,
  };
}
