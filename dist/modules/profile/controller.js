import { profileSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/profileStore.js";
import { findUserById } from "../../stores/userStore.js";
export async function getProfile(req, res) {
    const userId = req.user.sub;
    const user = await findUserById(userId);
    const profile = await store.getProfile(userId);
    res.json({ user: user ? { id: user.id, email: user.email, username: user.username, fullName: user.fullName } : null, profile: profile ?? {} });
}
export async function upsertProfile(req, res) {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: zodErrorMessage(parsed.error) });
    const userId = req.user.sub;
    const updated = await store.upsertProfile(userId, {
        headline: parsed.data.headline ?? undefined,
        bio: parsed.data.bio ?? undefined,
        location: parsed.data.location ?? undefined,
        education: parsed.data.education ?? undefined,
        interests: parsed.data.interests ?? undefined,
        socials: parsed.data.socials ?? undefined,
        avatarKey: parsed.data.avatarKey ?? undefined,
    });
    res.json({ profile: updated });
}
