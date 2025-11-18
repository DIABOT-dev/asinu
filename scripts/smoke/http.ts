import type { SmokeContext } from "./types";

type RequestOptions = RequestInit & {
  path: string;
};

export async function smokeFetch(ctx: SmokeContext, options: RequestOptions) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ctx.timeoutMs);
  try {
    const headers = new Headers(options.headers ?? {});
    headers.set("accept", "application/json");
    if (ctx.sessionId) {
      const cookie = headers.get("cookie");
      const sessionCookie = `asinu.sid=${ctx.sessionId}`;
      headers.set("cookie", cookie ? `${cookie}; ${sessionCookie}` : sessionCookie);
    }
    const resp = await fetch(
      options.path.startsWith("http") ? options.path : `${ctx.baseUrl}${options.path}`,
      {
        ...options,
        headers,
        signal: controller.signal,
      },
    );
    return resp;
  } finally {
    clearTimeout(timeout);
  }
}

export async function parseJson<T = any>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error("Empty response body");
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)} — body: ${text}`);
  }
}
