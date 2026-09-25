import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { documentSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/documentStore.js";
import { redisGet, redisSet, redisDel } from "../../config/redis.js";
import { clearDashboardCache } from "../dashboard/controller.js";
const cacheKey = (u: string) => `list:documents:${u}`;
export async function list(req: AuthedRequest, res: Response) { const k = cacheKey(req.user!.sub); try { const c = await redisGet(k); if (c) { res.setHeader("X-Cache", "HIT"); return res.json(JSON.parse(c)); } } catch {} const data = await store.listDocuments(req.user!.sub); const body = { data }; try { await redisSet(k, JSON.stringify(body), 30); } catch {} res.setHeader("X-Cache", "MISS"); res.json(body); }
export async function getOne(req: AuthedRequest, res: Response) { const item = await store.getDocument(req.params.id, req.user!.sub); if (!item) return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function create(req: AuthedRequest, res: Response) { const parsed = documentSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) }); const item = await store.createDocument(req.user!.sub, parsed.data); try { await redisDel(cacheKey(req.user!.sub)); await clearDashboardCache(req.user!.sub); } catch {} res.status(201).json({ data: item }); }
export async function remove(req: AuthedRequest, res: Response) { const ok = await store.deleteDocument(req.params.id, req.user!.sub); if (!ok) return res.status(404).json({ message: "Not found" }); try { await redisDel(cacheKey(req.user!.sub)); await clearDashboardCache(req.user!.sub); } catch {} res.json({ message: "Deleted" }); }
