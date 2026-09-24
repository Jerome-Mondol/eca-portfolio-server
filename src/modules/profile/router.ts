import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { getProfile, upsertProfile } from "./controller.js";

const r = Router();
r.use(authMiddleware);
r.get("/", getProfile);
r.put("/", upsertProfile);
export default r;
