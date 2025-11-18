import { smokeFetch, parseJson } from "../http";
import type { SmokeContext, SmokeResult } from "../types";

type HealthResponse = {
  status: string;
  checks?: {
    database?: { status: string };
  };
};

export async function runHealthSmoke(ctx: SmokeContext): Promise<SmokeResult> {
  const res = await smokeFetch(ctx, { path: "/api/healthz" });
  if (!res.ok && res.status !== 503) {
    return {
      id: "F",
      name: "Healthz",
      status: "fail",
      error: new Error(`Healthz returned ${res.status}`),
    };
  }

  const body = (await parseJson(res)) as HealthResponse;
  if (!body || !body.status) {
    return {
      id: "F",
      name: "Healthz",
      status: "fail",
      error: new Error("Invalid health payload."),
    };
  }

  if (res.status === 503) {
    return {
      id: "F",
      name: "Healthz",
      status: "fail",
      error: new Error(`Healthz marked service as ${body.status}`),
    };
  }

  return {
    id: "F",
    name: "Healthz",
    status: "pass",
    details: `overall=${body.status}, db=${body.checks?.database?.status ?? "unknown"}`,
  };
}
