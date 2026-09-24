import { getPool } from "../config/db.js";

export type Profile = {
  userId: string;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  education?: any;
  interests?: string[] | null;
  socials?: any;
  avatarKey?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const memProfiles = new Map<string, Profile>();

function useDb() { return !!getPool(); }

export async function getProfile(userId: string): Promise<Profile | null> {
  if (useDb()) {
    const r = await getPool()!.query("SELECT user_id, headline, bio, location, education, interests, socials, avatar_key, created_at, updated_at FROM profiles WHERE user_id = $1", [userId]);
    if (!r.rows[0]) return null;
    const row = r.rows[0];
    return {
      userId: row.user_id,
      headline: row.headline,
      bio: row.bio,
      location: row.location,
      education: row.education,
      interests: row.interests,
      socials: row.socials,
      avatarKey: row.avatar_key,
      createdAt: row.created_at?.toISOString?.(),
      updatedAt: row.updated_at?.toISOString?.(),
    };
  }
  return memProfiles.get(userId) ?? null;
}

export async function upsertProfile(userId: string, data: Partial<Profile>): Promise<Profile> {
  if (useDb()) {
    const r = await getPool()!.query(
      `INSERT INTO profiles (user_id, headline, bio, location, education, interests, socials, avatar_key)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8)
       ON CONFLICT (user_id) DO UPDATE SET
         headline = COALESCE(EXCLUDED.headline, profiles.headline),
         bio = COALESCE(EXCLUDED.bio, profiles.bio),
         location = COALESCE(EXCLUDED.location, profiles.location),
         education = COALESCE(EXCLUDED.education, profiles.education),
         interests = COALESCE(EXCLUDED.interests, profiles.interests),
         socials = COALESCE(EXCLUDED.socials, profiles.socials),
         avatar_key = COALESCE(EXCLUDED.avatar_key, profiles.avatar_key),
         updated_at = NOW()
       RETURNING user_id, headline, bio, location, education, interests, socials, avatar_key, created_at, updated_at`,
      [userId, data.headline ?? null, data.bio ?? null, data.location ?? null, data.education ? JSON.stringify(data.education) : null, data.interests ?? null, data.socials ? JSON.stringify(data.socials) : null, data.avatarKey ?? null]
    );
    const row = r.rows[0];
    return {
      userId: row.user_id,
      headline: row.headline,
      bio: row.bio,
      location: row.location,
      education: row.education,
      interests: row.interests,
      socials: row.socials,
      avatarKey: row.avatar_key,
      createdAt: row.created_at?.toISOString?.(),
      updatedAt: row.updated_at?.toISOString?.(),
    };
  }
  const existing = memProfiles.get(userId) ?? { userId };
  const updated: Profile = {
    ...existing,
    headline: data.headline ?? existing.headline,
    bio: data.bio ?? existing.bio,
    location: data.location ?? existing.location,
    education: data.education ?? existing.education,
    interests: data.interests ?? existing.interests,
    socials: data.socials ?? existing.socials,
    avatarKey: data.avatarKey ?? existing.avatarKey,
    updatedAt: new Date().toISOString(),
  };
  memProfiles.set(userId, updated);
  return updated;
}
