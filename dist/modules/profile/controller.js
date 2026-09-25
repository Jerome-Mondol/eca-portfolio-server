import { profileSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/profileStore.js";
import { findUserById, updateUser } from "../../stores/userStore.js";
import { z } from "zod";
import { redisGet, redisSet, redisDel } from "../../config/redis.js";
import { clearDashboardCache } from "../dashboard/controller.js";
export async function getProfile(req, res) {
    const userId = req.user.sub;
    const key = `profile:${userId}`;
    try {
        const cached = await redisGet(key);
        if (cached) {
            res.setHeader("X-Cache", "HIT");
            return res.json(JSON.parse(cached));
        }
    }
    catch { }
    const user = await findUserById(userId);
    const profile = await store.getProfile(userId);
    const body = { user: user ? { id: user.id, email: user.email, username: user.username, fullName: user.fullName } : null, profile: profile ?? {} };
    try {
        await redisSet(key, JSON.stringify(body), 30);
    }
    catch { }
    res.setHeader("X-Cache", "MISS");
    res.json(body);
}
export async function upsertProfile(req, res) {
    // Allow fullName/username alongside profile fields — universal update
    const body = req.body;
    const userId = req.user.sub;
    // Handle user fields separately (fullName editable)
    let updatedUser = null;
    if (body.fullName !== undefined || body.username !== undefined) {
        const userUpdateSchema = z.object({
            fullName: z.string().min(2).max(80).optional(),
            username: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/).optional(),
        });
        const uParsed = userUpdateSchema.safeParse({ fullName: body.fullName, username: body.username });
        if (!uParsed.success)
            return res.status(400).json({ message: zodErrorMessage(uParsed.error) });
        try {
            updatedUser = await updateUser(userId, { fullName: uParsed.data.fullName, username: uParsed.data.username });
        }
        catch (e) {
            return res.status(409).json({ message: e.message });
        }
    }
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: zodErrorMessage(parsed.error) });
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
    try {
        await redisDel(`profile:${userId}`);
        await clearDashboardCache(userId);
    }
    catch { }
    res.json({ profile: updated, user: user ? { id: user.id, email: user.email, username: user.username, fullName: user.fullName } : null });
}
