import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { getPool } from "../../config/db.js";
import { redisGet, redisSet, redisDel } from "../../config/redis.js";

// In-memory cache for ultra-fast (<1ms) second hit before Redis
const memCache = new Map<string, { data: any; expires: number }>();

export function dashboardCacheKey(userId: string) {
  return `dashboard:${userId}`;
}
export async function clearDashboardCache(userId: string) {
  memCache.delete(dashboardCacheKey(userId));
  memCache.delete(`${dashboardCacheKey(userId)}:stale`);
  try {
    await redisDel(dashboardCacheKey(userId));
    await redisDel(`${dashboardCacheKey(userId)}:stale`);
  } catch {}
}

async function fetchFreshData(userId: string) {
  const pool = getPool();
  let data: any = {
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
    // Single round-trip to Neon — 8 counts + profile in one query (was 9 parallel)
    const r = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM projects WHERE user_id=$1) as projects,
        (SELECT COUNT(*) FROM projects WHERE user_id=$1 AND featured) as featured,
        (SELECT COUNT(*) FROM certificates WHERE user_id=$1) as certificates,
        (SELECT COUNT(*) FROM activities WHERE user_id=$1) as activities,
        (SELECT COUNT(*) FROM courses WHERE user_id=$1) as courses,
        (SELECT COUNT(*) FROM experiences WHERE user_id=$1) as experiences,
        (SELECT COUNT(*) FROM achievements WHERE user_id=$1) as achievements,
        (SELECT COUNT(*) FROM skills WHERE user_id=$1) as skills,
        (SELECT COUNT(*) FROM documents WHERE user_id=$1) as documents,
        (SELECT row_to_json(p) FROM (SELECT headline, bio, location, avatar_key FROM profiles WHERE user_id=$1) p) as profile`,
      [userId]
    );
    const row = r.rows[0];
    const profile = row.profile;
    const profileDone = !!(profile?.headline || profile?.bio || profile?.location);
    const hasPhoto = !!profile?.avatar_key;
    const counts = {
      projects: parseInt(row.projects ?? "0", 10),
      featured: parseInt(row.featured ?? "0", 10),
      certificates: parseInt(row.certificates ?? "0", 10),
      activities: parseInt(row.activities ?? "0", 10),
      courses: parseInt(row.courses ?? "0", 10),
      experiences: parseInt(row.experiences ?? "0", 10),
      achievements: parseInt(row.achievements ?? "0", 10),
      skills: parseInt(row.skills ?? "0", 10),
      documents: parseInt(row.documents ?? "0", 10),
    };
    const steps = [profileDone, counts.projects > 0, counts.certificates > 0, counts.activities > 0, counts.courses > 0, hasPhoto];
    const completion = Math.round((steps.filter(Boolean).length / steps.length) * 100);
    data = { ...counts, profile, profileDone, hasPhoto, completion };
  }
  return data;
}

export async function getSummary(req: AuthedRequest, res: Response) {
  const userId = req.user!.sub;
  const cacheKey = dashboardCacheKey(userId);

  // 1. In-memory ( <1ms ) -> 2. Redis ( <10ms ) -> 3. DB (single query)
  const mem = memCache.get(cacheKey);
  if (mem && Date.now() < mem.expires) {
    res.setHeader("X-Cache", "HIT-MEM");
    res.setHeader("Cache-Control", "private, no-store");
    return res.json(mem.data);
  }
  // Check stale in-mem
  const memStale = memCache.get(`${cacheKey}:stale`);
  if (mem && memStale && Date.now() < memStale.expires) {
    res.setHeader("X-Cache", "STALE-MEM");
    setImmediate(async () => {
      try {
        const fresh = await fetchFreshData(userId);
        memCache.set(cacheKey, { data: fresh, expires: Date.now() + 60_000 });
        memCache.set(`${cacheKey}:stale`, { data: fresh, expires: Date.now() + 300_000 });
        await redisSet(cacheKey, JSON.stringify(fresh), 60);
        await redisSet(`${cacheKey}:stale`, JSON.stringify(fresh), 300);
      } catch {}
    });
    return res.json(memStale.data);
  }

  try {
    const cached = await redisGet(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      memCache.set(cacheKey, { data: parsed, expires: Date.now() + 60_000 });
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", "private, no-store");
      return res.json(parsed);
    }
    const stale = await redisGet(`${cacheKey}:stale`);
    if (stale) {
      const parsed = JSON.parse(stale);
      memCache.set(`${cacheKey}:stale`, { data: parsed, expires: Date.now() + 300_000 });
      res.setHeader("X-Cache", "STALE");
      res.setHeader("Cache-Control", "private, no-store");
      setImmediate(async () => {
        try {
          const fresh = await fetchFreshData(userId);
          memCache.set(cacheKey, { data: fresh, expires: Date.now() + 60_000 });
          memCache.set(`${cacheKey}:stale`, { data: fresh, expires: Date.now() + 300_000 });
          await redisSet(cacheKey, JSON.stringify(fresh), 60);
          await redisSet(`${cacheKey}:stale`, JSON.stringify(fresh), 300);
        } catch {}
      });
      return res.json(parsed);
    }
  } catch {}

  const data = await fetchFreshData(userId);

  // Cache both mem (<1ms) and Redis
  memCache.set(cacheKey, { data, expires: Date.now() + 60_000 });
  memCache.set(`${cacheKey}:stale`, { data, expires: Date.now() + 300_000 });
  try {
    await redisSet(cacheKey, JSON.stringify(data), 60);
    await redisSet(`${cacheKey}:stale`, JSON.stringify(data), 300);
  } catch {}

  res.setHeader("X-Cache", "MISS");
  res.setHeader("Cache-Control", "private, no-store");
  res.json(data);
}
