import { requireSession } from "../context";
import { smokeFetch, parseJson } from "../http";
import type { SmokeContext, SmokeResult } from "../types";

type DonateResponse = {
  ok: boolean;
  data?: { provider: string; amount_points: number; amount_vnd: number };
};

export async function runDonateSmoke(ctx: SmokeContext): Promise<SmokeResult> {
  requireSession(ctx, "Donate");

  const body = {
    provider: process.env.SMOKE_DONATE_PROVIDER || "smoke",
    amount_points: ctx.allowWrites ? Number(process.env.SMOKE_DONATE_POINTS || 0) : 0,
    amount_vnd: ctx.allowWrites ? Number(process.env.SMOKE_DONATE_VND || 10000) : 0,
    campaign: process.env.SMOKE_DONATE_CAMPAIGN,
  };

  if (body.amount_points <= 0 && body.amount_vnd <= 0) {
    return {
      id: "D-Donate",
      name: "Donate API",
      status: "skip",
      details: "Writes disabled; donate test skipped.",
    };
  }

  const res = await smokeFetch(ctx, {
    path: "/api/donate",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 404) {
    return {
      id: "D-Donate",
      name: "Donate API",
      status: "skip",
      details: "DONATION_ENABLED flag is off.",
    };
  }

  if (res.status === 409) {
    return {
      id: "D-Donate",
      name: "Donate API",
      status: "skip",
      details: "Insufficient points for donation (409).",
    };
  }

  if (!res.ok) {
    return {
      id: "D-Donate",
      name: "Donate API",
      status: "fail",
      error: new Error(`Donate endpoint failed (${res.status}).`),
    };
  }

  const donateBody = (await parseJson(res)) as DonateResponse;
  if (!donateBody.ok || !donateBody.data) {
    return {
      id: "D-Donate",
      name: "Donate API",
      status: "fail",
      error: new Error("Unexpected donate payload."),
    };
  }

  return {
    id: "D-Donate",
    name: "Donate API",
    status: "pass",
    details: `provider=${donateBody.data.provider}, points=${donateBody.data.amount_points}, vnd=${donateBody.data.amount_vnd}`,
  };
}
