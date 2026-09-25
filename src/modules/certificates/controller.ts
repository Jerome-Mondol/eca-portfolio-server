import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { certificateSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/certificateStore.js";
import { redisGet, redisSet, redisDel } from "../../config/redis.js";
import { clearDashboardCache } from "../dashboard/controller.js";
const cacheKey = (userId: string) => `list:certificates:${userId}`;
export async function list(req: AuthedRequest, res: Response) {
  const key = cacheKey(req.user!.sub);
  try { const cached = await redisGet(key); if (cached) { res.setHeader("X-Cache", "HIT"); return res.json(JSON.parse(cached)); } } catch {}
  const data = await store.listCertificates(req.user!.sub);
  const body = { data };
  try { await redisSet(key, JSON.stringify(body), 60); } catch {}
  res.setHeader("X-Cache", "MISS");
  res.json(body);
}
export async function getOne(req: AuthedRequest, res: Response) { const item = await store.getCertificate(req.params.id, req.user!.sub); if (!item) return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function create(req: AuthedRequest, res: Response) { const parsed = certificateSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) }); const item = await store.createCertificate(req.user!.sub, parsed.data); try { await redisDel(cacheKey(req.user!.sub)); await clearDashboardCache(req.user!.sub); } catch {} res.status(201).json({ data: item }); }
export async function update(req: AuthedRequest, res: Response) { const parsed = certificateSchema.partial().safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) }); const item = await store.updateCertificate(req.params.id, req.user!.sub, parsed.data); if (!item) return res.status(404).json({ message: "Not found" }); try { await redisDel(cacheKey(req.user!.sub)); await clearDashboardCache(req.user!.sub); } catch {} res.json({ data: item }); }
export async function remove(req: AuthedRequest, res: Response) { const ok = await store.deleteCertificate(req.params.id, req.user!.sub); if (!ok) return res.status(404).json({ message: "Not found" }); try { await redisDel(cacheKey(req.user!.sub)); await clearDashboardCache(req.user!.sub); } catch {} res.json({ message: "Deleted" }); }
