import { Pool } from "pg";
import { env } from "./env.js";
// Neon Postgres — uses pooled connection string (DATABASE_URL)
// Falls back to in-memory mode if not configured (useful for local dev without Neon)
let pool = null;
export function getPool() {
    if (!env.DATABASE_URL || env.DATABASE_URL.includes("ep-xxx") || env.DATABASE_URL.includes("user:password@"))
        return null;
    if (!pool) {
        pool = new Pool({
            connectionString: env.DATABASE_URL,
            ssl: env.DATABASE_URL.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
            max: 10,
            idleTimeoutMillis: 30000,
        });
        pool.on("error", (err) => console.error("[db] pool error", err));
    }
    return pool;
}
export async function initDb() {
    const p = getPool();
    if (!p) {
        console.log("[db] DATABASE_URL not set — running in MEMORY mode (no Neon). Set DATABASE_URL for persistent Postgres.");
        return;
    }
    // Create tables if not exists — idempotent
    // ensure pgcrypto for gen_random_uuid
    await p.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      jti TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      replaced_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS profiles (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      headline TEXT,
      bio TEXT,
      location TEXT,
      education JSONB DEFAULT '{}'::jsonb,
      interests TEXT[] DEFAULT '{}',
      socials JSONB DEFAULT '{}'::jsonb,
      avatar_key TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      detailed_description TEXT,
      cover_image TEXT,
      technologies TEXT[] DEFAULT '{}',
      skills TEXT[] DEFAULT '{}',
      start_date DATE,
      end_date DATE,
      github_url TEXT,
      live_url TEXT,
      demo_video TEXT,
      role TEXT,
      featured BOOLEAN DEFAULT false,
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

    CREATE TABLE IF NOT EXISTS activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_name TEXT NOT NULL,
      category TEXT,
      organization TEXT,
      role TEXT,
      description TEXT,
      start_date DATE,
      end_date DATE,
      achievements TEXT,
      skills TEXT[] DEFAULT '{}',
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);

    CREATE TABLE IF NOT EXISTS certificates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      organization TEXT,
      issue_date DATE,
      credential_id TEXT,
      credential_url TEXT,
      skills TEXT[] DEFAULT '{}',
      document_key TEXT,
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

    CREATE TABLE IF NOT EXISTS courses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      provider TEXT,
      instructor TEXT,
      start_date DATE,
      completion_date DATE,
      description TEXT,
      skills TEXT[] DEFAULT '{}',
      certificate_id TEXT,
      credential_url TEXT,
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(user_id);

    CREATE TABLE IF NOT EXISTS experiences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      position TEXT NOT NULL,
      organization TEXT,
      location TEXT,
      start_date DATE,
      end_date DATE,
      current BOOLEAN DEFAULT false,
      description TEXT,
      achievements TEXT,
      skills TEXT[] DEFAULT '{}',
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_experiences_user ON experiences(user_id);

    CREATE TABLE IF NOT EXISTS achievements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT,
      organization TEXT,
      date DATE,
      description TEXT,
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);

    CREATE TABLE IF NOT EXISTS skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT CHECK (category IN ('Technical','Creative','Leadership','Communication','Languages','Other')),
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_skills_user ON skills(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_user_name ON skills(user_id, name);

    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT,
      mime_type TEXT,
      file_size INT,
      storage_key TEXT,
      category TEXT DEFAULT 'Other' CHECK (category IN ('Certificates','Projects','Awards','Other')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
  `);
    console.log("[db] Neon Postgres initialized — users, profiles, projects, activities, certificates, courses, experiences, achievements, skills, documents");
}
export async function query(text, params) {
    const p = getPool();
    if (!p)
        throw new Error("DATABASE_URL not configured — cannot query Neon");
    return p.query(text, params);
}
