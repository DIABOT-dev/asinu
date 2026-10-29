import { logError } from './logger';

const errorUtils = (globalThis as any).ErrorUtils;
if (errorUtils && typeof errorUtils.setGlobalHandler === 'function') {
  const previousHandler = typeof errorUtils.getGlobalHandler === 'function' ? errorUtils.getGlobalHandler() : undefined;
  errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    logError(error, { fatal: isFatal });
    if (typeof previousHandler === 'function') previousHandler(error, isFatal);
  });
}
