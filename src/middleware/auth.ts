import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type AccessPayload } from "../utils/tokens.js";

export type AuthedRequest = Request & { user?: AccessPayload };

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing access token" });
  }
  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (e: any) {
    const msg = e?.name === "TokenExpiredError" ? "Access token expired" : "Invalid access token";
    return res.status(401).json({ message: msg });
  }
}
