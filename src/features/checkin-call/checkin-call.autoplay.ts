export type CallAutoplayScope = { accountId: string; episodeId: string; attemptId: string };

type Receipt = { episodeId: string; attemptId: string; prompts: string[] };
type ReceiptStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
const MAX_ATTEMPTS = 128;

/** Persist before playing. No transcript, health data or voice revision is saved:
 * reopening, changing language or changing the narrator must not restart speech. */
export class CheckinCallAutoplay {
  private readonly writes = new Map<string, Promise<void>>();

  constructor(private readonly storage: ReceiptStorage) {}

  claim(scope: CallAutoplayScope, prompt: string): Promise<boolean> {
    if (!scope.accountId || !scope.episodeId || !scope.attemptId || !prompt) return Promise.resolve(false);
    const key = '@asinu/checkin-call-autoplay:v1:' + encodeURIComponent(scope.accountId);
    // A shared instance serializes competing screens, and different prompts in
    // the same call, so a late write cannot erase another prompt's receipt.
    const work = (this.writes.get(key) ?? Promise.resolve()).then(async () => {
      try {
        const raw = await this.storage.getItem(key);
        const parsed: unknown = raw === null ? [] : JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.some(item => !item || typeof item.episodeId !== 'string'
          || typeof item.attemptId !== 'string' || !Array.isArray(item.prompts)
          || item.prompts.some((value: unknown) => typeof value !== 'string'))) return false;
        const receipts: Receipt[] = parsed;
        const previous = receipts.find(item => item.episodeId === scope.episodeId && item.attemptId === scope.attemptId);
        if (previous?.prompts.includes(prompt)) return false;
        const next = receipts.filter(item => item !== previous);
        next.push({ episodeId: scope.episodeId, attemptId: scope.attemptId, prompts: [...(previous?.prompts ?? []), prompt] });
        await this.storage.setItem(key, JSON.stringify(next.slice(-MAX_ATTEMPTS)));
        return true;
      } catch {
        // Fail closed for automatic speech. Explicit Replay remains usable
        // even when device storage is unavailable, with no automatic retries.
        return false;
      }
    });
    const pending = work.then(() => {});
    this.writes.set(key, pending);
    void pending.then(() => { if (this.writes.get(key) === pending) this.writes.delete(key); });
    return work;
  }
}
