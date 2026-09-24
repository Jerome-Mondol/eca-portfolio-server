import type { Request, Response, NextFunction } from "express";
import { redisIncrWithExpire } from "../config/redis.js";

// Simple sliding window rate limiter backed by Upstash Redis (or memory fallback)

export function rateLimit({ windowSeconds, max, keyPrefix }: { windowSeconds: number; max: number; keyPrefix: string }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const key = `rl:${keyPrefix}:${ip}`;
    try {
      const count = await redisIncrWithExpire(key, windowSeconds);
      if (count > max) {
        return res.status(429).json({ message: "Too many requests, try again later" });
      }
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - count)));
      next();
    } catch (e) {
      // fail open if redis down
      next();
    }
  };
}
