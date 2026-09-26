import { achievementSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/achievementStore.js";
import { sendCachedList, clearListCache } from "../../utils/listCache.js";
import { clearDashboardCache } from "../dashboard/controller.js";
const scope = "achievements";
export async function list(req, res) {
    return sendCachedList(res, scope, req.user.sub, () => store.listAchievements(req.user.sub));
}
const invalidate = (userId) => {
    clearListCache(scope, userId);
    void clearDashboardCache(userId);
};
export async function getOne(req, res) { const item = await store.getAchievement(req.params.id, req.user.sub); if (!item)
    return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function create(req, res) { const p = achievementSchema.safeParse(req.body); if (!p.success)
    return res.status(400).json({ message: zodErrorMessage(p.error) }); const item = await store.createAchievement(req.user.sub, p.data); invalidate(req.user.sub); res.status(201).json({ data: item }); }
export async function update(req, res) { const p = achievementSchema.partial().safeParse(req.body); if (!p.success)
    return res.status(400).json({ message: zodErrorMessage(p.error) }); const item = await store.updateAchievement(req.params.id, req.user.sub, p.data); if (!item)
    return res.status(404).json({ message: "Not found" }); invalidate(req.user.sub); res.json({ data: item }); }
export async function remove(req, res) { const ok = await store.deleteAchievement(req.params.id, req.user.sub); if (!ok)
    return res.status(404).json({ message: "Not found" }); invalidate(req.user.sub); res.json({ message: "Deleted" }); }
