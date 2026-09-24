import { redisIncrWithExpire } from "../config/redis.js";
// Simple sliding window rate limiter backed by Upstash Redis (or memory fallback)
export function rateLimit({ windowSeconds, max, keyPrefix }) {
    return async (req, res, next) => {
        const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
        const key = `rl:${keyPrefix}:${ip}`;
        try {
            const count = await redisIncrWithExpire(key, windowSeconds);
            if (count > max) {
                return res.status(429).json({ message: "Too many requests, try again later" });
            }
            res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - count)));
            next();
        }
        catch (e) {
            // fail open if redis down
            next();
        }
    };
}
