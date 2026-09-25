import { redisGet, redisSet, redisDel } from "../config/redis.js";

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const v = await redisGet(key);
    if (v) return JSON.parse(v) as T;
  } catch {}
  return null;
}

export async function setCached(key: string, data: any, ttlSeconds = 30): Promise<void> {
  try {
    await redisSet(key, JSON.stringify(data), ttlSeconds);
  } catch {}
}

export async function delCached(key: string): Promise<void> {
  try {
    await redisDel(key);
  } catch {}
}

export async function delCachedPrefix(prefix: string): Promise<void> {
  // Upstash doesn't support SCAN easily via our wrapper, so we delete known keys per user
  // This is called with specific user keys, e.g., dashboard:userId, projects:userId etc.
}

export function dashboardCacheKey(userId: string) {
  return `dashboard:${userId}`;
}
export function listCacheKey(resource: string, userId: string) {
  return `list:${resource}:${userId}`;
}
