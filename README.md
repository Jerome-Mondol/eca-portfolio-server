# Proofolio Server

The server is Proofolio's Express REST API. It provides authentication, portfolio data, uploads, public portfolio data, and AI-assisted features.

## Stack

- Node.js, Express, and TypeScript
- PostgreSQL via pg
- Redis-compatible Upstash Redis for shared cache and rate-limit state
- Cloudflare R2 for durable file storage
- Google Gemini for certificate analysis and project-description suggestions

## Requirements

- Node.js and npm
- PostgreSQL for persistent data
- Optional services: Redis, Cloudflare R2, and a Gemini API key

The API can run without PostgreSQL or Redis, using in-memory fallbacks. In-memory data disappears when the server restarts and is unsuitable for production.

## Local setup

From the repository root:

    cd website/server
    npm ci

Copy the environment template:

    cp .env.example .env

Windows PowerShell:

    Copy-Item .env.example .env

Edit .env before using any integrations. The example contains placeholders. A basic local run can use memory mode with optional services unset. For persistence, configure DATABASE_URL; for AI, configure GEMINI_API_KEY; for durable uploaded files, configure R2.

Start the API:

    npm run dev

The default API address is http://localhost:4000. Check http://localhost:4000/api/health. Run the client separately; its default API URL is http://localhost:4000.

## Environment variables

The server loads website/server/.env with dotenv. Defaults below reflect the current configuration.

| Variable | Required | Description |
| --- | --- | --- |
| PORT | No | API port; defaults to 4000. |
| NODE_ENV | No | Runtime mode; defaults to development. Use production when deployed. |
| CLIENT_URL | No | CORS-allowed client origin; defaults to http://localhost:3000. Set the exact deployed origin. |
| DATABASE_URL | No for memory mode | PostgreSQL connection string. Neon pooled URLs are supported. Without a usable URL, portfolio data uses memory fallback. |
| REDIS_URL | No | Redis connection string, usually an Upstash rediss:// URL. UPSTASH_REDIS_URL is an accepted alias. Without Redis, cache and rate-limit state use memory. |
| JWT_ACCESS_SECRET | Replace before deployment | Access-token signing secret. The code includes a development default; use a long, random secret when deployed. |
| JWT_REFRESH_SECRET | Replace before deployment | Refresh-token signing secret. Use a different long, random value from the access secret. |
| ACCESS_TOKEN_EXPIRES | No | Access-token lifetime; defaults to 15m. |
| REFRESH_TOKEN_EXPIRES | No | Refresh-token lifetime; defaults to 7d. |
| REFRESH_COOKIE_NAME | No | Refresh cookie name; defaults to proofolio_refresh. |
| R2_ACCOUNT_ID | No | Cloudflare account ID; CLOUDFLARE_ACCOUNT_ID is an alias. |
| R2_ACCESS_KEY_ID | No | R2 access key; CLOUDFLARE_R2_ACCESS_KEY_ID is an alias. |
| R2_SECRET_ACCESS_KEY | No | R2 secret; CLOUDFLARE_R2_SECRET_ACCESS_KEY is an alias. |
| R2_BUCKET | No | R2 bucket; CLOUDFLARE_R2_BUCKET and R2_BUCKET_NAME are aliases. |
| R2_PUBLIC_URL | No | Public base URL for objects; CLOUDFLARE_R2_PUBLIC_URL is an alias. If unset, the API proxy URL is used. |
| R2_ENDPOINT | No | Optional S3-compatible endpoint override. |
| GEMINI_API_KEY | No for non-AI features | Google AI Studio key for certificate analysis and project-description suggestions. |
| GEMINI_MODEL | No | Primary Gemini model; defaults to gemini-2.5-flash. Fallback models are used after transient errors. |

Do not commit .env or expose server credentials in client-side variables. Replace every placeholder with a real value before connecting an integration.

### Minimal local .env

    PORT=4000
    NODE_ENV=development
    CLIENT_URL=http://localhost:3000
    JWT_ACCESS_SECRET=replace-with-a-long-random-local-secret
    JWT_REFRESH_SECRET=use-a-different-long-random-local-secret

