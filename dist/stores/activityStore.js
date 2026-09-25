import { getPool } from "../config/db.js";
const mem = new Map();
function useDb() { return !!getPool(); }
function rowTo(row) {
    return {
        id: row.id,
        userId: row.user_id,
        activityName: row.activity_name,
        category: row.category,
        organization: row.organization,
        role: row.role,
        description: row.description,
        startDate: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : null,
        endDate: row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : null,
        achievements: row.achievements,
        skills: row.skills,
        images: row.images ?? [],
        visibility: row.visibility,
        createdAt: row.created_at?.toISOString?.(),
        updatedAt: row.updated_at?.toISOString?.(),
    };
}
export async function listActivities(userId) {
    if (useDb()) {
        const r = await getPool().query("SELECT * FROM activities WHERE user_id=$1 ORDER BY created_at DESC", [userId]);
        return r.rows.map(rowTo);
    }
    return Array.from(mem.values()).filter(a => a.userId === userId).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
export async function getActivity(id, userId) {
    if (useDb()) {
        const r = await getPool().query("SELECT * FROM activities WHERE id=$1 AND user_id=$2", [id, userId]);
        if (!r.rows[0])
            return null;
        return rowTo(r.rows[0]);
    }
    const a = mem.get(id);
    if (!a || a.userId !== userId)
        return null;
    return a;
}
export async function createActivity(userId, data) {
    const images = data.images?.slice(0, 5) ?? null;
    if (useDb()) {
        const r = await getPool().query(`INSERT INTO activities (user_id, activity_name, category, organization, role, description, start_date, end_date, achievements, skills, images, visibility) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [userId, data.activityName, data.category ?? null, data.organization ?? null, data.role ?? null, data.description ?? null, data.startDate || null, data.endDate || null, data.achievements ?? null, data.skills ?? null, images, data.visibility || "public"]);
        return rowTo(r.rows[0]);
    }
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const a = { id, userId, activityName: data.activityName, category: data.category ?? null, organization: data.organization ?? null, role: data.role ?? null, description: data.description ?? null, startDate: data.startDate ?? null, endDate: data.endDate ?? null, achievements: data.achievements ?? null, skills: data.skills ?? null, images, visibility: data.visibility || "public", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    mem.set(id, a);
    return a;
}
export async function updateActivity(id, userId, data) {
    const images = data.images ? data.images.slice(0, 5) : null;
    if (useDb()) {
        // If images provided, replace; otherwise keep existing
        if (images !== null) {
            const r = await getPool().query(`UPDATE activities SET activity_name=COALESCE($3,activity_name), category=COALESCE($4,category), organization=COALESCE($5,organization), role=COALESCE($6,role), description=COALESCE($7,description), start_date=COALESCE($8,start_date), end_date=COALESCE($9,end_date), achievements=COALESCE($10,achievements), skills=COALESCE($11,skills), images=$12, visibility=COALESCE($13,visibility), updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *`, [id, userId, data.activityName ?? null, data.category ?? null, data.organization ?? null, data.role ?? null, data.description ?? null, data.startDate ?? null, data.endDate ?? null, data.achievements ?? null, data.skills ?? null, images, data.visibility ?? null]);
            if (!r.rows[0])
                return null;
            return rowTo(r.rows[0]);
        }
        else {
            const r = await getPool().query(`UPDATE activities SET activity_name=COALESCE($3,activity_name), category=COALESCE($4,category), organization=COALESCE($5,organization), role=COALESCE($6,role), description=COALESCE($7,description), start_date=COALESCE($8,start_date), end_date=COALESCE($9,end_date), achievements=COALESCE($10,achievements), skills=COALESCE($11,skills), visibility=COALESCE($12,visibility), updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *`, [id, userId, data.activityName ?? null, data.category ?? null, data.organization ?? null, data.role ?? null, data.description ?? null, data.startDate ?? null, data.endDate ?? null, data.achievements ?? null, data.skills ?? null, data.visibility ?? null]);
            if (!r.rows[0])
                return null;
            return rowTo(r.rows[0]);
        }
    }
    const ex = mem.get(id);
    if (!ex || ex.userId !== userId)
        return null;
    const upd = { ...ex, ...data, images: images ?? ex.images, updatedAt: new Date().toISOString() };
    mem.set(id, upd);
    return upd;
}
export async function deleteActivity(id, userId) {
    if (useDb()) {
        const r = await getPool().query("DELETE FROM activities WHERE id=$1 AND user_id=$2", [id, userId]);
        return (r.rowCount ?? 0) > 0;
    }
    const ex = mem.get(id);
    if (!ex || ex.userId !== userId)
        return false;
    mem.delete(id);
    return true;
}
