import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { documentSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/documentStore.js";
import { sendCachedList, clearListCache } from "../../utils/listCache.js";
import { clearDashboardCache } from "../dashboard/controller.js";

const scope = "documents";

export async function list(req: AuthedRequest, res: Response) {
  return sendCachedList(res, scope, req.user!.sub, () => store.listDocuments(req.user!.sub));
}

const invalidate = (userId: string) => {
  clearListCache(scope, userId);
  void clearDashboardCache(userId);
};

export async function getOne(req: AuthedRequest, res: Response) { const item = await store.getDocument(req.params.id, req.user!.sub); if (!item) return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function create(req: AuthedRequest, res: Response) { const parsed = documentSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) }); const item = await store.createDocument(req.user!.sub, parsed.data); invalidate(req.user!.sub); res.status(201).json({ data: item }); }
export async function remove(req: AuthedRequest, res: Response) { const ok = await store.deleteDocument(req.params.id, req.user!.sub); if (!ok) return res.status(404).json({ message: "Not found" }); invalidate(req.user!.sub); res.json({ message: "Deleted" }); }
