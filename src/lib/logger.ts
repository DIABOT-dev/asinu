type LogContext = Record<string, unknown>;

export const logError = (error: unknown, context: LogContext = {}) => {
  if (__DEV__) {
    console.error('[logger]', context, error);
  }
  // hook for Sentry/Crashlytics in future
};

export const logWarn = (message: string, context: LogContext = {}) => {
  if (__DEV__) {
    console.warn('[logger]', message, context);
  }
};
