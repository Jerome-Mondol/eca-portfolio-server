import { verifyAccessToken } from "../utils/tokens.js";
export function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing access token" });
    }
    const token = header.slice(7);
    try {
        const payload = verifyAccessToken(token);
        req.user = payload;
        next();
    }
    catch (e) {
        const msg = e?.name === "TokenExpiredError" ? "Access token expired" : "Invalid access token";
        return res.status(401).json({ message: msg });
    }
}
