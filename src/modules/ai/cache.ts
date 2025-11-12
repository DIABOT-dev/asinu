// src/modules/ai/cache.ts — SHA1 hashing, in-memory cache with TTL, daily token tracking
import { createHash } from 'crypto';

type CacheItem = {
  value: string;
  expiresAt: number; // Unix timestamp in ms
};

// In-memory cache for current session
const inMemoryCache = new Map<string, CacheItem>();

// Daily token budget tracking (in-memory for current session)
const dailyTokenUsage = new Map<string, { tokens: number; lastReset: number }>();
const DAILY_RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

export async function getCache(key: string): Promise<string | undefined> {
  const hit = inMemoryCache.get(key);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.value;
  }
  inMemoryCache.delete(key); // Remove expired entry
  return undefined;
}

export async function setCache(key: string, val: string, ttlMin: number): Promise<void> {
  const expiresAt = Date.now() + ttlMin * 60 * 1000;
  inMemoryCache.set(key, { value: val, expiresAt });

  // TODO: For persistent caching, integrate with Postgres table "ai_cache"
  // Graceful degradation - no crash if table doesn't exist
}

export function addDailyTokenUsage(userId: string, tokens: number): void {
  const now = Date.now();
  let userEntry = dailyTokenUsage.get(userId);

  if (!userEntry || (now - userEntry.lastReset) > DAILY_RESET_INTERVAL_MS) {
    userEntry = { tokens: 0, lastReset: now };
  }
  userEntry.tokens += tokens;
  dailyTokenUsage.set(userId, userEntry);
}

export function getDailyTokenUsage(userId: string): number {
  const now = Date.now();
  const userEntry = dailyTokenUsage.get(userId);
  if (!userEntry || (now - userEntry.lastReset) > DAILY_RESET_INTERVAL_MS) {
    return 0;
  }
  return userEntry.tokens;
}
