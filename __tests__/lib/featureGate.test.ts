import { describe, beforeEach, it, expect } from "vitest";
import { featureGate } from "@/lib/middleware/featureGate";
import { resetFeatureFlagCache } from "../../config/feature-flags";

describe("featureGate", () => {
  beforeEach(() => {
    delete process.env.RELATIVE_ENABLED;
    resetFeatureFlagCache();
  });

  it("returns 404 response when RELATIVE_ENABLED is false", () => {
    process.env.RELATIVE_ENABLED = "false";
    resetFeatureFlagCache();
    const res = featureGate("RELATIVE_ENABLED");
    expect(res?.status).toBe(404);
  });

  it("passes through when RELATIVE_ENABLED is true", () => {
    process.env.RELATIVE_ENABLED = "true";
    resetFeatureFlagCache();
    const res = featureGate("RELATIVE_ENABLED");
    expect(res).toBeNull();
  });
});