### PostgreSQL

Set DATABASE_URL to a valid PostgreSQL connection string to persist accounts and portfolio records. For Neon, use the pooled connection string and the SSL settings supplied by Neon. On startup, the server runs idempotent schema initialization.

The db field in /api/health indicates whether DATABASE_URL is configured; it is not a live database readiness check.

### Redis

Redis is optional for local development. A valid REDIS_URL enables shared cache and rate-limit state. Without Redis, these features use process memory and are not shared across server instances.

### Cloudflare R2

Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET to enable R2 storage. R2_PUBLIC_URL is optional. Without R2, or if an upload fails, uploaded files fall back to memory and do not survive a restart.

### Gemini

Set GEMINI_API_KEY to enable AI endpoints. Requests require an authenticated user. Certificate analysis accepts supported images or PDFs up to 10 MB. Review Google's data-use terms before submitting real or sensitive documents; the .env.example file includes a free-tier privacy note.

## API overview

All routes are under /api.

| Feature | Base path | Notes |
| --- | --- | --- |
| Health | /api/health | Reports API and configured integration flags |
| Authentication | /api/auth | Registration, login, refresh, logout, current user |
| Dashboard | /api/dashboard | Student dashboard summary |
| Public portfolio | /api/portfolio | Public portfolio data |
| Profile | /api/profile | Profile management |
| Projects | /api/projects | Project records |
| Activities | /api/activities and /api/eca | Extracurricular activities |
| Courses | /api/courses | Course records |
| Certificates | /api/certificates | Certificate records |
| Experience | /api/experiences | Experience records |
| Achievements | /api/achievements | Achievement records |
| Skills | /api/skills | Skill records |
| Documents | /api/documents | Document metadata |
| Uploads | /api/upload | Image and PDF uploads |
| AI | /api/ai | Certificate analysis and project-description suggestions |
| Cron | /api/cron | Scheduler endpoint |

The users and analytics modules currently return 501 Not Implemented.

## Scripts

| Command | Purpose |
| --- | --- |
| npm run dev | Run TypeScript server in tsx watch mode |
| npm run build | Compile TypeScript to dist/ |
| npm start | Run the compiled server from dist/app.js |

Production run:

    npm run build
    npm start

## Architecture and behavior

- src/app.ts configures middleware and mounts API routers.
- src/modules/ contains feature routes and handlers.
- src/stores/ contains portfolio data access.
- src/config/ configures PostgreSQL, Redis, R2, and Gemini.
- Refresh-token cookies are HTTP-only, SameSite=Lax, and Secure in production. Use compatible HTTPS origins for the client and API in deployment.
- AI project descriptions are suggestions and are not saved automatically; students choose whether to use them.
- Uploads and AI file analysis accept supported file types up to 10 MB.

## Troubleshooting

- **Client cannot reach API:** Confirm the server is running and check NEXT_PUBLIC_API_URL in website/client/.env.local.
- **CORS error:** Set CLIENT_URL to the exact client origin, including scheme and port, then restart the API.
- **Data disappears:** Confirm DATABASE_URL is valid and does not contain a template placeholder. Memory data is lost on restart.
- **Redis connection errors:** Verify REDIS_URL and network access. Redis is optional; memory fallback remains available.
- **Uploads disappear after restart:** Configure Cloudflare R2 for durable storage.
- **AI says it is not configured:** Add a valid GEMINI_API_KEY to .env and restart.
- **AI requests are slow:** Certificate analysis may take several seconds while it processes a document and checks the issuer.

## Deployment checklist

- Replace the development JWT secrets with separate, high-entropy values.
- Set NODE_ENV=production and CLIENT_URL to the deployed frontend origin.
- Use a persistent PostgreSQL database and shared Redis for multi-instance deployments.
- Configure R2 for durable uploads.
- Use HTTPS for both client and API so secure refresh cookies work.
- Keep all provider credentials on the server.
- Review Gemini data-use terms and obtain consent before processing real student documents.
