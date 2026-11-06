/**
 * Error telemetry only. Keep this policy identical across web and mobile clients.
 * Never send request data, user profiles, exception messages or console content.
 */
export type TelemetryConfig = {
  service: string;
  environment: string;
  release?: string;
};
export type TechnicalTags = Record<string, string | number | undefined>;
type Value = Record<string, unknown>;
const object = (value: unknown): Value =>
  value && typeof value === "object" ? (value as Value) : {};
const technical = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.:+-]{0,100}$/.test(value)
    ? value
    : undefined;
export const validRelease = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.:@+-]{0,159}$/.test(value)
    ? value
    : undefined;
const vocabulary = new Set(
  "api v1 v2 mobile doctor crm crm-auth auth login logout refresh me session sessions settings profile accounts notifications preferences audit tasks conversations messages patients care-circle connections invitations checkin checkins check-in checkin-call calls status active health health-records logs metrics dashboard overview reports subscriptions entitlement gifts rewards gift open coupons users doctors tenants admin ai clinical-ai documents rules consent attachments files upload download export import events voice transcribe otp verify reset password password-reset authorize oauth callback google apple facebook zalo sos alerts checkin-gifts heartbeat integrations websocket current history knowledge consent revoke link token devices search analytics appointments payments iap store rate doctor-tasks specialty specialties queue channels".split(
    " "
  )
);
/** A fixed vocabulary prevents names, phone numbers, UUIDs and query strings leaving the client. */
export function apiRoute(path: string): string {
  const raw = (path.split(/[?#]/, 1)[0] || "").replace(
    /^https?:\/\/[^/]+/i,
    ""
  );
  return (
    "/" +
    raw
      .split("/")
      .filter(Boolean)
      .slice(0, 12)
      .map((segment) => (vocabulary.has(segment) ? segment : ":id"))
      .join("/")
  );
}
function artifact(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.split(/[?#]/, 1)[0] || "";
  if (/^https?:\/\//.test(clean)) {
    try {
      const url = new URL(clean);
      if (
        !/^\/(?:_next\/static|assets)\//.test(url.pathname) ||
        !/\.(?:m?js|map)$/.test(url.pathname)
      )
        return undefined;
      return url.origin + url.pathname;
    } catch {
      return undefined;
    }
  }
  const parts = clean.replace(/\\/g, "/").split("/").filter(Boolean).slice(-4);
  return parts.length &&
    parts.every((part) => /^[A-Za-z0-9_.-]{1,160}$/.test(part))
    ? parts.join("/")
    : undefined;
}
function frame(input: unknown): Value {
  const source = object(input);
  const result: Value = {};
  for (const key of ["filename", "abs_path"]) {
    const value = artifact(source[key]);
    if (value) result[key] = value;
  }
  if (
    typeof source.function === "string" &&
    /^[A-Za-z0-9_.$<> [\]/:+-]{1,160}$/.test(source.function)
  )
    result.function = source.function;
  for (const key of ["lineno", "colno"])
    if (Number.isInteger(source[key])) result[key] = source[key];
  for (const key of ["instruction_addr", "image_addr", "symbol_addr"])
    if (
      typeof source[key] === "string" &&
      /^0x[0-9a-f]+$/i.test(source[key] as string)
    )
      result[key] = source[key];
  if (typeof source.in_app === "boolean") result.in_app = source.in_app;
  if (technical(source.platform)) result.platform = source.platform;
  return result;
}
export function sanitizeEvent(
  input: unknown,
  config: TelemetryConfig
): Value | null {
  const event = object(input);
  if (event.type && event.type !== "error") return null;
  const tags: Value = { service: config.service };
  const sourceTags = object(event.tags);
  for (const key of [
    "component",
    "operation",
    "error_code",
    "job",
    "queue",
    "platform",
    "method",
  ]) {
    const raw = sourceTags[key];
    const value =
      key === "error_code"
        ? typeof raw === "string" &&
          /^(?:[A-Z][A-Z_]{2,39}|[0-9A-Z]{5})$/.test(raw)
          ? raw
          : undefined
        : technical(raw);
    if (value) tags[key] = value;
  }
  if (typeof sourceTags.route === "string")
    tags.route = apiRoute(sourceTags.route);
  const status = Number(sourceTags.status_code);
  if (Number.isInteger(status) && status >= 100 && status <= 599)
    tags.status_code = String(status);
  const result: Value = {
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: technical(event.platform) || "javascript",
    level: event.level,
    environment: config.environment,
    release: validRelease(config.release),
    tags,
    fingerprint: [
      config.service,
      "{{ default }}",
      ...(tags.route
        ? [
            String(tags.method || "GET"),
            String(tags.route),
            String(tags.status_code || "unknown"),
          ]
        : []),
    ],
  };
  const values = object(event.exception).values;
  if (Array.isArray(values) && values.length)
    result.exception = {
      values: values.slice(0, 5).map((item) => {
        const exception = object(item);
        const type =
          typeof exception.type === "string" &&
          /^[A-Za-z][A-Za-z0-9_.$:+-]{0,100}$/.test(exception.type)
            ? exception.type
            : "Error";
        const trace = object(exception.stacktrace);
        const mechanism = object(exception.mechanism);
        return {
          type,
          value: tags.error_code ? type + ": " + tags.error_code : type,
          ...(Array.isArray(trace.frames)
            ? { stacktrace: { frames: trace.frames.slice(-80).map(frame) } }
            : {}),
          ...(typeof mechanism.handled === "boolean"
            ? {
                mechanism: {
                  type: technical(mechanism.type) || "generic",
                  handled: mechanism.handled,
                },
              }
            : {}),
        };
      }),
    };
  else result.message = "Application error (details withheld)";
  const images = object(event.debug_meta).images;
  if (Array.isArray(images)) {
    const cleaned = images
      .map((image) => {
        const item = object(image);
        const output: Value = {};
        for (const key of ["debug_id", "code_id", "uuid"])
          if (
            typeof item[key] === "string" &&
            /^[0-9a-f-]{8,80}$/i.test(item[key] as string)
          )
            output[key] = item[key];
        for (const key of ["code_file", "debug_file"]) {
          const value = artifact(item[key]);
          if (value) output[key] = value;
        }
        if (technical(item.type)) output.type = item.type;
        if (
          typeof item.image_addr === "string" &&
          /^0x[0-9a-f]+$/i.test(item.image_addr)
        )
          output.image_addr = item.image_addr;
        if (Number.isSafeInteger(item.image_size))
          output.image_size = item.image_size;
        return output;
      })
      .filter((image) => image.debug_id || image.uuid);
    if (cleaned.length) result.debug_meta = { images: cleaned };
  }
  return result;
}
/** Source map IDs are retained; attachments, logs, replay and trace payloads are not. */
export function guardEnvelope(envelope: unknown): void {
  if (!Array.isArray(envelope) || !Array.isArray(envelope[1])) return;
  delete object(envelope[0]).trace;
  const items = envelope[1] as unknown[][];
  for (let index = items.length - 1; index >= 0; index--)
    if (object(items[index]?.[0]).type !== "event") items.splice(index, 1);
}
export function createRequestMonitor(
  report: (error: Error, tags: TechnicalTags) => void
) {
  const counts = new Map<
    string,
    { start: number; count: number; reported: number }
  >();
  return (path: string, method = "GET") => {
    const route = apiRoute(path);
    const safeMethod = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(method)
      ? method
      : "GET";
    const key = safeMethod + " " + route;
    const now = Date.now();
    let state = counts.get(key);
    if (!state) {
      if (counts.size >= 100) counts.delete(counts.keys().next().value!);
      state = { start: now, count: 0, reported: -Infinity };
      counts.set(key, state);
    }
    if (now - state.start >= 10_000) {
      state.start = now;
      state.count = 0;
    }
    state.count++;
    if (state.count > 50 && now - state.reported >= 60_000) {
      state.reported = now;
      const error = new Error("Excessive API request frequency");
      error.name = "ExcessiveApiRequestsError";
      try {
        report(error, {
          component: "api",
          operation: "request_frequency",
          method: safeMethod,
          route,
        });
      } catch {
        /* Telemetry never interrupts a request. */
      }
    }
  };
}
