import { getPool } from "../config/db.js";
const memUsers = new Map(); // id -> user
const memByEmail = new Map(); // email -> id
const memByUsername = new Map(); // username -> id
function useDb() {
    return !!getPool();
}
export async function findUserByEmail(email) {
    const key = email.toLowerCase();
    if (useDb()) {
        const r = await getPool().query("SELECT id, email, username, password_hash, full_name, created_at FROM users WHERE email = $1", [key]);
        if (!r.rows[0])
            return null;
        const row = r.rows[0];
        return { id: row.id, email: row.email, username: row.username, passwordHash: row.password_hash, fullName: row.full_name, createdAt: row.created_at?.toISOString?.() ?? new Date().toISOString() };
    }
    const id = memByEmail.get(key);
    if (!id)
        return null;
    return memUsers.get(id) ?? null;
}
export async function findUserByUsername(username) {
    const key = username.toLowerCase();
    if (useDb()) {
        const r = await getPool().query("SELECT id, email, username, password_hash, full_name, created_at FROM users WHERE username = $1", [key]);
        if (!r.rows[0])
            return null;
        const row = r.rows[0];
        return { id: row.id, email: row.email, username: row.username, passwordHash: row.password_hash, fullName: row.full_name, createdAt: row.created_at?.toISOString?.() ?? new Date().toISOString() };
    }
    const id = memByUsername.get(key);
    if (!id)
        return null;
    return memUsers.get(id) ?? null;
}
export async function findUserById(id) {
    if (useDb()) {
        const r = await getPool().query("SELECT id, email, username, password_hash, full_name, created_at FROM users WHERE id = $1", [id]);
        if (!r.rows[0])
            return null;
        const row = r.rows[0];
        return { id: row.id, email: row.email, username: row.username, passwordHash: row.password_hash, fullName: row.full_name, createdAt: row.created_at?.toISOString?.() ?? new Date().toISOString() };
    }
    return memUsers.get(id) ?? null;
}
export async function createUser(data) {
    const email = data.email.toLowerCase();
    const username = data.username.toLowerCase();
    if (useDb()) {
        const r = await getPool().query("INSERT INTO users(email, username, password_hash, full_name) VALUES($1,$2,$3,$4) RETURNING id, email, username, password_hash, full_name, created_at", [email, username, data.passwordHash, data.fullName]);
        const row = r.rows[0];
        return { id: row.id, email: row.email, username: row.username, passwordHash: row.password_hash, fullName: row.full_name, createdAt: row.created_at?.toISOString?.() ?? new Date().toISOString() };
    }
    // memory: generate UUID-like
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const user = { id, email, username, passwordHash: data.passwordHash, fullName: data.fullName, createdAt: new Date().toISOString() };
    memUsers.set(id, user);
    memByEmail.set(email, id);
    memByUsername.set(username, id);
    return user;
}
