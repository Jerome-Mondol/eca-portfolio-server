import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.js";
import { getSummary } from "./controller.js";
const r = Router();
r.use(authMiddleware);
r.get("/", getSummary);
r.get("/summary", getSummary);
export default r;
