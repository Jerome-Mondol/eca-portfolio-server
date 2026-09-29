import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { analyzeCertificateHandler, improveProjectHandler } from "./controller.js";
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
            cb(null, true);
        }
        else {
            cb(new Error("Only images and PDF are supported"));
        }
    },
});
const r = Router();
r.use(authMiddleware);
// Every call burns a model request plus a grounded web search, so meter it hard.
// 20/hour/IP against the existing Redis-backed limiter (fails open if Redis is down).
r.post("/certificates/analyze", rateLimit({ windowSeconds: 3600, max: 20, keyPrefix: "ai-cert-analyze" }), upload.single("file"), analyzeCertificateHandler);
// One model call, no grounding, so it gets its own, more generous budget.
r.post("/projects/improve", rateLimit({ windowSeconds: 3600, max: 30, keyPrefix: "ai-project-improve" }), improveProjectHandler);
export default r;
