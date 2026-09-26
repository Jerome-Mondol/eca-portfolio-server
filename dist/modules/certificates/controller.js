import { certificateSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/certificateStore.js";
import { sendCachedList, clearListCache } from "../../utils/listCache.js";
import { clearDashboardCache } from "../dashboard/controller.js";
const scope = "certificates";
export async function list(req, res) {
    return sendCachedList(res, scope, req.user.sub, () => store.listCertificates(req.user.sub));
}
const invalidate = (userId) => { clearListCache(scope, userId); void clearDashboardCache(userId); };
export async function getOne(req, res) { const item = await store.getCertificate(req.params.id, req.user.sub); if (!item)
    return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function create(req, res) { const parsed = certificateSchema.safeParse(req.body); if (!parsed.success)
    return res.status(400).json({ message: zodErrorMessage(parsed.error) }); const item = await store.createCertificate(req.user.sub, parsed.data); invalidate(req.user.sub); res.status(201).json({ data: item }); }
export async function update(req, res) { const parsed = certificateSchema.partial().safeParse(req.body); if (!parsed.success)
    return res.status(400).json({ message: zodErrorMessage(parsed.error) }); const item = await store.updateCertificate(req.params.id, req.user.sub, parsed.data); if (!item)
    return res.status(404).json({ message: "Not found" }); invalidate(req.user.sub); res.json({ data: item }); }
export async function remove(req, res) { const ok = await store.deleteCertificate(req.params.id, req.user.sub); if (!ok)
    return res.status(404).json({ message: "Not found" }); invalidate(req.user.sub); res.json({ message: "Deleted" }); }
