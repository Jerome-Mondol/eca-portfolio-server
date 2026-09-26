import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { courseSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/courseStore.js";
import { sendCachedList, clearListCache } from "../../utils/listCache.js";
import { clearDashboardCache } from "../dashboard/controller.js";

const scope = "courses";

export async function list(req: AuthedRequest, res: Response) {
  return sendCachedList(res, scope, req.user!.sub, () => store.listCourses(req.user!.sub));
}

const invalidate = (userId: string) => {
  clearListCache(scope, userId);
  void clearDashboardCache(userId);
};

export async function getOne(req: AuthedRequest, res: Response) { const item = await store.getCourse(req.params.id, req.user!.sub); if (!item) return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function create(req: AuthedRequest, res: Response) { const p = courseSchema.safeParse(req.body); if (!p.success) return res.status(400).json({ message: zodErrorMessage(p.error) }); const item = await store.createCourse(req.user!.sub, p.data); invalidate(req.user!.sub); res.status(201).json({ data: item }); }
export async function update(req: AuthedRequest, res: Response) { const p = courseSchema.partial().safeParse(req.body); if (!p.success) return res.status(400).json({ message: zodErrorMessage(p.error) }); const item = await store.updateCourse(req.params.id, req.user!.sub, p.data); if (!item) return res.status(404).json({ message: "Not found" }); invalidate(req.user!.sub); res.json({ data: item }); }
export async function remove(req: AuthedRequest, res: Response) { const ok = await store.deleteCourse(req.params.id, req.user!.sub); if (!ok) return res.status(404).json({ message: "Not found" }); invalidate(req.user!.sub); res.json({ message: "Deleted" }); }
