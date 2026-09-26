import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { activitySchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/activityStore.js";
import { sendCachedList, clearListCache } from "../../utils/listCache.js";
import { clearDashboardCache } from "../dashboard/controller.js";
const scope = "activities";

export async function list(req: AuthedRequest, res: Response) {
  return sendCachedList(res, scope, req.user!.sub, () => store.listActivities(req.user!.sub));
}

const invalidate = (userId: string) => {
  clearListCache(scope, userId);
  void clearDashboardCache(userId);
};
export async function getOne(req: AuthedRequest, res: Response) {
  const item = await store.getActivity(req.params.id, req.user!.sub);
  if (!item) return res.status(404).json({ message: "Not found" });
  res.json({ data: item });
}
export async function create(req: AuthedRequest, res: Response) {
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) });
  const item = await store.createActivity(req.user!.sub, parsed.data);
  invalidate(req.user!.sub);
  res.status(201).json({ data: item });
}
export async function update(req: AuthedRequest, res: Response) {
  const parsed = activitySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) });
  const item = await store.updateActivity(req.params.id, req.user!.sub, parsed.data);
  if (!item) return res.status(404).json({ message: "Not found" });
  invalidate(req.user!.sub);
  res.json({ data: item });
}
export async function remove(req: AuthedRequest, res: Response) {
  const ok = await store.deleteActivity(req.params.id, req.user!.sub);
  if (!ok) return res.status(404).json({ message: "Not found" });
  invalidate(req.user!.sub);
  res.json({ message: "Deleted" });
}
