import dotenv from "dotenv";
dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  CLIENT_URL: process.env.CLIENT_URL ?? "http://localhost:3000",
  DATABASE_URL: process.env.DATABASE_URL ?? "", // Neon pooled URL
  REDIS_URL: process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_URL ?? "", // Upstash redis:// or rediss://
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-in-prod-32chars!",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-in-prod-32chars!",
  ACCESS_TOKEN_EXPIRES: process.env.ACCESS_TOKEN_EXPIRES ?? "15m",
  REFRESH_TOKEN_EXPIRES: process.env.REFRESH_TOKEN_EXPIRES ?? "7d",
  REFRESH_COOKIE_NAME: process.env.REFRESH_COOKIE_NAME ?? "folio_refresh",
  // Cloudflare R2 — for profile images and universal uploads
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? "",
  R2_BUCKET: process.env.R2_BUCKET ?? process.env.CLOUDFLARE_R2_BUCKET ?? process.env.R2_BUCKET_NAME ?? "",
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL ?? process.env.CLOUDFLARE_R2_PUBLIC_URL ?? "",
  R2_ENDPOINT: process.env.R2_ENDPOINT ?? "", // optional override, default https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  // AI — certificate extraction + research (spec §20, §54)
  // Free tier: no card, ~1500 req/day, ~500/day when Google Search grounding is used.
  // NOTE: on the free tier Google may use submitted images/text to improve its models.
  // The paid tier does not. Only the issuing organization name is ever sent — never
  // the student's name — but be aware of this before onboarding real users.
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
};

export const isProd = env.NODE_ENV === "production";
