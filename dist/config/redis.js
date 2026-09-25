import { Redis } from "ioredis";
import { env } from "./env.js";
// Upstash Redis — uses REDIS_URL (rediss://...). Falls back to in-memory if not set.
let redis = null;
const memStore = new Map();
export function getRedis() {
    if (!env.REDIS_URL || env.REDIS_URL.includes("YOUR_TOKEN") || env.REDIS_URL.includes("YOUR_HOST"))
        return null;
    if (!redis) {
        // Upstash requires TLS for rediss://
        redis = new Redis(env.REDIS_URL, {
            tls: env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
            maxRetriesPerRequest: 2,
            lazyConnect: true,
        });
        redis.on("error", (e) => console.error("[redis] error", e.message));
        redis.connect().catch((e) => console.warn("[redis] connect failed, using memory fallback", e.message));
    }
    return redis;
}
// Simple abstraction so service works with or without Upstash
export async function redisSet(key, value, ttlSeconds) {
    const r = getRedis();
    if (r && r.status === "ready") {
        if (ttlSeconds)
            await r.set(key, value, "EX", ttlSeconds);
        else
            await r.set(key, value);
        return;
    }
    // memory fallback
    memStore.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined });
}
export async function redisGet(key) {
    const r = getRedis();
    if (r && r.status === "ready") {
        return r.get(key);
    }
    const v = memStore.get(key);
    if (!v)
        return null;
    if (v.expiresAt && Date.now() > v.expiresAt) {
        memStore.delete(key);
        return null;
    }
    return v.value;
}
export async function redisDel(key) {
    const r = getRedis();
    if (r && r.status === "ready") {
        await r.del(key);
        return;
    }
    memStore.delete(key);
}
export async function redisIncrWithExpire(key, windowSeconds) {
    const r = getRedis();
    if (r && r.status === "ready") {
        const count = await r.incr(key);
        if (count === 1)
            await r.expire(key, windowSeconds);
        return count;
    }
    // memory fallback for rate limiting
    const now = Date.now();
    const entry = memStore.get(key);
    let count = 1;
    let expiresAt = now + windowSeconds * 1000;
    if (entry) {
        if (entry.expiresAt && now > entry.expiresAt) {
            count = 1;
        }
        else {
            count = Number(entry.value) + 1;
            expiresAt = entry.expiresAt ?? expiresAt;
        }
    }
    memStore.set(key, { value: String(count), expiresAt });
    return count;
}
