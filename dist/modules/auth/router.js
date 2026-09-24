import { Router } from "express";
import { register, login, refresh, logout, me } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
const r = Router();
r.post("/register", rateLimit({ windowSeconds: 60, max: 5, keyPrefix: "auth-register" }), register);
r.post("/login", rateLimit({ windowSeconds: 60, max: 10, keyPrefix: "auth-login" }), login);
r.post("/refresh", refresh); // refresh uses httpOnly cookie, not rate limited harshly but we limit
r.post("/logout", logout);
r.get("/me", authMiddleware, me);
export default r;
