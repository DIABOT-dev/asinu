import { describe, expect, it } from "vitest";
import type { MissionProgress } from "@/modules/mission/types";
import {
  determineMissionStatus,
  isDuplicateCheckin,
  summarizeMissions,
} from "@/modules/mission/utils";

describe("mission utils", () => {
  it("determines mission status based on max per day", () => {
    expect(determineMissionStatus(0, 1)).toBe("pending");
    expect(determineMissionStatus(1, 1)).toBe("done");
    expect(determineMissionStatus(2, 3)).toBe("pending");
    expect(determineMissionStatus(3, 3)).toBe("done");
  });

  it("detects duplicate check-ins within the window", () => {
    const now = new Date("2025-10-07T10:00:00Z");
    const recent = new Date(now.getTime() - 20 * 1000);
    const older = new Date(now.getTime() - 60 * 1000);

    expect(isDuplicateCheckin(recent, now)).toBe(true);
    expect(isDuplicateCheckin(older, now)).toBe(false);
    expect(isDuplicateCheckin(null, now)).toBe(false);
  });

  it("summarizes missions with energy stats", () => {
    const missions: MissionProgress[] = [
      {
        mission_id: "1",
        code: "water",
        title: "Drink water",
        cluster: "body",
        energy: 4,
        max_per_day: 3,
        status: "done",
        completed_count: 3,
        completed_at: new Date().toISOString(),
      },
      {
        mission_id: "2",
        code: "walk",
        title: "Walk",
        cluster: "move",
        energy: 6,
        max_per_day: 1,
        status: "pending",
        completed_count: 0,
        completed_at: null,
      },
    ];

    const summary = summarizeMissions(missions, "2025-10-07");
    expect(summary.completed).toBe(1);
    expect(summary.total).toBe(2);
    expect(summary.energy_earned).toBe(4);
    expect(summary.energy_available).toBe(10);
  });
});
