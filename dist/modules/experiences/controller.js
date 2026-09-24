import { experienceSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/experienceStore.js";
export async function list(req, res) { res.json({ data: await store.listExperiences(req.user.sub) }); }
export async function getOne(req, res) { const item = await store.getExperience(req.params.id, req.user.sub); if (!item)
    return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function create(req, res) { const p = experienceSchema.safeParse(req.body); if (!p.success)
    return res.status(400).json({ message: zodErrorMessage(p.error) }); const item = await store.createExperience(req.user.sub, p.data); res.status(201).json({ data: item }); }
export async function update(req, res) { const p = experienceSchema.partial().safeParse(req.body); if (!p.success)
    return res.status(400).json({ message: zodErrorMessage(p.error) }); const item = await store.updateExperience(req.params.id, req.user.sub, p.data); if (!item)
    return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function remove(req, res) { const ok = await store.deleteExperience(req.params.id, req.user.sub); if (!ok)
    return res.status(404).json({ message: "Not found" }); res.json({ message: "Deleted" }); }
