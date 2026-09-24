import { getPool } from "../config/db.js";
const mem = new Map();
function useDb() { return !!getPool(); }
function rowTo(row) { return { id: row.id, userId: row.user_id, position: row.position, organization: row.organization, location: row.location, startDate: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : null, endDate: row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : null, current: row.current, description: row.description, achievements: row.achievements, skills: row.skills, visibility: row.visibility, createdAt: row.created_at?.toISOString?.(), updatedAt: row.updated_at?.toISOString?.() }; }
export async function listExperiences(userId) { if (useDb()) {
    const r = await getPool().query("SELECT * FROM experiences WHERE user_id=$1 ORDER BY start_date DESC, created_at DESC", [userId]);
    return r.rows.map(rowTo);
} return Array.from(mem.values()).filter(e => e.userId === userId).sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "")); }
export async function getExperience(id, userId) { if (useDb()) {
    const r = await getPool().query("SELECT * FROM experiences WHERE id=$1 AND user_id=$2", [id, userId]);
    if (!r.rows[0])
        return null;
    return rowTo(r.rows[0]);
} const e = mem.get(id); if (!e || e.userId !== userId)
    return null; return e; }
export async function createExperience(userId, data) { if (useDb()) {
    const r = await getPool().query(`INSERT INTO experiences (user_id, position, organization, location, start_date, end_date, current, description, achievements, skills, visibility) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [userId, data.position, data.organization ?? null, data.location ?? null, data.startDate || null, data.endDate || null, !!data.current, data.description ?? null, data.achievements ?? null, data.skills ?? null, data.visibility || "public"]);
    return rowTo(r.rows[0]);
} const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; const e = { id, userId, position: data.position, organization: data.organization ?? null, location: data.location ?? null, startDate: data.startDate ?? null, endDate: data.endDate ?? null, current: !!data.current, description: data.description ?? null, achievements: data.achievements ?? null, skills: data.skills ?? null, visibility: data.visibility || "public", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; mem.set(id, e); return e; }
export async function updateExperience(id, userId, data) { if (useDb()) {
    const r = await getPool().query(`UPDATE experiences SET position=COALESCE($3,position), organization=COALESCE($4,organization), location=COALESCE($5,location), start_date=COALESCE($6,start_date), end_date=COALESCE($7,end_date), current=COALESCE($8,current), description=COALESCE($9,description), achievements=COALESCE($10,achievements), skills=COALESCE($11,skills), visibility=COALESCE($12,visibility), updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *`, [id, userId, data.position ?? null, data.organization ?? null, data.location ?? null, data.startDate ?? null, data.endDate ?? null, data.current ?? null, data.description ?? null, data.achievements ?? null, data.skills ?? null, data.visibility ?? null]);
    if (!r.rows[0])
        return null;
    return rowTo(r.rows[0]);
} const ex = mem.get(id); if (!ex || ex.userId !== userId)
    return null; const upd = { ...ex, ...data, updatedAt: new Date().toISOString() }; mem.set(id, upd); return upd; }
export async function deleteExperience(id, userId) { if (useDb()) {
    const r = await getPool().query("DELETE FROM experiences WHERE id=$1 AND user_id=$2", [id, userId]);
    return (r.rowCount ?? 0) > 0;
} const ex = mem.get(id); if (!ex || ex.userId !== userId)
    return false; mem.delete(id); return true; }
