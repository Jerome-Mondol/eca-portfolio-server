import { getPool } from "../config/db.js";
const mem = new Map();
function useDb() { return !!getPool(); }
function rowTo(row) { return { id: row.id, userId: row.user_id, filename: row.filename, originalName: row.original_name, mimeType: row.mime_type, fileSize: row.file_size, storageKey: row.storage_key, category: row.category, createdAt: row.created_at?.toISOString?.(), updatedAt: row.updated_at?.toISOString?.() }; }
export async function listDocuments(userId) { if (useDb()) {
    const r = await getPool().query("SELECT * FROM documents WHERE user_id=$1 ORDER BY created_at DESC", [userId]);
    return r.rows.map(rowTo);
} return Array.from(mem.values()).filter(d => d.userId === userId).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")); }
export async function getDocument(id, userId) { if (useDb()) {
    const r = await getPool().query("SELECT * FROM documents WHERE id=$1 AND user_id=$2", [id, userId]);
    if (!r.rows[0])
        return null;
    return rowTo(r.rows[0]);
} const d = mem.get(id); if (!d || d.userId !== userId)
    return null; return d; }
export async function createDocument(userId, data) { if (useDb()) {
    const r = await getPool().query(`INSERT INTO documents (user_id, filename, original_name, mime_type, file_size, storage_key, category) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [userId, data.filename, data.originalName ?? null, data.mimeType ?? null, data.fileSize ?? null, data.storageKey ?? null, data.category || "Other"]);
    return rowTo(r.rows[0]);
} const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; const d = { id, userId, filename: data.filename, originalName: data.originalName ?? null, mimeType: data.mimeType ?? null, fileSize: data.fileSize ?? null, storageKey: data.storageKey ?? null, category: data.category || "Other", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; mem.set(id, d); return d; }
export async function deleteDocument(id, userId) { if (useDb()) {
    const r = await getPool().query("DELETE FROM documents WHERE id=$1 AND user_id=$2", [id, userId]);
    return (r.rowCount ?? 0) > 0;
} const ex = mem.get(id); if (!ex || ex.userId !== userId)
    return false; mem.delete(id); return true; }
