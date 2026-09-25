import { achievementSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/achievementStore.js";
import { redisGet, redisSet, redisDel } from "../../config/redis.js";
import { clearDashboardCache } from "../dashboard/controller.js";
const cacheKey = (u) => `list:achievements:${u}`;
export async function list(req, res) { const k = cacheKey(req.user.sub); try {
    const c = await redisGet(k);
    if (c) {
        res.setHeader("X-Cache", "HIT");
        return res.json(JSON.parse(c));
    }
}
catch { } const data = await store.listAchievements(req.user.sub); const body = { data }; try {
    await redisSet(k, JSON.stringify(body), 30);
}
catch { } res.setHeader("X-Cache", "MISS"); res.json(body); }
export async function getOne(req, res) { const item = await store.getAchievement(req.params.id, req.user.sub); if (!item)
    return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function create(req, res) { const p = achievementSchema.safeParse(req.body); if (!p.success)
    return res.status(400).json({ message: zodErrorMessage(p.error) }); const item = await store.createAchievement(req.user.sub, p.data); try {
    await redisDel(cacheKey(req.user.sub));
    await clearDashboardCache(req.user.sub);
}
catch { } res.status(201).json({ data: item }); }
export async function update(req, res) { const p = achievementSchema.partial().safeParse(req.body); if (!p.success)
    return res.status(400).json({ message: zodErrorMessage(p.error) }); const item = await store.updateAchievement(req.params.id, req.user.sub, p.data); if (!item)
    return res.status(404).json({ message: "Not found" }); try {
    await redisDel(cacheKey(req.user.sub));
    await clearDashboardCache(req.user.sub);
}
catch { } res.json({ data: item }); }
export async function remove(req, res) { const ok = await store.deleteAchievement(req.params.id, req.user.sub); if (!ok)
    return res.status(404).json({ message: "Not found" }); try {
    await redisDel(cacheKey(req.user.sub));
    await clearDashboardCache(req.user.sub);
}
catch { } res.json({ message: "Deleted" }); }
