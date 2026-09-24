import dotenv from "dotenv";
dotenv.config();
function requireEnv(name, fallback) {
    const v = process.env[name] ?? fallback;
    if (!v)
        throw new Error(`Missing env ${name}`);
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
};
export const isProd = env.NODE_ENV === "production";
