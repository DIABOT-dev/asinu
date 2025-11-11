export interface ApiSuccess<T> {
  ok: true;
  data: T;
  request_id: string;
}

export interface ApiErrorPayload {
  ok: false;
  code: string;
  message: string;
  request_id?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly requestId?: string;
  public readonly payload?: ApiErrorPayload;

  constructor(params: { code: string; message: string; status: number; requestId?: string; payload?: ApiErrorPayload }) {
    super(params.message);
    this.code = params.code;
    this.status = params.status;
    this.requestId = params.requestId;
    this.payload = params.payload;
  }
}

const JSON_CONTENT_TYPE = /application\/json/i;

export type HttpOptions = RequestInit;

async function parseJsonBody<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!JSON_CONTENT_TYPE.test(contentType)) {
    return null;
  }
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function buildInit(init?: HttpOptions): RequestInit {
  const headers = new Headers(init?.headers ?? undefined);
  if (!headers.has("Content-Type") && init?.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  return {
    ...init,
    headers,
    credentials: "include",
  };
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: HttpOptions): Promise<T> {
  const response = await fetch(input, buildInit(init));
  const body = await parseJsonBody<ApiSuccess<T> | ApiErrorPayload>(response);

  if (!response.ok || !body) {
    throw new ApiError({
      code: body && !body.ok ? body.code ?? "HTTP_ERROR" : "HTTP_ERROR",
      message:
        body && !body.ok && typeof body.message === "string"
          ? body.message
          : response.statusText || "Request failed",
      status: response.status,
      requestId: body?.request_id ?? response.headers.get("x-request-id") ?? undefined,
      payload: body && !body.ok ? body : undefined,
    });
  }

  if (!body.ok) {
    throw new ApiError({
      code: body.code || "HTTP_ERROR",
      message: body.message || "Request failed",
      status: response.status,
      requestId: body.request_id,
      payload: body,
    });
  }

  return body.data;
}
