import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
const Application = requireOptionalNativeModule<{ applicationId?: string; nativeBuildVersion?: string }>("ExpoApplication");
import {
  createRequestMonitor,
  guardEnvelope,
  sanitizeEvent,
  type TechnicalTags,
} from "./privacy";

const config = {
  service: "asinu-mobile",
  environment:
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ||
    (process.env.EXPO_PUBLIC_APP_ENV === "prod"
      ? "production"
      : process.env.EXPO_PUBLIC_APP_ENV === "dev"
      ? "development"
      : process.env.EXPO_PUBLIC_APP_ENV || "development"),
  release:
    process.env.EXPO_PUBLIC_SENTRY_RELEASE ||
    (Application?.nativeBuildVersion
      ? Application?.applicationId +
        "@" +
        Constants.expoConfig?.version +
        "+" +
        Application?.nativeBuildVersion
      : undefined),
};
let initialized = false;
const reported = new WeakSet<Error>();

export function initErrorMonitoring(): boolean {
  if (initialized) return true;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || process.env.EXPO_PUBLIC_SENTRY_ENABLED === "false") return false;
  try {
    Sentry.init({
      dsn,
      environment: config.environment,
      release: config.release,
      sendDefaultPii: false,
      maxBreadcrumbs: 0,
      sendClientReports: false,
      tracesSampleRate: 0,
      enableLogs: false,
      enableAutoPerformanceTracing: false,
      enableCaptureFailedRequests: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableAutoSessionTracking: false,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      enableNativeNagger: false,
      beforeBreadcrumb: () => null,
      beforeSend: (event, hint) => {
        hint.attachments = [];
        return sanitizeEvent(event, config) as typeof event | null;
      },
      beforeSendTransaction: () => null,
    });
    Sentry.getClient()?.on("beforeEnvelope", guardEnvelope);
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export function reportError(error: unknown, tags: TechnicalTags = {}): void {
  const info = error as { status?: number; statusCode?: number } | null;
  const status = Number(tags.status_code ?? info?.status ?? info?.statusCode);
  if (status >= 400 && status < 500) return;
  if (
    error instanceof Error &&
    (error.name === "AbortError" || reported.has(error))
  )
    return;
  if (!initialized && !initErrorMonitoring()) return;
  try {
    if (error instanceof Error) reported.add(error);
    Sentry.withScope((scope) => {
      scope.setTags({
        ...tags,
        ...(status >= 100 && status <= 599 ? { status_code: status } : {}),
      });
      Sentry.captureException(
        error instanceof Error
          ? error
          : new Error("Handled application failure")
      );
    });
  } catch {
    /* Monitoring must not affect the application. */
  }
}
export const observeApiRequest = createRequestMonitor(reportError);

/** Observe failures without altering requests, retries, authentication or responses. */
export async function monitoredFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method || "GET";
  observeApiRequest(url, method);
  try {
    const response = await fetch(url, options);
    if (response.status >= 500) {
      const error = new Error("HTTP server response failed");
      error.name = "HttpResponseError";
      reportError(error, {
        component: "api",
        method,
        route: url,
        status_code: response.status,
      });
    }
    return response;
  } catch (error) {
    reportError(error, {
      component: "api",
      operation: "transport",
      method,
      route: url,
    });
    throw error;
  }
}
export function markTelemetryHandled(error: unknown): void {
  if (error instanceof Error) reported.add(error);
}
