import { describe, expect, it } from "vitest";
import { resolveTreeLevel } from "@/modules/tree/service";

describe("resolveTreeLevel", () => {
  it("returns level 1 for zero points", () => {
    expect(resolveTreeLevel(0)).toBe(1);
  });

  it("bumps level when threshold reached", () => {
    expect(resolveTreeLevel(50)).toBeGreaterThanOrEqual(2);
    expect(resolveTreeLevel(2500)).toBe(10);
  });

  it("does not exceed max level", () => {
    expect(resolveTreeLevel(5000)).toBe(10);
  });
});
