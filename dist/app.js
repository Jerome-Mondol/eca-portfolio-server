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
// Health
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "folio-api", env: env.NODE_ENV, db: !!env.DATABASE_URL, redis: !!env.REDIS_URL }));
// Auth — Neon + Upstash backed, proper access/refresh with rotation
app.use("/api/auth", authRouter);
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
// Resource placeholders (spec §52) — remaining (portfolio, ai, analytics — next)
const resources = ["users", "portfolio", "ai", "analytics"];
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
