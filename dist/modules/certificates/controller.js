import { certificateSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/certificateStore.js";
export async function list(req, res) { res.json({ data: await store.listCertificates(req.user.sub) }); }
export async function getOne(req, res) { const item = await store.getCertificate(req.params.id, req.user.sub); if (!item)
    return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function create(req, res) { const parsed = certificateSchema.safeParse(req.body); if (!parsed.success)
    return res.status(400).json({ message: zodErrorMessage(parsed.error) }); const item = await store.createCertificate(req.user.sub, parsed.data); res.status(201).json({ data: item }); }
export async function update(req, res) { const parsed = certificateSchema.partial().safeParse(req.body); if (!parsed.success)
    return res.status(400).json({ message: zodErrorMessage(parsed.error) }); const item = await store.updateCertificate(req.params.id, req.user.sub, parsed.data); if (!item)
    return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function remove(req, res) { const ok = await store.deleteCertificate(req.params.id, req.user.sub); if (!ok)
    return res.status(404).json({ message: "Not found" }); res.json({ message: "Deleted" }); }
