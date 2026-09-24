import { projectSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/projectStore.js";
export async function list(req, res) {
    const data = await store.listProjects(req.user.sub);
    res.json({ data });
}
export async function getOne(req, res) {
    const item = await store.getProject(req.params.id, req.user.sub);
    if (!item)
        return res.status(404).json({ message: "Not found" });
    res.json({ data: item });
}
export async function create(req, res) {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: zodErrorMessage(parsed.error) });
    const item = await store.createProject(req.user.sub, parsed.data);
    res.status(201).json({ data: item });
}
export async function update(req, res) {
    // allow partial
    const parsed = projectSchema.partial().safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: zodErrorMessage(parsed.error) });
    const item = await store.updateProject(req.params.id, req.user.sub, parsed.data);
    if (!item)
        return res.status(404).json({ message: "Not found" });
    res.json({ data: item });
}
export async function remove(req, res) {
    const ok = await store.deleteProject(req.params.id, req.user.sub);
    if (!ok)
        return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
}
