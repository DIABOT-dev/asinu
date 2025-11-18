import { requireSession } from "../context";
import { smokeFetch, parseJson } from "../http";
import type { SmokeContext, SmokeResult } from "../types";

export async function runAuthSmoke(ctx: SmokeContext): Promise<SmokeResult> {
  requireSession(ctx, "Auth & Session");

  const response = await smokeFetch(ctx, { path: "/api/auth/session" });
  if (response.status === 404) {
    return {
      id: "A",
      name: "Auth & session",
      status: "fail",
      error: new Error("/api/auth/session not found (router misconfigured?)"),
    };
  }

  if (response.status === 401) {
    return {
      id: "A",
      name: "Auth & session",
      status: "fail",
      error: new Error("Session rejected (401). Provide a fresh asinu.sid cookie."),
    };
  }

  const body = await parseJson(response);
  if (!body.ok || !body.data?.user_id) {
    return {
      id: "A",
      name: "Auth & session",
      status: "fail",
      error: new Error("Unexpected payload from /api/auth/session"),
    };
  }

  return {
    id: "A",
    name: "Auth & session",
    status: "pass",
    details: `user ${body.data.user_id}`,
  };
}
