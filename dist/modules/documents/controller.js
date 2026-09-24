import { documentSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/documentStore.js";
export async function list(req, res) { res.json({ data: await store.listDocuments(req.user.sub) }); }
export async function getOne(req, res) { const item = await store.getDocument(req.params.id, req.user.sub); if (!item)
    return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function create(req, res) {
    // For MVP without R2, accept metadata JSON. Later will handle multipart via multer.
    const parsed = documentSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: zodErrorMessage(parsed.error) });
    const item = await store.createDocument(req.user.sub, parsed.data);
    res.status(201).json({ data: item });
}
export async function remove(req, res) { const ok = await store.deleteDocument(req.params.id, req.user.sub); if (!ok)
    return res.status(404).json({ message: "Not found" }); res.json({ message: "Deleted" }); }
