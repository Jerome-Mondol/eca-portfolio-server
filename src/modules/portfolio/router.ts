import { Router } from "express";
import { getPublicPortfolio } from "./controller.js";

const r = Router();

// Public — no auth, cached via Redis 60s
r.get("/:username", getPublicPortfolio);

export default r;
