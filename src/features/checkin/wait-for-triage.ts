type Processing = { ok: true; processing: true };

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw Object.assign(new Error('Check-in request cancelled'), { name: 'AbortError' });
}

function pause(signal?: AbortSignal) {
  checkAborted(signal);
  return new Promise<void>((resolve, reject) => {
    const done = () => { signal?.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(done, 1200);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(Object.assign(new Error('Check-in request cancelled'), { name: 'AbortError' }));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

// Poll the same request, not the next question. The server coalesces pending
// work and persists its accepted result before returning it.
export async function waitForTriage<T>(request: () => Promise<T | Processing>, signal?: AbortSignal): Promise<T> {
  for (;;) {
    checkAborted(signal);
    try {
      const result = await request();
      checkAborted(signal);
      if (!('processing' in (result as Processing)) || (result as Processing).processing !== true)
        return result as T;
    } catch (error: any) {
      checkAborted(signal);
      // A proxy/client time limit does not mean the AI operation has failed.
      // Auth, cancellation, conflict and content errors still reach the caller.
      if (error?.name !== 'RequestTimeoutError' && ![408, 502, 504, 522, 524].includes(error?.statusCode)) throw error;
    }
    await pause(signal);
  }
}
