import type { Request, Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { saveImage, getImage } from "./store.js";
import { isR2Configured, uploadToR2, getR2PublicUrl } from "../../config/r2.js";

const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "application/pdf"]);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB per spec

export async function uploadImage(req: AuthedRequest, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ message: "No image provided" });

  if (!ALLOWED_MIME.has(file.mimetype)) {
    return res.status(400).json({ message: "Invalid file type. Only images and PDF allowed" });
  }
  if (file.size > MAX_SIZE) {
    return res.status(400).json({ message: "File too large. Max 10MB" });
  }

  const userId = req.user!.sub;

  // If Cloudflare R2 is configured, save to R2 (profile images live in R2)
  if (isR2Configured()) {
    try {
      const ext = file.originalname.split(".").pop() || "jpg";
      const key = `avatars/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const url = await uploadToR2(key, file.buffer, file.mimetype);
      // Also keep a local record for listing
      const stored = saveImage({
        buffer: Buffer.alloc(0), // not needed when on R2 — keep metadata only
        mimeType: file.mimetype,
        originalName: file.originalname,
        size: file.size,
        userId,
      });
      // Overwrite id/key to R2 key for traceability, but keep url as R2 public URL
      return res.status(201).json({
        data: {
          id: stored.id,
          url, // R2 public URL — profile will save this
          key, // R2 key
          r2Key: key,
          mimeType: file.mimetype,
          originalName: file.originalname,
          size: file.size,
          storage: "r2",
        },
      });
    } catch (e: any) {
      console.error("[upload] R2 upload failed, falling back to memory", e.message);
      // fall through to memory
    }
  }

  const stored = saveImage({
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
    size: file.size,
    userId,
  });

  // URL is public GET /api/upload/image/:id (memory fallback)
  const url = `/api/upload/image/${stored.id}`;

  res.status(201).json({
    data: {
      id: stored.id,
      url,
      key: stored.id,
      mimeType: stored.mimeType,
      originalName: stored.originalName,
      size: stored.size,
      storage: "memory",
    },
  });
}

export async function serveImage(req: Request, res: Response) {
  const img = getImage(req.params.id);
  if (!img) return res.status(404).json({ message: "Image not found" });
  // If this was an R2 image with empty buffer (metadata only), try R2 proxy
  if (img.buffer.length === 0) {
    return res.status(404).json({ message: "Image stored in R2 — use R2 URL" });
  }
  res.setHeader("Content-Type", img.mimeType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(img.buffer);
}

export async function serveR2Image(req: Request, res: Response) {
  const key = req.params.key;
  // Decode key (it was encodeURIComponent'd)
  const decodedKey = decodeURIComponent(key);
  const { getFromR2 } = await import("../../config/r2.js");
  const result = await getFromR2(decodedKey);
  if (!result) return res.status(404).json({ message: "Image not found in R2" });
  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(result.buffer);
}

export async function listImages(req: AuthedRequest, res: Response) {
  const { listImagesByUser } = await import("./store.js");
  const images = listImagesByUser(req.user!.sub);
  res.json({
    data: images.map((i) => ({ id: i.id, url: `/api/upload/image/${i.id}`, mimeType: i.mimeType, originalName: i.originalName, size: i.size, createdAt: i.createdAt })),
  });
}
