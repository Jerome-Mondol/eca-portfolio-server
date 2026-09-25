import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { activitySchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/activityStore.js";
import { redisGet, redisSet, redisDel } from "../../config/redis.js";
import { clearDashboardCache } from "../dashboard/controller.js";
const cacheKey = (userId: string) => `list:activities:${userId}`;
export async function list(req: AuthedRequest, res: Response) {
  const userId = req.user!.sub;
  const key = cacheKey(userId);
  try {
    const cached = await redisGet(key);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(JSON.parse(cached));
    }
  } catch {}
  const data = await store.listActivities(userId);
  const body = { data };
  try { await redisSet(key, JSON.stringify(body), 60); } catch {}
  res.setHeader("X-Cache", "MISS");
  res.json(body);
}
export async function getOne(req: AuthedRequest, res: Response) {
  const item = await store.getActivity(req.params.id, req.user!.sub);
  if (!item) return res.status(404).json({ message: "Not found" });
  res.json({ data: item });
}
export async function create(req: AuthedRequest, res: Response) {
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) });
  const item = await store.createActivity(req.user!.sub, parsed.data);
  try { await redisDel(cacheKey(req.user!.sub)); await clearDashboardCache(req.user!.sub); } catch {}
  res.status(201).json({ data: item });
}
export async function update(req: AuthedRequest, res: Response) {
  const parsed = activitySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) });
  const item = await store.updateActivity(req.params.id, req.user!.sub, parsed.data);
  if (!item) return res.status(404).json({ message: "Not found" });
  try { await redisDel(cacheKey(req.user!.sub)); await clearDashboardCache(req.user!.sub); } catch {}
  res.json({ data: item });
}
export async function remove(req: AuthedRequest, res: Response) {
  const ok = await store.deleteActivity(req.params.id, req.user!.sub);
  if (!ok) return res.status(404).json({ message: "Not found" });
  try { await redisDel(cacheKey(req.user!.sub)); await clearDashboardCache(req.user!.sub); } catch {}
  res.json({ message: "Deleted" });
}
