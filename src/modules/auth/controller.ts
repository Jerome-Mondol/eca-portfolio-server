import type { Request, Response } from "express";
import { registerSchema, loginSchema, zodErrorMessage } from "../../utils/validation.js";
import { hashPassword, verifyPassword } from "../../utils/hash.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/tokens.js";
import { setRefreshCookie, clearRefreshCookie } from "../../utils/cookies.js";
import { findUserByEmail, findUserByUsername, findUserById, createUser } from "../../stores/userStore.js";
import { saveRefreshToken, findRefreshToken, revokeRefreshToken, revokeAllForUser } from "../../stores/tokenStore.js";
import { env } from "../../config/env.js";
import type { AuthedRequest } from "../../middleware/auth.js";

function userToSafe(user: { id: string; email: string; username: string; fullName: string; createdAt: string }) {
  return { id: user.id, email: user.email, username: user.username, fullName: user.fullName, createdAt: user.createdAt };
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) });
  const { fullName, email, username, password } = parsed.data;

  const emailLower = email.toLowerCase();
  const usernameLower = username.toLowerCase();

  if (await findUserByEmail(emailLower)) return res.status(409).json({ message: "Email already registered" });
  if (await findUserByUsername(usernameLower)) return res.status(409).json({ message: "Username already taken" });

  const passwordHash = await hashPassword(password);
  const user = await createUser({ email: emailLower, username: usernameLower, passwordHash, fullName });

  // auto-login: issue tokens
  const accessToken = signAccessToken({ sub: user.id, username: user.username, email: user.email });
  const { token: refreshToken, jti, expiresAt } = signRefreshToken(user.id);
  await saveRefreshToken(jti, user.id, expiresAt);
  setRefreshCookie(res, refreshToken);

  return res.status(201).json({
    user: userToSafe(user),
    accessToken,
    // also return refresh for non-cookie clients (optional)
    refreshToken,
  });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) });
  const { email, password } = parsed.data;
  const user = await findUserByEmail(email.toLowerCase());
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const accessToken = signAccessToken({ sub: user.id, username: user.username, email: user.email });
  const { token: refreshToken, jti, expiresAt } = signRefreshToken(user.id);
  await saveRefreshToken(jti, user.id, expiresAt);
  setRefreshCookie(res, refreshToken);

  return res.json({ user: userToSafe(user), accessToken, refreshToken });
}

export async function refresh(req: Request, res: Response) {
  // Prefer httpOnly cookie, fallback to body.refreshToken for API clients
  const cookieToken = (req as any).cookies?.[env.REFRESH_COOKIE_NAME] as string | undefined;
  const bodyToken = (req.body?.refreshToken as string | undefined);
  const token = cookieToken ?? bodyToken;
  if (!token) return res.status(401).json({ message: "Missing refresh token" });

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const stored = await findRefreshToken(payload.jti);
  if (!stored) return res.status(401).json({ message: "Refresh token revoked or expired" });
  if (stored.userId !== payload.sub) return res.status(401).json({ message: "Token mismatch" });

  // rotation: revoke old, issue new
  const { token: newRefresh, jti: newJti, expiresAt } = signRefreshToken(payload.sub);
  await revokeRefreshToken(payload.jti, newJti);
  await saveRefreshToken(newJti, payload.sub, expiresAt);
  setRefreshCookie(res, newRefresh);

  const user = await findUserById(payload.sub);
  if (!user) return res.status(401).json({ message: "User not found" });

  const newAccess = signAccessToken({ sub: user.id, username: user.username, email: user.email });
  return res.json({ accessToken: newAccess, refreshToken: newRefresh });
}

export async function logout(req: Request, res: Response) {
  const cookieToken = (req as any).cookies?.[env.REFRESH_COOKIE_NAME] as string | undefined;
  const bodyToken = (req.body?.refreshToken as string | undefined);
  const token = cookieToken ?? bodyToken;
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await revokeRefreshToken(payload.jti);
    } catch {
      // ignore invalid token on logout
    }
  }
  clearRefreshCookie(res);
  // Optional: if Authorization present, also revoke all? We keep single-token revoke for MVP
  return res.json({ message: "Logged out" });
}

export async function me(req: AuthedRequest, res: Response) {
  const userId = req.user!.sub;
  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json({ user: userToSafe(user) });
}
