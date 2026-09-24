import { skillSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/skillStore.js";
export async function list(req, res) { res.json({ data: await store.listSkills(req.user.sub) }); }
export async function getOne(req, res) { const item = await store.getSkill(req.params.id, req.user.sub); if (!item)
    return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function create(req, res) { const p = skillSchema.safeParse(req.body); if (!p.success)
    return res.status(400).json({ message: zodErrorMessage(p.error) }); try {
    const item = await store.createSkill(req.user.sub, p.data);
    res.status(201).json({ data: item });
}
catch (e) {
    return res.status(409).json({ message: e.message });
} }
export async function update(req, res) { const p = skillSchema.partial().safeParse(req.body); if (!p.success)
    return res.status(400).json({ message: zodErrorMessage(p.error) }); const item = await store.updateSkill(req.params.id, req.user.sub, p.data); if (!item)
    return res.status(404).json({ message: "Not found" }); res.json({ data: item }); }
export async function remove(req, res) { const ok = await store.deleteSkill(req.params.id, req.user.sub); if (!ok)
    return res.status(404).json({ message: "Not found" }); res.json({ message: "Deleted" }); }
