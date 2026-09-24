import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { env } from "../config/env.js";

export type AccessPayload = {
  sub: string; // userId
  username: string;
  email: string;
  jti: string;
};

export type RefreshPayload = {
  sub: string;
  jti: string;
};

export function signAccessToken(payload: Omit<AccessPayload, "jti">): string {
  const jti = randomUUID();
  return jwt.sign({ ...payload, jti }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES as any,
    issuer: "folio",
    audience: "folio-client",
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: "folio", audience: "folio-client" }) as AccessPayload;
}

export function signRefreshToken(userId: string): { token: string; jti: string; expiresAt: Date } {
  const jti = randomUUID();
  const expiresIn = env.REFRESH_TOKEN_EXPIRES;
  const token = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: expiresIn as any,
    issuer: "folio",
    audience: "folio-refresh",
  });
  const decoded = jwt.decode(token) as any;
  const expiresAt = new Date(decoded.exp * 1000);
  return { token, jti, expiresAt };
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: "folio", audience: "folio-refresh" }) as RefreshPayload;
}

export function decodeExpiry(token: string): Date | null {
  const d = jwt.decode(token) as any;
  if (!d?.exp) return null;
  return new Date(d.exp * 1000);
}
