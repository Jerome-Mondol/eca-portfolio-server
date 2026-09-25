import { redisGet, redisSet, redisDel } from "../config/redis.js";
export async function getCached(key) {
    try {
        const v = await redisGet(key);
        if (v)
            return JSON.parse(v);
    }
    catch { }
    return null;
}
export async function setCached(key, data, ttlSeconds = 30) {
    try {
        await redisSet(key, JSON.stringify(data), ttlSeconds);
    }
    catch { }
}
export async function delCached(key) {
    try {
        await redisDel(key);
    }
    catch { }
}
export async function delCachedPrefix(prefix) {
    // Upstash doesn't support SCAN easily via our wrapper, so we delete known keys per user
    // This is called with specific user keys, e.g., dashboard:userId, projects:userId etc.
}
export function dashboardCacheKey(userId) {
    return `dashboard:${userId}`;
}
export function listCacheKey(resource, userId) {
    return `list:${resource}:${userId}`;
}
