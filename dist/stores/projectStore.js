import { getPool } from "../config/db.js";
const memProjects = new Map();
function useDb() { return !!getPool(); }
function rowToProject(row) {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        description: row.description,
        detailedDescription: row.detailed_description,
        coverImage: row.cover_image,
        technologies: row.technologies,
        skills: row.skills,
        startDate: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : null,
        endDate: row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : null,
        githubUrl: row.github_url,
        liveUrl: row.live_url,
        demoVideo: row.demo_video,
        role: row.role,
        featured: row.featured,
        visibility: row.visibility,
        createdAt: row.created_at?.toISOString?.(),
        updatedAt: row.updated_at?.toISOString?.(),
    };
}
export async function listProjects(userId) {
    if (useDb()) {
        const r = await getPool().query("SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
        return r.rows.map(rowToProject);
    }
    return Array.from(memProjects.values()).filter((p) => p.userId === userId).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
export async function getProject(id, userId) {
    if (useDb()) {
        const r = await getPool().query("SELECT * FROM projects WHERE id = $1 AND user_id = $2", [id, userId]);
        if (!r.rows[0])
            return null;
        return rowToProject(r.rows[0]);
    }
    const p = memProjects.get(id);
    if (!p || p.userId !== userId)
        return null;
    return p;
}
export async function createProject(userId, data) {
    if (useDb()) {
        const r = await getPool().query(`INSERT INTO projects (user_id, title, description, detailed_description, cover_image, technologies, skills, start_date, end_date, github_url, live_url, demo_video, role, featured, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`, [userId, data.title, data.description ?? null, data.detailedDescription ?? null, data.coverImage ?? null, data.technologies ?? null, data.skills ?? null, data.startDate || null, data.endDate || null, data.githubUrl || null, data.liveUrl || null, data.demoVideo || null, data.role || null, !!data.featured, data.visibility || "public"]);
        return rowToProject(r.rows[0]);
    }
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const proj = { id, userId, title: data.title, description: data.description ?? null, detailedDescription: data.detailedDescription ?? null, coverImage: data.coverImage ?? null, technologies: data.technologies ?? null, skills: data.skills ?? null, startDate: data.startDate ?? null, endDate: data.endDate ?? null, githubUrl: data.githubUrl ?? null, liveUrl: data.liveUrl ?? null, demoVideo: data.demoVideo ?? null, role: data.role ?? null, featured: !!data.featured, visibility: data.visibility || "public", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    memProjects.set(id, proj);
    return proj;
}
export async function updateProject(id, userId, data) {
    if (useDb()) {
        const r = await getPool().query(`UPDATE projects SET title=COALESCE($3, title), description=COALESCE($4, description), detailed_description=COALESCE($5, detailed_description), cover_image=COALESCE($6, cover_image), technologies=COALESCE($7, technologies), skills=COALESCE($8, skills), start_date=COALESCE($9, start_date), end_date=COALESCE($10, end_date), github_url=COALESCE($11, github_url), live_url=COALESCE($12, live_url), demo_video=COALESCE($13, demo_video), role=COALESCE($14, role), featured=COALESCE($15, featured), visibility=COALESCE($16, visibility), updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *`, [id, userId, data.title ?? null, data.description ?? null, data.detailedDescription ?? null, data.coverImage ?? null, data.technologies ?? null, data.skills ?? null, data.startDate ?? null, data.endDate ?? null, data.githubUrl ?? null, data.liveUrl ?? null, data.demoVideo ?? null, data.role ?? null, data.featured ?? null, data.visibility ?? null]);
        if (!r.rows[0])
            return null;
        return rowToProject(r.rows[0]);
    }
    const existing = memProjects.get(id);
    if (!existing || existing.userId !== userId)
        return null;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    memProjects.set(id, updated);
    return updated;
}
export async function deleteProject(id, userId) {
    if (useDb()) {
        const r = await getPool().query("DELETE FROM projects WHERE id=$1 AND user_id=$2", [id, userId]);
        return (r.rowCount ?? 0) > 0;
    }
    const existing = memProjects.get(id);
    if (!existing || existing.userId !== userId)
        return false;
    memProjects.delete(id);
    return true;
}
