import { getPool } from "../config/db.js";
import { redisSet, redisGet, redisDel } from "../config/redis.js";
const memTokens = new Map();
function useDb() {
    return !!getPool();
}
export async function saveRefreshToken(jti, userId, expiresAt) {
    if (useDb()) {
        await getPool().query("INSERT INTO refresh_tokens(jti, user_id, expires_at) VALUES($1,$2,$3)", [jti, userId, expiresAt]);
    }
    else {
        memTokens.set(jti, { jti, userId, expiresAt });
    }
    // also cache in redis for fast lookup (optional)
    await redisSet(`refresh:${jti}`, JSON.stringify({ userId, expiresAt: expiresAt.toISOString() }), Math.floor((expiresAt.getTime() - Date.now()) / 1000));
}
export async function findRefreshToken(jti) {
    // check redis denylist first
    const denylist = await redisGet(`denylist:${jti}`);
    if (denylist)
        return null; // revoked
    if (useDb()) {
        const r = await getPool().query("SELECT jti, user_id, expires_at, revoked_at, replaced_by FROM refresh_tokens WHERE jti = $1", [jti]);
        if (!r.rows[0])
            return null;
        const row = r.rows[0];
        if (row.revoked_at)
            return null;
        if (new Date(row.expires_at) < new Date())
            return null;
        return { jti: row.jti, userId: row.user_id, expiresAt: new Date(row.expires_at), revokedAt: row.revoked_at ? new Date(row.revoked_at) : undefined, replacedBy: row.replaced_by };
    }
    const t = memTokens.get(jti) ?? null;
    if (!t)
        return null;
    if (t.revokedAt)
        return null;
    if (t.expiresAt < new Date()) {
        memTokens.delete(jti);
        return null;
    }
    return t;
}
export async function revokeRefreshToken(jti, replacedBy) {
    if (useDb()) {
        await getPool().query("UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $2 WHERE jti = $1", [jti, replacedBy ?? null]);
    }
    else {
        const t = memTokens.get(jti);
        if (t) {
            t.revokedAt = new Date();
            t.replacedBy = replacedBy;
        }
    }
    // denylist in redis for quick check until expiry
    await redisSet(`denylist:${jti}`, "1", 7 * 24 * 60 * 60);
    await redisDel(`refresh:${jti}`);
}
export async function revokeAllForUser(userId) {
    if (useDb()) {
        await getPool().query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
    }
    else {
        for (const [jti, t] of memTokens) {
            if (t.userId === userId && !t.revokedAt)
                t.revokedAt = new Date();
        }
    }
    // we don't have per-user redis keys to bulk delete; rotation will handle
}
