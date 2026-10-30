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
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Optional boolean (`true`/`false`, default `false`). Set to `true` only if your PostgreSQL provider uses a publicly trusted certificate authority in its TLS chain. Managed providers like Supabase and Render PostgreSQL use private/internal CA chains; the default `false` maintains TLS wire encryption without failing CA verification. |
| `CORS_ORIGIN` | Comma-separated exact frontend origins, such as `https://inklly.vercel.app`. |
| `RAZORPAY_CREDENTIALS_ENCRYPTION_KEY` | Required before shops can save Razorpay credentials or developer webhook secrets. Generate a base64-encoded 32-byte key with `openssl rand -base64 32`; preserve it because rotating it makes saved secrets unreadable without an explicit re-encryption migration. |
| `INKLLY_RAZORPAY_KEY_ID` | Optional platform-owned Razorpay account Key ID for merchant SaaS monthly subscription checkout. This account is separate from each shop's payment account. Start with a Razorpay TEST account. |
| `INKLLY_RAZORPAY_KEY_SECRET` | Optional platform-owned Razorpay API secret. Keep it server-only and configure it with the matching platform Key ID. |
| `INKLLY_RAZORPAY_WEBHOOK_SECRET` | Optional signing secret for the platform Razorpay webhook. Configure Razorpay to call `https://<api-host>/api/v1/subscriptions/webhook/razorpay` for `payment.captured` or `order.paid`; checkout stays unavailable until the platform credentials and webhook secret are valid. |
| `STORAGE_DRIVER` | Set to `supabase` in production. The server refuses to fall back to ephemeral local disk. |
| `SUPABASE_URL` | HTTPS URL of the Supabase project that owns the private Storage bucket. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service role key. Never expose it to the browser or commit it. |
| `SUPABASE_STORAGE_BUCKET` | Existing bucket name, default `customer-print-files`. The bucket must be private; startup checks that `public` is false. |
| `MAX_CONCURRENT_PUBLIC_UPLOADS` | Optional per-process upload concurrency limit; defaults to `2` and is clamped to `1`–`8`. Requests over capacity receive HTTP 429 before JSON body parsing. This limit is per Render instance. |
| `PUBLIC_UPLOADS_PER_MINUTE` | Optional shared per-client upload limit per fixed minute; defaults to `30` and is clamped to `1`–`120`. Counters use atomic database upserts and HMAC-hashed client IP keys, so limits are shared across Render instances. |
| `PUBLIC_UPLOADS_PER_DAY` | Optional shared per-client upload limit per UTC day; defaults to `1000` and is clamped to `1`–`10000`. |
| `PUBLIC_ENQUIRY_LIMIT_PER_WINDOW` | Public enquiry submissions allowed per client IP in each window; defaults to `5`. This is per process, so use an edge/WAF limit as well when scaling to multiple instances. |
| `PUBLIC_ENQUIRY_WINDOW_MS` | Public enquiry rate-limit window in milliseconds; defaults to `600000` (10 minutes). |

Website enquiries are validated and saved to the configured database, and are visible to platform owners/admins in the Platform Console under **Website Enquiries**. The form does not send email or WhatsApp notifications; the inbox is the source for manual follow-up. Enquiry records contain contact details and message text, so define and enforce an approved retention period before production use.
| `ENABLE_EXTERNAL_API_ACCESS` | Leave unset or `false` until API product governance/security approval. Setting `true` enables developer key and webhook management on the server; set the matching public Vercel build variable `VITE_ENABLE_EXTERNAL_API_ACCESS=true` only after that approval. |

Render supplies `PORT`. If the database has no active platform owner, set `PLATFORM_OWNER_EMAIL` and a unique `PLATFORM_OWNER_PASSWORD` for bootstrap, then remove the password after provisioning. Payment provider credentials are entered per shop; do not set a shared platform Razorpay secret for customer checkout.

## Startup failure: JWT secret

If the log says `Production requires a JWT_SECRET of at least 32 bytes`, the build completed but the process is refusing to start because the secret is missing, too short, or equal to the example development value. Add a valid `JWT_SECRET` in Render, save the environment, and redeploy. Do not weaken the production check or use the development fallback.

## Deploy and verify

1. Confirm Render is deploying the current `main` commit, not an older revision.
2. Wait for the build and service health check to succeed. The build succeeding does not prove the server started correctly.
3. Check `GET /health` returns HTTP 200 and its `revision` equals the Git SHA Render is expected to run. Render supplies `RENDER_GIT_COMMIT`; the endpoint returns only this public revision, never runtime secrets.
4. Check `GET /api/v1/developer/keys` without an Authorization header returns HTTP 401. A 200 response indicates Render is running stale or incorrect code; do not use it with live customer data.
5. Log in with an authorized account, then verify the protected API and shop data persist across a service restart.

## File storage setup

Create the configured bucket in Supabase Storage as **private** before deploying. The service uploads and reads through Supabase's authenticated Storage API; neither the browser nor the agent receives a public object URL. Completed or cancelled order files are deleted after 24 hours, and unclaimed uploads are purged after 48 hours. Verify these behaviors against the production bucket before using real customer documents. Local disk remains available only for development/test runs.

If migrating an existing deployment from local disk, migrate any files that must be retained to the same shop-scoped object paths in the new bucket before switching `STORAGE_DRIVER`; database file keys are not rewritten during that switch.
