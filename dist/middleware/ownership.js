// Ownership guard placeholder for future resource modules (projects, certificates, etc.)
// Per spec §59: Student A must never access Student B by changing ID.
// Usage: app.use("/api/projects", authMiddleware, ownershipGuard("projectId", async (id, userId) => checkOwner(id, userId)))
export function ownershipGuard(paramName, check) {
    return async (req, res, next) => {
        const userId = req.user?.sub;
        const resourceId = req.params[paramName] ?? req.query[paramName];
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        if (!resourceId)
            return next(); // list/create — no specific resource
        const ok = await check(resourceId, userId);
        if (!ok)
            return res.status(403).json({ message: "Forbidden — not your resource" });
        next();
    };
}
