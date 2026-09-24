// Ownership guard placeholder for future resource modules (projects, certificates, etc.)
// Per spec §59: Student A must never access Student B by changing ID.
// Usage: app.use("/api/projects", authMiddleware, ownershipGuard("projectId", async (id, userId) => checkOwner(id, userId)))

import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./auth.js";

export function ownershipGuard(paramName: string, check: (resourceId: string, userId: string) => Promise<boolean>) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.sub;
    const resourceId = (req.params as any)[paramName] ?? (req.query as any)[paramName];
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!resourceId) return next(); // list/create — no specific resource
    const ok = await check(resourceId, userId);
    if (!ok) return res.status(403).json({ message: "Forbidden — not your resource" });
    next();
  };
}
