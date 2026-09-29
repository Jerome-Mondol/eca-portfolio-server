import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { initDb } from "./config/db.js";
import authRouter from "./modules/auth/router.js";
import profileRouter from "./modules/profile/router.js";
import projectsRouter from "./modules/projects/router.js";
import activitiesRouter from "./modules/activities/router.js";
import certificatesRouter from "./modules/certificates/router.js";
import coursesRouter from "./modules/courses/router.js";
import experiencesRouter from "./modules/experiences/router.js";
import achievementsRouter from "./modules/achievements/router.js";
import skillsRouter from "./modules/skills/router.js";
import documentsRouter from "./modules/documents/router.js";
import uploadRouter from "./modules/upload/router.js";
import dashboardRouter from "./modules/dashboard/router.js";
import portfolioRouter from "./modules/portfolio/router.js";
import aiRouter from "./modules/ai/router.js";
import cronRouter from "./modules/cron/router.js";
import { isR2Configured } from "./config/r2.js";
const app = express();
app.use(helmet());
app.use(cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
// Cron ping — external scheduler, answers with a bare "ok" and no dependency work
app.use("/api/cron", cronRouter);
// Health — includes R2 status for Cloudflare
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "folio-api", env: env.NODE_ENV, db: !!env.DATABASE_URL, redis: !!env.REDIS_URL, r2: isR2Configured() });
});
// Auth — Neon + Upstash backed, proper access/refresh with rotation
app.use("/api/auth", authRouter);
// Dashboard summary — single query, 30s Redis cache, near-instant
app.use("/api/dashboard", dashboardRouter);
// Public portfolio — real data, 60s cache, no auth (spec §24)
app.use("/api/portfolio", portfolioRouter);
// Universal image upload — used anywhere (profile, projects, certificates)
app.use("/api/upload", uploadRouter);
// MVP 1+2 — Profile + Content (Projects, ECA, Certificates, Courses) + Remaining (Experiences, Achievements, Skills, Documents) — all proper, no Cloudflare R2 yet
app.use("/api/profile", profileRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/activities", activitiesRouter);
app.use("/api/certificates", certificatesRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/experiences", experiencesRouter);
app.use("/api/achievements", achievementsRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/documents", documentsRouter);
// Also expose ECA alias for frontend convenience (/api/eca)
app.use("/api/eca", activitiesRouter);
// AI — certificate extraction + research (spec §20, §54). Vision reads the file
// directly, then a grounded web search checks the issuer, then a deterministic
// score. Synchronous: 10-25s. If you deploy behind a proxy with a sub-60s
// timeout, this is the first call to convert to a background job.
app.use("/api/ai", aiRouter);
// Resource placeholders (spec §52) — remaining (users, analytics)
const resources = ["users", "analytics"];
resources.forEach((r) => {
    app.use(`/api/${r}`, (_req, res) => res.status(501).json({ message: `${r} module not implemented yet` }));
});
// Global error handler
app.use((err, _req, res, _next) => {
    console.error("[error]", err);
    res.status(err.status ?? 500).json({ message: err.message ?? "Internal server error" });
});
// Init Neon tables (idempotent) — non-blocking
initDb().catch((e) => console.error("[db] init failed, running in memory fallback", e.message));
const port = env.PORT;
if (process.env.NODE_ENV !== "test") {
    app.listen(port, () => console.log(`Folio API listening on http://localhost:${port} — Neon:${!!env.DATABASE_URL} Upstash:${!!env.REDIS_URL}`));
}
export default app;
