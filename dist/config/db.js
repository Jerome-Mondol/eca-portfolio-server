import { Pool } from "pg";
import { env } from "./env.js";
// Neon Postgres — pooled, eager warmup for near-instant queries (avoids cold start)
let pool = null;
let warmupDone = false;
export function getPool() {
    if (!env.DATABASE_URL || env.DATABASE_URL.includes("ep-xxx") || env.DATABASE_URL.includes("user:password@"))
        return null;
    if (!pool) {
        // Strip query params unsupported by node-postgres (like channel_binding)
        let connStr = env.DATABASE_URL.replace(/([?&])channel_binding=[^&]*&?/g, "$1").replace(/[?&]$/, "");
        const newPool = new Pool({
            connectionString: connStr,
            ssl: connStr.includes("neon.tech") || connStr.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
            max: 10,
            idleTimeoutMillis: 15000,
            connectionTimeoutMillis: 10000,
            keepAlive: true,
            keepAliveInitialDelayMillis: 5000,
        });
        newPool.on("error", (err) => {
            console.warn("[db] pool idle error (will reconnect on next query):", err.message);
        });
        // Wrap query to automatically retry once on connection termination or socket timeout
        const originalQuery = newPool.query.bind(newPool);
        newPool.query = async function (text, params, callback) {
            try {
                return await originalQuery(text, params, callback);
            }
            catch (err) {
                const isConnErr = err?.message?.includes("Connection terminated") ||
                    err?.message?.includes("timeout") ||
                    err?.code === "ECONNRESET" ||
                    err?.code === "57P01" ||
                    err?.code === "57P02";
                if (isConnErr) {
                    console.warn("[db] Connection dropped/timed out, retrying query once...", err.message);
                    return await originalQuery(text, params, callback);
                }
                throw err;
            }
        };
        pool = newPool;
        // eager warmup — fire once, don't block
        if (!warmupDone) {
            warmupDone = true;
            pool.query("SELECT 1").then(() => console.log("[db] warmup ok")).catch((e) => console.warn("[db] warmup failed:", e.message));
        }
    }
    return pool;
}
// Eager init on import — warms Neon even before first request
if (env.DATABASE_URL && !env.DATABASE_URL.includes("ep-xxx")) {
    getPool();
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
      links JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
    -- ensure links column exists for existing DBs
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='links') THEN
        ALTER TABLE projects ADD COLUMN links JSONB DEFAULT '[]'::jsonb;
      END IF;
    END $$;

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
      images TEXT[] DEFAULT '{}',
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='images') THEN
        ALTER TABLE activities ADD COLUMN images TEXT[] DEFAULT '{}';
      END IF;
    END $$;

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
      document_name TEXT,
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='certificates' AND column_name='document_name') THEN
        ALTER TABLE certificates ADD COLUMN document_name TEXT;
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='certificates' AND column_name='ai_analysis') THEN
        ALTER TABLE certificates ADD COLUMN ai_analysis JSONB;
      END IF;
    END $$;
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
      images TEXT[] DEFAULT '{}',
      visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','private')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='achievements' AND column_name='images') THEN
        ALTER TABLE achievements ADD COLUMN images TEXT[] DEFAULT '{}';
      END IF;
    END $$;

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
