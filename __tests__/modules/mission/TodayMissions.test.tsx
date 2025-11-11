import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TodayMissions from "@/modules/mission/ui/TodayMissions";

vi.mock("@/lib/http", () => {
  class ApiError extends Error {
    status = 400;
  }
  return {
    apiFetch: vi.fn(),
    ApiError,
  };
});

import { apiFetch } from "@/lib/http";

const apiFetchMock = apiFetch as unknown as Mock;

describe("TodayMissions UI", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FEATURE_MISSION = "true";
    apiFetchMock.mockReset();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_FEATURE_MISSION;
  });

  it("renders missions and handles check-in updates", async () => {
    const todaySummary = {
      date: "2025-10-07",
      completed: 0,
      total: 3,
      energy_earned: 0,
      energy_available: 15,
    };
    apiFetchMock
      .mockResolvedValueOnce({
        missions: [
          {
            mission_id: "mission-water",
            code: "water",
            title: "Drink 6 glasses of water",
            cluster: "body",
            energy: 4,
            max_per_day: 3,
            status: "pending",
            completed_count: 0,
          },
        ],
        summary: todaySummary,
      })
      .mockResolvedValueOnce({
        mission_id: "mission-water",
        added: 1,
        status: "done",
        today_summary: { ...todaySummary, completed: 1, energy_earned: 4 },
      })
      .mockResolvedValueOnce({
        missions: [
          {
            mission_id: "mission-water",
            code: "water",
            title: "Drink 6 glasses of water",
            cluster: "body",
            energy: 4,
            max_per_day: 3,
            status: "done",
            completed_count: 3,
          },
        ],
        summary: { ...todaySummary, completed: 1, energy_earned: 4 },
      });

    render(<TodayMissions />);

    expect(await screen.findByText("Drink 6 glasses of water")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(3);
    });

    expect(await screen.findByText("Đã xong")).toBeInTheDocument();
  });
});
