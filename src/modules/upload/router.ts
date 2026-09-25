import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middleware/auth.js";
import { uploadImage, serveImage, serveR2Image, listImages } from "./controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only images and PDF allowed"));
  },
});

const r = Router();

// Public image serve — no auth needed for portfolio (memory + R2 proxy)
r.get("/image/:id", serveImage);
r.get("/r2/:key", serveR2Image);

// Auth required for upload/list
r.post("/image", authMiddleware, upload.single("image"), uploadImage);
r.get("/", authMiddleware, listImages);

export default r;
