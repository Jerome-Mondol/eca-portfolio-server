import { Redis } from "ioredis";
import { env } from "./env.js";

// Upstash Redis — uses REDIS_URL (rediss://...). Falls back to in-memory if not set.
let redis: Redis | null = null;
const memStore = new Map<string, { value: string; expiresAt?: number }>();

export function getRedis(): Redis | null {
  if (!env.REDIS_URL || env.REDIS_URL.includes("YOUR_TOKEN") || env.REDIS_URL.includes("YOUR_HOST")) return null;
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      tls: env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false, // eager connect for instant cache HIT
      connectTimeout: 3000,
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 1000)),
    });
    redis.on("error", (e: any) => console.error("[redis] error", e.message));
    redis.on("ready", () => console.log("[redis] ready"));
    // eager connect, but don't block
    redis.connect().catch((e: any) => console.warn("[redis] connect failed, memory fallback", e.message));
  }
  return redis;
}

// eager warmup on import
if (env.REDIS_URL && !env.REDIS_URL.includes("YOUR_TOKEN")) {
  getRedis();
}

// Simple abstraction so service works with or without Upstash
export async function redisSet(key: string, value: string, ttlSeconds?: number) {
  const r = getRedis();
  if (r && r.status === "ready") {
    if (ttlSeconds) await r.set(key, value, "EX", ttlSeconds);
    else await r.set(key, value);
    return;
  }
  // memory fallback
  memStore.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined });
}

export async function redisGet(key: string): Promise<string | null> {
  const r = getRedis();
  if (r && r.status === "ready") {
    return r.get(key);
  }
  const v = memStore.get(key);
  if (!v) return null;
  if (v.expiresAt && Date.now() > v.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return v.value;
}

export async function redisDel(key: string) {
  const r = getRedis();
  if (r && r.status === "ready") {
    await r.del(key);
    return;
  }
  memStore.delete(key);
}

export async function redisIncrWithExpire(key: string, windowSeconds: number): Promise<number> {
  const r = getRedis();
  if (r && r.status === "ready") {
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, windowSeconds);
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
    } else {
      count = Number(entry.value) + 1;
      expiresAt = entry.expiresAt ?? expiresAt;
    }
  }
  memStore.set(key, { value: String(count), expiresAt });
  return count;
}
