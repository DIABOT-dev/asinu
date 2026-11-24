import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { ApiError } from '../../lib/apiClient';
import { useAuthStore } from '../auth/auth.store';
import { planAssistantActions, replayAssistantReadCache, type AssistantPlan, type AssistantRequest } from './app-assistant.api';
import { assistantReadCacheStorage, type AssistantReadCache } from './assistant-read-cache.storage';

// Keep this canonical contract in sync with the backend fingerprint helper.
export const canonicalAssistantReadRequest = (request: AssistantRequest) => JSON.stringify({
  text: request.text.trim(),
  current: { language: request.current.language, fontSize: request.current.fontSize },
  hiddenArticles: [...new Set(request.hiddenArticles || [])].sort(),
  allowCuratedArticles: request.allowCuratedArticles !== false,
});

type Session = { owner: string; token: string } | null;
type Dependencies = {
  session: () => Session;
  hash: (value: string) => Promise<string>;
  storage: typeof assistantReadCacheStorage;
  plan: typeof planAssistantActions;
  replay: typeof replayAssistantReadCache;
};
function cancelled(): Error { return Object.assign(new Error('Assistant request cancelled'), { name: 'AbortError' }); }

export function createAssistantReadCachePlanner(deps: Dependencies) {
  return async (request: AssistantRequest, signal: AbortSignal): Promise<AssistantPlan> => {
    const session = deps.session();
    const current = () => !signal.aborted && !!session && deps.session()?.owner === session.owner && deps.session()?.token === session.token;
    if (signal.aborted) {throw cancelled();}
    if (!session || request.clarification) {return deps.plan(request, signal);}
    let key: string;
    try { key = await deps.hash(canonicalAssistantReadRequest(request)); }
    catch { if (!current()) {throw cancelled();} return deps.plan(request, signal); }
    if (!current()) {throw cancelled();}
    const cached = await deps.storage.get(session.owner, key, current);
    if (!current()) {throw cancelled();}
    if (cached) {
      try {
        const response = await deps.replay(cached.token, request, signal);
        if (!current()) {throw cancelled();}
        if (response.status !== 'answer' || response.actions.length) {throw new Error('Invalid cached read response');}
        return response;
      } catch (reason) {
        if (!current()) {throw cancelled();}
        if (reason instanceof ApiError && reason.statusCode === 409 && reason.code === 'APP_ASSISTANT_READ_CACHE_MISS') {
          await deps.storage.remove(session.owner, key);
        } else {
          if (reason instanceof ApiError && [401, 403].includes(reason.statusCode)) {await deps.storage.remove(session.owner, key);}
          throw reason;
        }
      }
    }
    if (!current()) {throw cancelled();}
    const response = await deps.plan(request, signal);
    if (!current()) {throw cancelled();}
    const entry: AssistantReadCache | undefined = response.readCache;
    if (response.status === 'answer' && response.actions.length === 0 && entry?.key === key)
      {await deps.storage.set(session.owner, entry, current);}
    if (!current()) {throw cancelled();}
    return response;
  };
}

export const planAssistantWithReadCache = createAssistantReadCachePlanner({
  session: () => {
    const { profile, token } = useAuthStore.getState();
    return profile?.id && token ? { owner: String(profile.id), token } : null;
  },
  hash: value => digestStringAsync(CryptoDigestAlgorithm.SHA256, value),
  storage: assistantReadCacheStorage,
  plan: planAssistantActions,
  replay: replayAssistantReadCache,
});
