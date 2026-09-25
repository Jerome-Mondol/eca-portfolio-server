const memImages = new Map();
export function saveImage(data) {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const img = { id, ...data, createdAt: new Date().toISOString() };
    memImages.set(id, img);
    return img;
}
export function getImage(id) {
    return memImages.get(id) ?? null;
}
export function listImagesByUser(userId) {
    return Array.from(memImages.values()).filter((i) => i.userId === userId);
}
