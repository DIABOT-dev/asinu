import type { SmokeContext, SmokeResult } from "../types";

export async function runBridgeSmoke(_: SmokeContext): Promise<SmokeResult> {
  const url = process.env.BRIDGE_URL;
  const key = process.env.BRIDGE_KEY;

  if (!url || !key) {
    return {
      id: "E",
      name: "Dia Brain Bridge",
      status: "skip",
      details: "BRIDGE_URL/BRIDGE_KEY not configured in this environment.",
    };
  }

  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error("Bridge URL must be http(s).");
    }
  } catch (error) {
    return {
      id: "E",
      name: "Dia Brain Bridge",
      status: "fail",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  return {
    id: "E",
    name: "Dia Brain Bridge",
    status: "pass",
    details: "Bridge URL/key detected; runtime events will emit.",
  };
}
