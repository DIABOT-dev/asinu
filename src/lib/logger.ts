type LogContext = Record<string, unknown>;

// TẮT TẠM THỜI - đặt lại thành true để bật log
const LOGGING_ENABLED = false;

export const logError = (error: unknown, context: LogContext = {}) => {
  // Ignore AbortError - it's expected when component unmounts or request is cancelled
  if (error instanceof Error && error.name === 'AbortError') {
    return;
  }
  if (__DEV__ && LOGGING_ENABLED) {

  }
  // hook for Sentry/Crashlytics in future
};

export const logWarn = (message: string, context: LogContext = {}) => {
  if (__DEV__ && LOGGING_ENABLED) {

  }
};
