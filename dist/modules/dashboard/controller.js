import { getPool } from "../../config/db.js";
import { redisGet, redisSet, redisDel } from "../../config/redis.js";
export function dashboardCacheKey(userId) {
    return `dashboard:${userId}`;
}
export async function clearDashboardCache(userId) {
    try {
        await redisDel(dashboardCacheKey(userId));
    }
    catch { }
}
export async function getSummary(req, res) {
    const userId = req.user.sub;
    const cacheKey = dashboardCacheKey(userId);
    // Try Redis cache first — serve in <10ms if hit
    try {
        const cached = await redisGet(cacheKey);
        if (cached) {
            res.setHeader("X-Cache", "HIT");
            res.setHeader("Cache-Control", "public, max-age=30");
            return res.json(JSON.parse(cached));
        }
    }
    catch { }
    const pool = getPool();
    let data = {
        projects: 0,
        certificates: 0,
        activities: 0,
        courses: 0,
        experiences: 0,
        achievements: 0,
        skills: 0,
        documents: 0,
        featured: 0,
        profile: null,
        completion: 0,
    };
    if (pool) {
        try {
            // Parallel count queries — single round-trip per table, all in parallel
            const [proj, cert, act, course, exp, ach, skill, doc, prof] = await Promise.all([
                pool.query("SELECT COUNT(*) as c, COUNT(*) FILTER (WHERE featured) as f FROM projects WHERE user_id=$1", [userId]),
                pool.query("SELECT COUNT(*) as c FROM certificates WHERE user_id=$1", [userId]),
                pool.query("SELECT COUNT(*) as c FROM activities WHERE user_id=$1", [userId]),
                pool.query("SELECT COUNT(*) as c FROM courses WHERE user_id=$1", [userId]),
                pool.query("SELECT COUNT(*) as c FROM experiences WHERE user_id=$1", [userId]),
                pool.query("SELECT COUNT(*) as c FROM achievements WHERE user_id=$1", [userId]),
                pool.query("SELECT COUNT(*) as c FROM skills WHERE user_id=$1", [userId]),
                pool.query("SELECT COUNT(*) as c FROM documents WHERE user_id=$1", [userId]),
                pool.query("SELECT headline, bio, location, avatar_key FROM profiles WHERE user_id=$1", [userId]),
            ]);
            const profileDone = !!(prof.rows[0]?.headline || prof.rows[0]?.bio || prof.rows[0]?.location);
            const hasPhoto = !!prof.rows[0]?.avatar_key;
            const counts = {
                projects: parseInt(proj.rows[0]?.c ?? "0", 10),
                featured: parseInt(proj.rows[0]?.f ?? "0", 10),
                certificates: parseInt(cert.rows[0]?.c ?? "0", 10),
                activities: parseInt(act.rows[0]?.c ?? "0", 10),
                courses: parseInt(course.rows[0]?.c ?? "0", 10),
                experiences: parseInt(exp.rows[0]?.c ?? "0", 10),
                achievements: parseInt(ach.rows[0]?.c ?? "0", 10),
                skills: parseInt(skill.rows[0]?.c ?? "0", 10),
                documents: parseInt(doc.rows[0]?.c ?? "0", 10),
            };
            const steps = [profileDone, counts.projects > 0, counts.certificates > 0, counts.activities > 0, counts.courses > 0, hasPhoto];
            const completion = Math.round((steps.filter(Boolean).length / steps.length) * 100);
            data = {
                ...counts,
                profile: prof.rows[0] || null,
                profileDone,
                hasPhoto,
                completion,
            };
        }
        catch (e) {
            console.error("[dashboard] query failed", e);
        }
    }
    else {
        // Memory fallback — count from stores (not implemented, return zeros, completion 0)
        // For memory mode, we still want fast response — no DB, so instant
        data.completion = 0;
    }
    // Cache for 30s in Upstash (or memory fallback)
    try {
        await redisSet(cacheKey, JSON.stringify(data), 30);
    }
    catch { }
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json(data);
}
