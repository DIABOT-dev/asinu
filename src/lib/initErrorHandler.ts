import { logError } from './logger';

const errorUtils = (globalThis as any).ErrorUtils;
if (errorUtils && typeof errorUtils.setGlobalHandler === 'function') {
  errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    logError(error, { fatal: isFatal });
  });
}
