import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/callback",
  "/privacy",
  "/terms",
  "/medical-disclaimer",
  "/about",
  "/api/qa/selftest",
  "/healthz",
]);

const STATIC_PREFIXES = [
  "/_next",
  "/static",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/icon.png",
  "/apple-icon.png",
  "/assets",
];

const PROTECTED_PREFIXES = ["/dashboard", "/data", "/profile", "/settings", "/chart", "/learn"];

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "asinu.sid";
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function requiresAuth(pathname: string) {
  if (pathname === "/") return true;
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isDevBypass(req: NextRequest) {
  if (process.env.AUTH_DEV_MODE !== "true") return false;
  const host = req.headers.get("host") || "";
  return host.includes("localhost") || host.startsWith("127.0.0.1");
}

function hasLikelySessionCookie(req: NextRequest) {
  const value = req.cookies.get(SESSION_COOKIE_NAME)?.value ?? "";
  return SESSION_ID_PATTERN.test(value);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname) || !requiresAuth(pathname) || isDevBypass(req)) {
    return NextResponse.next();
  }

  if (!hasLikelySessionCookie(req)) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/data/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/chart/:path*",
    "/learn/:path*",
  ],
};
