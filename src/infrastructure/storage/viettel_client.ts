import * as Stream from "stream";

const { Readable } = Stream;

const HEADER_PROVIDER = "x-dia-storage-provider";
const HEADER_ENDPOINT = "x-dia-storage-endpoint";
const HEADER_PROXY = "x-dia-storage-proxy";

const PROVIDER_NAME = "viettel";
const PROXY_NAME = "dia-brain";

type NodeReadableLike = NodeJS.ReadableStream & {
  readonly readable?: boolean;
  read?: (...args: any[]) => unknown;
  pipe?: (...args: any[]) => unknown;
};

export type StorageBody =
  | Buffer
  | NodeJS.ReadableStream
  | ReadableStream
  | ArrayBuffer
  | Uint8Array
  | string
  | Blob
  | FormData;

export interface ProxyRequestOptions {
  bucket: string;
  key: string;
  method: "PUT" | "GET" | "DELETE";
  body?: StorageBody;
  contentType?: string;
}

function isNodeReadableStream(body: StorageBody): body is NodeReadableLike {
  if (!body || typeof body !== "object") {
    return false;
  }
  const candidate = body as Partial<NodeReadableLike>;
  return typeof candidate.read === "function" || typeof candidate.pipe === "function";
}

function normalizeBody(body?: StorageBody): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (typeof body === "string") {
    return body;
  }

  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return body;
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return body;
  }

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(body)) {
    return Uint8Array.from(body);
  }

  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }

  if (typeof Uint8Array !== "undefined" && body instanceof Uint8Array) {
    return new Uint8Array(body);
  }

  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    return body;
  }

  if (isNodeReadableStream(body)) {
    if (typeof Readable?.toWeb === "function") {
      return Readable.toWeb(body as any) as unknown as BodyInit;
    }
    return body as unknown as BodyInit;
  }

  return body as BodyInit;
}

function resolveProxyBase(): string {
  const proxyBase = process.env.DIA_BRAIN_STORAGE_PROXY_URL;
  if (!proxyBase || proxyBase.trim().length === 0) {
    throw new Error("DIA_BRAIN_STORAGE_PROXY_URL is not configured");
  }
  return proxyBase.replace(/\/$/, "");
}

function buildProxyUrl(bucket: string, key: string): string {
  const trimmedBase = resolveProxyBase();
  const encodedBucket = encodeURIComponent(bucket);
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${trimmedBase}/storage/${encodedBucket}/${encodedKey}`;
}

async function proxyRequest({ bucket, key, method, body, contentType }: ProxyRequestOptions): Promise<Response> {
  const url = buildProxyUrl(bucket, key);
  const headers = new Headers({
    [HEADER_PROVIDER]: PROVIDER_NAME,
    [HEADER_PROXY]: PROXY_NAME,
  });

  const endpoint = process.env.VTS_ENDPOINT;
  if (endpoint) {
    headers.set(HEADER_ENDPOINT, endpoint);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: normalizeBody(body),
  });

  if (!response.ok) {
    let detail: string | undefined;
    try {
      detail = await response.text();
    } catch (_error) {
      detail = undefined;
    }

    const suffix = detail && detail.trim().length > 0 ? ` - ${detail.trim()}` : "";
    throw new Error(`Failed to ${method} object ${bucket}/${key}: ${response.status} ${response.statusText}${suffix}`);
  }

  return response;
}

export async function putObject(bucket: string, key: string, body: StorageBody, contentType?: string): Promise<void> {
  await proxyRequest({ bucket, key, method: "PUT", body, contentType });
}

export async function getObject(bucket: string, key: string): Promise<Response> {
  return proxyRequest({ bucket, key, method: "GET" });
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await proxyRequest({ bucket, key, method: "DELETE" });
}

export function buildMealObjectKey(params: { userId: string; capturedAt: Date; objectId: string; extension: string }): string {
  const year = params.capturedAt.getUTCFullYear();
  const month = String(params.capturedAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(params.capturedAt.getUTCDate()).padStart(2, "0");
  const ext = params.extension.replace(/^\./, "");
  return `meal/${params.userId}/${year}/${month}/${day}/${params.objectId}.${ext}`;
}

export function buildAvatarObjectKey(userId: string, extension: string): string {
  const ext = extension.replace(/^\./, "");
  return `avatars/${userId}.${ext}`;
}

export function buildReportObjectKey(params: { userId: string; reportType: string; periodEnd: string }): string {
  return `reports/${params.userId}/${params.reportType}_${params.periodEnd}.pdf`;
}

export const defaultViettelBuckets = {
  public: process.env.VTS_PUBLIC_BUCKET ?? "",
  private: process.env.VTS_PRIVATE_BUCKET ?? "",
};

// TODO: Implement signed upload/download URL helpers (24h TTL) using DIA BRAIN proxy when gateway spec is finalized.
