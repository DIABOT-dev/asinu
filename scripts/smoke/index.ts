#!/usr/bin/env tsx
import { createSmokeContext } from "./context";
import { runAuthSmoke } from "./tests/auth";
import { runMissionSmoke } from "./tests/missions";
import { runRewardsSmoke } from "./tests/rewards";
import { runDonateSmoke } from "./tests/donate";
import { runBridgeSmoke } from "./tests/bridge";
import { runHealthSmoke } from "./tests/health";
import type { SmokeResult, SmokeTest } from "./types";

const tests: SmokeTest[] = [
  { id: "A", name: "Auth & session", run: runAuthSmoke },
  { id: "B", name: "Mission Lite", run: runMissionSmoke },
  { id: "D", name: "Rewards + Donate", run: runRewardsSmoke },
  { id: "D-Donate", name: "Donate API", run: runDonateSmoke },
  { id: "E", name: "Dia Brain Bridge", run: runBridgeSmoke },
  { id: "F", name: "Healthz", run: runHealthSmoke },
];

function logResult(result: SmokeResult) {
  const statusLabel =
    result.status === "pass"
      ? "PASS"
      : result.status === "skip"
        ? "SKIP"
        : "FAIL";
  const detail =
    result.status === "fail"
      ? result.error.message
      : result.details ?? "";
  console.log(`[${statusLabel}] ${result.id} ${result.name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const ctx = createSmokeContext();
  console.log("Smoke base URL:", ctx.baseUrl);
  console.log("Writes enabled:", ctx.allowWrites ? "yes" : "no");
  if (!ctx.sessionId) {
    console.warn("Warning: ASINU_SMOKE_SESSION not set. Authenticated tests will fail.");
  }

  const results: SmokeResult[] = [];

  for (const test of tests) {
    try {
      const result = await test.run(ctx);
      logResult(result);
      results.push(result);
    } catch (error) {
      const failure: SmokeResult = {
        id: test.id,
        name: test.name,
        status: "fail",
        error: error instanceof Error ? error : new Error(String(error)),
      };
      logResult(failure);
      results.push(failure);
    }
  }

  const failed = results.filter((r) => r.status === "fail");
  if (failed.length > 0) {
    console.error(`\nSmoke run failed (${failed.length} test${failed.length === 1 ? "" : "s"}).`);
    process.exit(1);
  }

  console.log("\nSmoke run complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Smoke harness crashed:", error);
  process.exit(1);
});
