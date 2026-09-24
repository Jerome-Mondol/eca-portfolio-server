import { getPool } from "../config/db.js";
const mem = new Map();
function useDb() { return !!getPool(); }
function rowTo(row) { return { id: row.id, userId: row.user_id, name: row.name, provider: row.provider, instructor: row.instructor, startDate: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : null, completionDate: row.completion_date ? new Date(row.completion_date).toISOString().slice(0, 10) : null, description: row.description, skills: row.skills, certificateId: row.certificate_id, credentialUrl: row.credential_url, visibility: row.visibility, createdAt: row.created_at?.toISOString?.(), updatedAt: row.updated_at?.toISOString?.() }; }
export async function listCourses(userId) { if (useDb()) {
    const r = await getPool().query("SELECT * FROM courses WHERE user_id=$1 ORDER BY created_at DESC", [userId]);
    return r.rows.map(rowTo);
} return Array.from(mem.values()).filter(c => c.userId === userId).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")); }
export async function getCourse(id, userId) { if (useDb()) {
    const r = await getPool().query("SELECT * FROM courses WHERE id=$1 AND user_id=$2", [id, userId]);
    if (!r.rows[0])
        return null;
    return rowTo(r.rows[0]);
} const c = mem.get(id); if (!c || c.userId !== userId)
    return null; return c; }
export async function createCourse(userId, data) { if (useDb()) {
    const r = await getPool().query(`INSERT INTO courses (user_id, name, provider, instructor, start_date, completion_date, description, skills, certificate_id, credential_url, visibility) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [userId, data.name, data.provider ?? null, data.instructor ?? null, data.startDate || null, data.completionDate || null, data.description ?? null, data.skills ?? null, data.certificateId ?? null, data.credentialUrl ?? null, data.visibility || "public"]);
    return rowTo(r.rows[0]);
} const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; const c = { id, userId, name: data.name, provider: data.provider ?? null, instructor: data.instructor ?? null, startDate: data.startDate ?? null, completionDate: data.completionDate ?? null, description: data.description ?? null, skills: data.skills ?? null, certificateId: data.certificateId ?? null, credentialUrl: data.credentialUrl ?? null, visibility: data.visibility || "public", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; mem.set(id, c); return c; }
export async function updateCourse(id, userId, data) { if (useDb()) {
    const r = await getPool().query(`UPDATE courses SET name=COALESCE($3,name), provider=COALESCE($4,provider), instructor=COALESCE($5,instructor), start_date=COALESCE($6,start_date), completion_date=COALESCE($7,completion_date), description=COALESCE($8,description), skills=COALESCE($9,skills), certificate_id=COALESCE($10,certificate_id), credential_url=COALESCE($11,credential_url), visibility=COALESCE($12,visibility), updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *`, [id, userId, data.name ?? null, data.provider ?? null, data.instructor ?? null, data.startDate ?? null, data.completionDate ?? null, data.description ?? null, data.skills ?? null, data.certificateId ?? null, data.credentialUrl ?? null, data.visibility ?? null]);
    if (!r.rows[0])
        return null;
    return rowTo(r.rows[0]);
} const ex = mem.get(id); if (!ex || ex.userId !== userId)
    return null; const upd = { ...ex, ...data, updatedAt: new Date().toISOString() }; mem.set(id, upd); return upd; }
export async function deleteCourse(id, userId) { if (useDb()) {
    const r = await getPool().query("DELETE FROM courses WHERE id=$1 AND user_id=$2", [id, userId]);
    return (r.rowCount ?? 0) > 0;
} const ex = mem.get(id); if (!ex || ex.userId !== userId)
    return false; mem.delete(id); return true; }
