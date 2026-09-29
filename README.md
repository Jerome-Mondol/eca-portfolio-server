# Proofolio Server — Express API (Neon + Upstash)

Intended architecture per spec §62:
```
Next.js (client) -> REST -> Express (this) -> Neon Postgres / Upstash Redis / R2 + AI Service
```

### Stack (MVP)
- **Neon Postgres** — pooled `DATABASE_URL` (serverless, `?sslmode=require`)
- **Upstash Redis** — `REDIS_URL=rediss://...` for rate limiting, refresh rotation, portfolio cache
- **Auth:** Access 15m (Bearer) + Refresh 7d (httpOnly, Secure, SameSite=Lax, Path=/api/auth) with rotation/revocation per spec §7
- **Security:** bcrypt 12, zod, helmet, cors(credentials), ownership guard, rate limit

### Quick Start (memory fallback — no Neon/Upstash needed for local dev)
```bash
npm install
npm run dev          # http://localhost:4000 — runs in MEMORY mode if env not set
# test
curl http://localhost:4000/api/health
```

### With Neon + Upstash
1. Create Neon project → copy pooled `DATABASE_URL` (Neon dashboard → Connection string → Pooled)
2. Create Upstash Redis → copy `REDIS_URL` (rediss://...)
3. Copy env:
```bash
cp .env.example .env
# edit .env with real DATABASE_URL, REDIS_URL, JWT secrets
```
4. Run:
```bash
npm run dev
# first run auto-creates tables: users, refresh_tokens (see src/config/db.ts)
```

### Env (see .env.example)
```
DATABASE_URL=postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require
REDIS_URL=rediss://default:TOKEN@HOST:6379
JWT_ACCESS_SECRET=32+ chars
JWT_REFRESH_SECRET=32+ chars
ACCESS_TOKEN_EXPIRES=15m
REFRESH_TOKEN_EXPIRES=7d
CLIENT_URL=http://localhost:3000
PORT=4000
```

### Auth Endpoints (spec §7)
```
POST /api/auth/register {fullName,email,username,password,confirmPassword} → {user, accessToken, refreshToken} + Set-Cookie proofolio_refresh
POST /api/auth/login {email,password} → {user, accessToken, refreshToken}
POST /api/auth/refresh (cookie proofolio_refresh or body.refreshToken) → {accessToken, refreshToken} // rotates, old revoked
POST /api/auth/logout (cookie or body) → clears cookie, revokes
GET  /api/auth/me  Authorization: Bearer <access> → {user}
```

- Refresh rotates: old jti revoked + denylisted in Redis until expiry (7d). Replay fails 401.
- Cookies: `httpOnly, Secure (prod), SameSite=Lax, Path=/api/auth, Max-Age=604800`

### Testing
```bash
# register
curl -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d '{"fullName":"John Doe","email":"john@example.com","username":"john-doe","password":"password123","confirmPassword":"password123"}' -i
# login + me
curl -X POST http://localhost:4000/api/auth/login -d '{"email":"john@example.com","password":"password123"}' -H "Content-Type: application/json"
curl http://localhost:4000/api/auth/me -H "Authorization: Bearer <access>"
```

See `../student_portfolio_platform_spec.md` §7, §51-59 for full spec.
