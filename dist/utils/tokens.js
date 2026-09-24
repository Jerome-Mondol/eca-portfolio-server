import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { env } from "../config/env.js";
export function signAccessToken(payload) {
    const jti = randomUUID();
    return jwt.sign({ ...payload, jti }, env.JWT_ACCESS_SECRET, {
        expiresIn: env.ACCESS_TOKEN_EXPIRES,
        issuer: "folio",
        audience: "folio-client",
    });
}
export function verifyAccessToken(token) {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: "folio", audience: "folio-client" });
}
export function signRefreshToken(userId) {
    const jti = randomUUID();
    const expiresIn = env.REFRESH_TOKEN_EXPIRES;
    const token = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, {
        expiresIn: expiresIn,
        issuer: "folio",
        audience: "folio-refresh",
    });
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);
    return { token, jti, expiresAt };
}
export function verifyRefreshToken(token) {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: "folio", audience: "folio-refresh" });
}
export function decodeExpiry(token) {
    const d = jwt.decode(token);
    if (!d?.exp)
        return null;
    return new Date(d.exp * 1000);
}
