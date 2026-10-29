import { logError } from './logger';

const errorUtils = (globalThis as any).ErrorUtils;
if (errorUtils && typeof errorUtils.setGlobalHandler === 'function') {
  const previousHandler = typeof errorUtils.getGlobalHandler === 'function' ? errorUtils.getGlobalHandler() : undefined;
  errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    // Preserve Sentry/React Native's fatal classification and report only once.
    if (typeof previousHandler === 'function') previousHandler(error, isFatal);
    else logError(error, { fatal: isFatal });
  });
}
