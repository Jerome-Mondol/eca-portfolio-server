type StoredImage = {
  id: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  size: number;
  userId: string;
  createdAt: string;
};

const memImages = new Map<string, StoredImage>();

export function saveImage(data: Omit<StoredImage, "id" | "createdAt">): StoredImage {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const img: StoredImage = { id, ...data, createdAt: new Date().toISOString() };
  memImages.set(id, img);
  return img;
}

export function getImage(id: string): StoredImage | null {
  return memImages.get(id) ?? null;
}

export function listImagesByUser(userId: string): StoredImage[] {
  return Array.from(memImages.values()).filter((i) => i.userId === userId);
}
