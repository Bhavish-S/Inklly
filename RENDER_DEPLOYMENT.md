# Render API Deployment

## Required service configuration

Create or update the Render web service using the repository root as its root directory:

- Build command: `npm install && npm run build:render`
- Start command: `node apps/server/dist/index.js`
- Runtime: Node.js 24 or a compatible supported Node.js release

Set these values in Render's Environment settings. Never commit their values to Git or paste them into support logs.

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Generate a unique random secret: `openssl rand -base64 48`. Keep it stable across restarts and instances. It must be at least 32 bytes; rotating it invalidates current sessions. |
| `DATABASE_URL` | Supabase PostgreSQL connection string for the production database. Use the connection method supported by the deployed network and keep the password private. |
| `CORS_ORIGIN` | Comma-separated exact frontend origins, such as `https://inklly.vercel.app`. |
| `RAZORPAY_CREDENTIALS_ENCRYPTION_KEY` | Required before shops can save Razorpay credentials. Generate a base64-encoded 32-byte key with `openssl rand -base64 32`; preserve it because rotating it makes saved credentials unreadable. |

Render supplies `PORT`. If the database has no active platform owner, set `PLATFORM_OWNER_EMAIL` and a unique `PLATFORM_OWNER_PASSWORD` for bootstrap, then remove the password after provisioning. Payment provider credentials are entered per shop; do not set a shared platform Razorpay secret for customer checkout.

## Startup failure: JWT secret

If the log says `Production requires a JWT_SECRET of at least 32 bytes`, the build completed but the process is refusing to start because the secret is missing, too short, or equal to the example development value. Add a valid `JWT_SECRET` in Render, save the environment, and redeploy. Do not weaken the production check or use the development fallback.

## Deploy and verify

1. Confirm Render is deploying the current `main` commit, not an older revision.
2. Wait for the build and service health check to succeed. The build succeeding does not prove the server started correctly.
3. Check `GET /health` returns HTTP 200.
4. Check `GET /api/v1/developer/keys` without an Authorization header returns HTTP 401. A 200 response indicates Render is running stale or incorrect code; do not use it with live customer data.
5. Log in with an authorized account, then verify the protected API and shop data persist across a service restart.

## Current storage limitation

Customer uploads currently use the server's local `uploads/` directory. This is not durable private object storage on an ephemeral Render instance. Do not use real or sensitive customer documents in production until private persistent storage and the configured 24-hour post-completion deletion workflow have been deployed and verified. The `UPLOAD_DIR` and `STORAGE_DRIVER` sample variables do not currently enable an object-storage provider.
