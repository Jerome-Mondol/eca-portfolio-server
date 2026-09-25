import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { courseSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/courseStore.js";
import { redisGet, redisSet, redisDel } from "../../config/redis.js";
import { clearDashboardCache } from "../dashboard/controller.js";
const cacheKey = (userId: string) => `list:courses:${userId}`;
export async function list(req: AuthedRequest, res: Response) { const key = cacheKey(req.user!.sub); try { const c = await redisGet(key); if (c) { res.setHeader("X-Cache", "HIT"); return res.json(JSON.parse(c)); } } catch {} const data = await store.listCourses(req.user!.sub); const body = { data }; try { await redisSet(key, JSON.stringify(body), 60); } catch {} res.setHeader("X-Cache", "MISS"); res.json(body); }
export async function getOne(req: AuthedRequest, res: Response) { const item = await store.getCourse(req.params.id, req.user!.sub); if (!item) return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function create(req: AuthedRequest, res: Response) { const p = courseSchema.safeParse(req.body); if (!p.success) return res.status(400).json({ message: zodErrorMessage(p.error) }); const item = await store.createCourse(req.user!.sub, p.data); try { await redisDel(cacheKey(req.user!.sub)); await clearDashboardCache(req.user!.sub); } catch {} res.status(201).json({ data: item }); }
export async function update(req: AuthedRequest, res: Response) { const p = courseSchema.partial().safeParse(req.body); if (!p.success) return res.status(400).json({ message: zodErrorMessage(p.error) }); const item = await store.updateCourse(req.params.id, req.user!.sub, p.data); if (!item) return res.status(404).json({ message: "Not found" }); try { await redisDel(cacheKey(req.user!.sub)); await clearDashboardCache(req.user!.sub); } catch {} res.json({ data: item }); }
export async function remove(req: AuthedRequest, res: Response) { const ok = await store.deleteCourse(req.params.id, req.user!.sub); if (!ok) return res.status(404).json({ message: "Not found" }); try { await redisDel(cacheKey(req.user!.sub)); await clearDashboardCache(req.user!.sub); } catch {} res.json({ message: "Deleted" }); }
