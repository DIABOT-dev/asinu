import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http/response";
import { setSession } from "@/infrastructure/auth/session";
import { upsertOAuthUser, recordLogin } from "@/modules/auth/userService";
import {
  attachStateCookie,
  buildRedirectTarget,
  clearStateCookie,
  createState,
  readStateCookie,
} from "@/modules/auth/oauth/state";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  return { clientId, clientSecret };
}

function resolveRedirectUri(req: NextRequest) {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }
  const url = new URL(req.url);
  url.pathname = "/api/auth/google";
  url.search = "";
  return url.toString();
}

async function exchangeCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getGoogleConfig();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CONFIG_MISSING");
  }
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GOOGLE_TOKEN_EXCHANGE_FAILED: ${text}`);
  }
  return (await response.json()) as { access_token: string };
}

async function fetchProfile(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GOOGLE_PROFILE_FAILED: ${text}`);
  }
  return (await response.json()) as {
    sub: string;
    email?: string;
    name?: string;
    given_name?: string;
  };
}

function startGoogleAuth(req: NextRequest) {
  const { clientId } = getGoogleConfig();
  if (!clientId) {
    return jsonError("INTERNAL_ERROR", {
      request: req,
      message: "Google OAuth chưa được cấu hình.",
    });
  }
  const redirectUri = resolveRedirectUri(req);
  const state = createState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  attachStateCookie(response, "google", state);
  return response;
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return startGoogleAuth(req);
  }
  const state = req.nextUrl.searchParams.get("state");
  const storedState = readStateCookie(req, "google");
  if (!state || !storedState || state !== storedState) {
    return jsonError("BAD_REQUEST", {
      request: req,
      message: "Google OAuth state không hợp lệ.",
    });
  }

  try {
    const redirectUri = resolveRedirectUri(req);
    const token = await exchangeCode(code, redirectUri);
    const profile = await fetchProfile(token.access_token);
    if (!profile?.sub) {
      throw new Error("GOOGLE_PROFILE_INCOMPLETE");
    }

    const user = await upsertOAuthUser({
      email: profile.email ?? null,
      displayName: profile.name ?? profile.given_name ?? profile.email ?? null,
      provider: "google",
      googleSub: profile.sub,
    });
    await recordLogin(user.user_id, "google");

    const response = NextResponse.redirect(buildRedirectTarget(req, "/").toString());
    await setSession(response, user, {
      method: "google_oauth",
      user_agent: req.headers.get("user-agent") ?? null,
      ip: req.ip ?? null,
    });
    clearStateCookie(response, "google");
    return response;
  } catch (error) {
    console.error("[auth/google] failed", error);
    return jsonError("INTERNAL_ERROR", {
      request: req,
      message: "Không thể xác thực Google.",
    });
  }
}
