/** Local demo only. These points never change a wallet or subscription. */
export const DEMO_GIFT_POINTS = [10, 20, 30, 50, 75, 100] as const;

export type DemoGiftReceipt = {
  id: string;
  day: string;
  box: number;
  points: number;
  openedAt: string;
};

export type DemoGiftDay =
  | { state: 'available'; day: string }
  | { state: 'opened'; day: string; receipt: DemoGiftReceipt }
  | { state: 'skipped'; day: string };

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

// Vietnam has a fixed UTC+7 offset, independent of the device timezone.
export function vietnamGiftDay(now: number): string {
  return new Date(now + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function createCheckinGiftDemo(
  storage: Storage,
  now = Date.now,
  random = Math.random,
) {
  const pending = new Map<string, Promise<unknown>>();
  const keyFor = (account: string) => {
    if (!account.trim()) { throw new Error('A gift requires a signed-in account'); }
    return `asinu:checkin-gift-demo:v1:${encodeURIComponent(account)}`;
  };

  // Serialize reads and claims across every launcher for the same account.
  const exclusive = async <T>(account: string, work: (key: string) => Promise<T>): Promise<T> => {
    const key = keyFor(account);
    const task = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(() => work(key));
    pending.set(key, task);
    try { return await task; } finally {
      if (pending.get(key) === task) { pending.delete(key); }
    }
  };

  const readDay = async (key: string, day: string): Promise<DemoGiftDay> => {
    const raw = await storage.getItem(key);
    if (!raw) { return { state: 'available', day }; }
    const saved = JSON.parse(raw);
    // Fail closed on damaged storage instead of silently granting a second turn.
    if (saved.version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(saved.day) ||
      !['opened', 'skipped'].includes(saved.state)) {
      throw new Error('Invalid demo gift record');
    }
    if (saved.state === 'opened') {
      const receipt = saved.receipt as DemoGiftReceipt | undefined;
      if (!receipt || typeof receipt.id !== 'string' || receipt.day !== saved.day ||
        !Number.isInteger(receipt.box) || receipt.box < 0 || receipt.box > 5 ||
        !DEMO_GIFT_POINTS.some(points => points === receipt.points) ||
        typeof receipt.openedAt !== 'string' || !Number.isFinite(Date.parse(receipt.openedAt))) {
        throw new Error('Invalid demo gift receipt');
      }
    }
    // A backwards clock change cannot reopen an already consumed day.
    if (saved.day < day) { return { state: 'available', day }; }
    return saved.state === 'opened'
      ? { state: 'opened', day: saved.day, receipt: saved.receipt }
      : { state: 'skipped', day: saved.day };
  };

  return {
    today: (account: string) => exclusive(account, key => readDay(key, vietnamGiftDay(now()))),
    open: (account: string, box: number) => exclusive(account, async key => {
      if (!Number.isInteger(box) || box < 0 || box > 5) { throw new Error('Invalid gift box'); }
      const timestamp = now();
      const day = vietnamGiftDay(timestamp);
      const current = await readDay(key, day);
      // Retrying or pressing a different box returns the original receipt.
      if (current.state === 'opened') { return current.receipt; }
      if (current.state === 'skipped') { throw new Error('Today\'s demo gift was skipped'); }
      const roll = random();
      if (!Number.isFinite(roll) || roll < 0 || roll >= 1) { throw new Error('Invalid gift draw'); }
      const receipt: DemoGiftReceipt = {
        id: `demo:${encodeURIComponent(account)}:${day}`,
        day,
        box,
        points: DEMO_GIFT_POINTS[Math.floor(roll * DEMO_GIFT_POINTS.length)],
        openedAt: new Date(timestamp).toISOString(),
      };
      await storage.setItem(key, JSON.stringify({ version: 1, state: 'opened', day, receipt }));
      return receipt;
    }),
    skip: (account: string) => exclusive(account, async key => {
      const day = vietnamGiftDay(now());
      const current = await readDay(key, day);
      if (current.state !== 'available') { return; }
      await storage.setItem(key, JSON.stringify({ version: 1, state: 'skipped', day }));
    }),
  };
}
