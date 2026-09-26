import { redisGet, redisSet, redisDel } from "../config/redis.js";
/** How long a list is served as fresh. */
const FRESH_MS = 60_000;
/** How long a list may still be served while it is refreshed in the background. */
const STALE_MS = 300_000;
/**
 * Process-local tier. A repeat request for the same user is answered from here
 * without touching Redis or Postgres, which is what makes a second navigation
 * to a list page feel instant.
 */
const mem = new Map();
export function listCacheKey(scope, userId) {
    return `list:${scope}:${userId}`;
}
function remember(key, data) {
    const now = Date.now();
    mem.set(key, { data, expires: now + FRESH_MS });
    mem.set(`${key}:stale`, { data, expires: now + STALE_MS });
}
async function refresh(key, load) {
    try {
        const body = { data: await load() };
        remember(key, body);
        await redisSet(key, JSON.stringify(body), FRESH_MS / 1000);
        await redisSet(`${key}:stale`, JSON.stringify(body), STALE_MS / 1000);
    }
    catch {
        /* keep serving the stale copy */
    }
}
/** Drop a user's cached list on every tier. Call after any write to that list. */
export function clearListCache(scope, userId) {
    const key = listCacheKey(scope, userId);
    mem.delete(key);
    mem.delete(`${key}:stale`);
    void redisDel(key).catch(() => { });
    void redisDel(`${key}:stale`).catch(() => { });
}
/**
 * Three-tier read-through for a per-user list: memory → Redis → database, with
 * stale-while-revalidate in both fast tiers.
 */
export async function sendCachedList(res, scope, userId, load) {
    const key = listCacheKey(scope, userId);
    // This payload is per-user and was requested with an Authorization header.
    // `public` would let a shared cache (CDN or reverse proxy) store it and hand
    // it to the next visitor, so it must be private.
    res.setHeader("Cache-Control", "private, no-store");
    const fresh = mem.get(key);
    if (fresh && Date.now() < fresh.expires) {
        res.setHeader("X-Cache", "HIT-MEM");
        return res.json(fresh.data);
    }
    const staleMem = mem.get(`${key}:stale`);
    if (staleMem && Date.now() < staleMem.expires) {
        res.setHeader("X-Cache", "STALE-MEM");
        setImmediate(() => void refresh(key, load));
        return res.json(staleMem.data);
    }
    try {
        const raw = await redisGet(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            remember(key, parsed);
            res.setHeader("X-Cache", "HIT");
            return res.json(parsed);
        }
        const rawStale = await redisGet(`${key}:stale`);
        if (rawStale) {
            const parsed = JSON.parse(rawStale);
            mem.set(`${key}:stale`, { data: parsed, expires: Date.now() + STALE_MS });
            res.setHeader("X-Cache", "STALE");
            setImmediate(() => void refresh(key, load));
            return res.json(parsed);
        }
    }
    catch {
        /* Redis is best-effort; fall through to the database. */
    }
    const body = { data: await load() };
    remember(key, body);
    try {
        await redisSet(key, JSON.stringify(body), FRESH_MS / 1000);
        await redisSet(`${key}:stale`, JSON.stringify(body), STALE_MS / 1000);
    }
    catch {
        /* memory tier already holds it */
    }
    res.setHeader("X-Cache", "MISS");
    return res.json(body);
}
