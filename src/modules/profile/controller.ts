import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { profileSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/profileStore.js";
import { findUserById, updateUser } from "../../stores/userStore.js"
import { z } from "zod";
import { redisGet, redisSet, redisDel } from "../../config/redis.js";
import { clearDashboardCache } from "../dashboard/controller.js";

/** Process-local tier so the profile page does not wait on Redis on every visit. */
const mem = new Map<string, { data: unknown; expires: number }>();
const PROFILE_FRESH_MS = 60_000;
const PROFILE_STALE_MS = 300_000;
const profileKey = (userId: string) => `profile:${userId}`;

function clearProfileCache(userId: string) {
  const key = profileKey(userId);
  mem.delete(key);
  mem.delete(`${key}:stale`);
  void redisDel(key).catch(() => {});
  void redisDel(`${key}:stale`).catch(() => {});
}

async function loadProfile(userId: string) {
  const user = await findUserById(userId);
  const profile = await store.getProfile(userId);
  return {
    user: user ? { id: user.id, email: user.email, username: user.username, fullName: user.fullName } : null,
    profile: profile ?? {},
  };
}

export async function getProfile(req: AuthedRequest, res: Response) {
  const userId = req.user!.sub;
  const key = profileKey(userId);

  // Per-user payload requested with an Authorization header: `public` would let
  // a shared cache store it and serve it to the next visitor.
  res.setHeader("Cache-Control", "private, no-store");

  const fresh = mem.get(key);
  if (fresh && Date.now() < fresh.expires) {
    res.setHeader("X-Cache", "HIT-MEM");
    return res.json(fresh.data);
  }
  const staleMem = mem.get(`${key}:stale`);
  if (staleMem && Date.now() < staleMem.expires) {
    res.setHeader("X-Cache", "STALE-MEM");
    setImmediate(async () => {
      try {
        const body = await loadProfile(userId);
        const now = Date.now();
        mem.set(key, { data: body, expires: now + PROFILE_FRESH_MS });
        mem.set(`${key}:stale`, { data: body, expires: now + PROFILE_STALE_MS });
        await redisSet(key, JSON.stringify(body), PROFILE_FRESH_MS / 1000);
        await redisSet(`${key}:stale`, JSON.stringify(body), PROFILE_STALE_MS / 1000);
      } catch {}
    });
    return res.json(staleMem.data);
  }

  try {
    const cached = await redisGet(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      mem.set(key, { data: parsed, expires: now + PROFILE_FRESH_MS });
      mem.set(`${key}:stale`, { data: parsed, expires: now + PROFILE_STALE_MS });
      res.setHeader("X-Cache", "HIT");
      return res.json(parsed);
    }
  } catch {}

  const body = await loadProfile(userId);
  const now = Date.now();
  mem.set(key, { data: body, expires: now + PROFILE_FRESH_MS });
  mem.set(`${key}:stale`, { data: body, expires: now + PROFILE_STALE_MS });
  try { await redisSet(key, JSON.stringify(body), PROFILE_FRESH_MS / 1000); } catch {}
  res.setHeader("X-Cache", "MISS");
  res.json(body);
}

export async function upsertProfile(req: AuthedRequest, res: Response) {
  // Allow fullName/username alongside profile fields — universal update
  const body = req.body as any;
  const userId = req.user!.sub;

  // Handle user fields separately (fullName editable)
  let updatedUser = null;
  if (body.fullName !== undefined || body.username !== undefined) {
    const userUpdateSchema = z.object({
      fullName: z.string().min(2).max(80).optional(),
      username: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/).optional(),
    });
    const uParsed = userUpdateSchema.safeParse({ fullName: body.fullName, username: body.username });
    if (!uParsed.success) return res.status(400).json({ message: zodErrorMessage(uParsed.error) });
    try {
      updatedUser = await updateUser(userId, { fullName: uParsed.data.fullName, username: uParsed.data.username });
    } catch (e: any) {
      return res.status(409).json({ message: e.message });
    }
  }

  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) });
  const updated = await store.upsertProfile(userId, {
    headline: parsed.data.headline ?? undefined,
    bio: parsed.data.bio ?? undefined,
    location: parsed.data.location ?? undefined,
    education: parsed.data.education ?? undefined,
    interests: parsed.data.interests ?? undefined,
    socials: parsed.data.socials ?? undefined,
    avatarKey: parsed.data.avatarKey ?? undefined,
  });
  const user = updatedUser ?? (await findUserById(userId));
  try { clearProfileCache(userId); await clearDashboardCache(userId); } catch {}
  res.json({ profile: updated, user: user ? { id: user.id, email: user.email, username: user.username, fullName: user.fullName } : null });
}
