import type { SmokeContext } from "./types";

function readSessionId(): string | undefined {
  return (
    process.env.ASINU_SMOKE_SESSION ||
    process.env.SMOKE_SESSION ||
    process.env.SESSION_ID ||
    undefined
  );
}

export function createSmokeContext(): SmokeContext {
  const defaultPort = process.env.SMOKE_PORT || process.env.PORT || "3000";
  const baseUrl = process.env.SMOKE_BASE_URL || `http://localhost:${defaultPort}`;
  const allowWrites = process.env.SMOKE_ALLOW_WRITES === "1";
  const timeoutMs = Number(process.env.SMOKE_FETCH_TIMEOUT || 15000);

  return {
    baseUrl,
    sessionId: readSessionId(),
    allowWrites,
    timeoutMs,
  };
}

export function requireSession(ctx: SmokeContext, testName: string) {
  if (!ctx.sessionId) {
    throw new Error(
      `[${testName}] Missing session cookie. Export ASINU_SMOKE_SESSION=<asinu.sid> before running npm run smoke.`,
    );
  }
}
