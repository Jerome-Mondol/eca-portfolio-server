import { projectSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/projectStore.js";
import { redisGet, redisSet, redisDel } from "../../config/redis.js";
import { clearDashboardCache } from "../dashboard/controller.js";
const cacheKey = (userId) => `list:projects:${userId}`;
export async function list(req, res) {
    const userId = req.user.sub;
    const key = cacheKey(userId);
    try {
        const cached = await redisGet(key);
        if (cached) {
            res.setHeader("X-Cache", "HIT");
            res.setHeader("Cache-Control", "public, max-age=60");
            return res.json(JSON.parse(cached));
        }
    }
    catch { }
    const data = await store.listProjects(userId);
    const body = { data };
    try {
        await redisSet(key, JSON.stringify(body), 60);
    }
    catch { }
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(body);
}
export async function getOne(req, res) {
    const item = await store.getProject(req.params.id, req.user.sub);
    if (!item)
        return res.status(404).json({ message: "Not found" });
    res.json({ data: item });
}
export async function create(req, res) {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: zodErrorMessage(parsed.error) });
    const item = await store.createProject(req.user.sub, parsed.data);
    try {
        await redisDel(cacheKey(req.user.sub));
        await clearDashboardCache(req.user.sub);
    }
    catch { }
    res.status(201).json({ data: item });
}
export async function update(req, res) {
    const parsed = projectSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: zodErrorMessage(parsed.error) });
    const item = await store.updateProject(req.params.id, req.user.sub, parsed.data);
    if (!item)
        return res.status(404).json({ message: "Not found" });
    try {
        await redisDel(cacheKey(req.user.sub));
        await clearDashboardCache(req.user.sub);
    }
    catch { }
    res.json({ data: item });
}
export async function remove(req, res) {
    const ok = await store.deleteProject(req.params.id, req.user.sub);
    if (!ok)
        return res.status(404).json({ message: "Not found" });
    try {
        await redisDel(cacheKey(req.user.sub));
        await clearDashboardCache(req.user.sub);
    }
    catch { }
    res.json({ message: "Deleted" });
}
