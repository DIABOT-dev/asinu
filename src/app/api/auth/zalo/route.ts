import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http/response";
import { setSession } from "@/infrastructure/auth/session";
import { recordLogin, upsertOAuthUser } from "@/modules/auth/userService";
import {
  attachStateCookie,
  buildRedirectTarget,
  clearStateCookie,
  createState,
  readStateCookie,
} from "@/modules/auth/oauth/state";

const ZALO_AUTH_URL = "https://oauth.zaloapp.com/v4/permission";
const ZALO_TOKEN_URL = "https://oauth.zaloapp.com/v4/access_token";
const ZALO_PROFILE_URL = "https://graph.zalo.me/v2.0/me";

function getZaloConfig() {
  const appId = process.env.ZALO_OAUTH_APP_ID;
  const appSecret = process.env.ZALO_OAUTH_APP_SECRET;
  return { appId, appSecret };
}

function resolveZaloRedirectUri(req: NextRequest) {
  if (process.env.ZALO_OAUTH_REDIRECT_URI) {
    return process.env.ZALO_OAUTH_REDIRECT_URI;
  }
  const url = new URL(req.url);
  url.pathname = "/api/auth/zalo";
  url.search = "";
  return url.toString();
}

function startZaloOAuth(req: NextRequest) {
  const { appId } = getZaloConfig();
  if (!appId) {
    return jsonError("INTERNAL_ERROR", {
      request: req,
      message: "Zalo OAuth chưa được cấu hình.",
    });
  }
  const redirectUri = resolveZaloRedirectUri(req);
  const state = createState();
  const params = new URLSearchParams({
    app_id: appId,
    redirect_uri: redirectUri,
    state,
  });
  const response = NextResponse.redirect(`${ZALO_AUTH_URL}?${params.toString()}`);
  attachStateCookie(response, "zalo", state);
  return response;
}

async function exchangeZaloCode(code: string, redirectUri: string) {
  const { appId, appSecret } = getZaloConfig();
  if (!appId || !appSecret) {
    throw new Error("ZALO_OAUTH_CONFIG_MISSING");
  }
  const params = new URLSearchParams({
    app_id: appId,
    app_secret: appSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const response = await fetch(ZALO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ZALO_TOKEN_EXCHANGE_FAILED: ${text}`);
  }
  return (await response.json()) as { access_token: string };
}

async function fetchZaloProfile(accessToken: string) {
  const url = new URL(ZALO_PROFILE_URL);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", "id,name,picture,phone");
  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ZALO_PROFILE_FAILED: ${text}`);
  }
  return (await response.json()) as {
    id: string;
    name?: string;
    phone?: string;
  };
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return startZaloOAuth(req);
  }
  const state = req.nextUrl.searchParams.get("state");
  const storedState = readStateCookie(req, "zalo");
  if (!state || !storedState || state !== storedState) {
    return jsonError("BAD_REQUEST", {
      request: req,
      message: "Zalo OAuth state không hợp lệ.",
    });
  }

  try {
    const redirectUri = resolveZaloRedirectUri(req);
    const token = await exchangeZaloCode(code, redirectUri);
    const profile = await fetchZaloProfile(token.access_token);
    if (!profile?.id) {
      throw new Error("ZALO_PROFILE_INCOMPLETE");
    }

    const user = await upsertOAuthUser({
      email: null,
      displayName: profile.name ?? `Zalo ${profile.id.slice(-4)}`,
      provider: "zalo",
      zaloId: profile.id,
    });
    await recordLogin(user.user_id, "zalo");

    const response = NextResponse.redirect(buildRedirectTarget(req, "/").toString());
    await setSession(response, user, {
      method: "zalo_oauth",
      user_agent: req.headers.get("user-agent") ?? null,
      ip: req.ip ?? null,
    });
    clearStateCookie(response, "zalo");
    return response;
  } catch (error) {
    console.error("[auth/zalo] failed", error);
    return jsonError("INTERNAL_ERROR", {
      request: req,
      message: "Không thể xác thực Zalo.",
    });
  }
}
