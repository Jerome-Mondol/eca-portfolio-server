import type { Response, CookieOptions } from "express";
import { env, isProd } from "../config/env.js";

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd, // true in prod (https), false locally (http)
    sameSite: "lax" as const, // allows top-level nav, stricter than none, works with CORS credentials
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d must match REFRESH_TOKEN_EXPIRES
  };
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(env.REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(env.REFRESH_COOKIE_NAME, { ...refreshCookieOptions(), maxAge: undefined });
}
