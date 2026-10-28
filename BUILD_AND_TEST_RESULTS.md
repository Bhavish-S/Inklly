# Inkly Build and Test Evidence

**Last verified:** 2026-10-28 (local workspace, Asia/Kolkata)

## Current local verification

- `npm run build` — passed for database, shared, desktop agent, server, and web workspaces using Vite 6.4.5. The main JavaScript bundle is 1,174.46 kB minified (309.72 kB gzip) and triggers Vite's 500 kB chunk warning; the build completes successfully.
- `npm test` — 202 passed, 0 failed: database 9, shared 13, agent 12, server 168.
- `npm audit --audit-level=high` — passed with 0 vulnerabilities.
- `npm run lint` — no root lint script is currently configured.

The test suite covers deterministic Paise pricing, tenant boundaries, active-account and current-membership authorization, signed/revocable sessions, customer order and payment paths, private-storage behavior through a mocked Supabase API, merchant vault uploads/downloads/deletion/tenant isolation and retention, printer ownership migrations, append-only ledger enforcement and duplicate provider-transaction rejection, agent result persistence, dispatch replay/acknowledgment, expired handoff safety, paired-origin file downloads, crash-to-`OUTPUT_UNCERTAIN` recovery, developer-key scope validation/verifier redaction, and encrypted webhook-secret migration/storage.

The print-release path now requires an online registered shop printer (or exactly one online default), assigns the target to every unassigned print job in the same transaction as order state changes, and excludes unassigned/offline targets from agent polling. Agent heartbeats synchronize inventory under the paired agent identity, so agents receive only their own queue's jobs. The Live Print screen and order printer selector consume API inventory instead of displaying sample devices. Printer discovery no longer invents HP/Canon devices, and a successful Sumatra process reports spooler submission rather than confirmed physical output.

Agent document downloads require the paired API origin and exact agent-file route, reject redirects and unsupported content types, cap responses at 35 MiB, validate file signatures, and use random exclusive mode-0600 temporary files. Download validation failures are reported as `FAILED` before submission; unexpected exceptions after dispatch begins are persisted as `OUTPUT_UNCERTAIN`. The background worker serializes its cycles, bounds network waits, and drains active work before closing the local queue. Local jobs found in `DISPATCHED_TO_SPOOLER` on restart become reportable `OUTPUT_UNCERTAIN` results and are never automatically retried. Merchant authentication now rejects inactive users and refreshes shop role/permissions from the current membership on each request.

The platform admin agent fleet is loaded from persisted registrations, shop assignments, printer ownership, and server-side command attempts. Admin plan counts and tiers load from platform APIs; the console no longer fabricates installer files, incidents, runtime saves, plan pricing, or tenant hardware details. These unavailable workflows are explicitly labelled. Online/stale status is derived from the 45-second heartbeat window; the UI no longer invents agent records or reports a fake ping. Platform GMV now reflects the payment ledger exactly (including zero), MRR is unavailable while billing is unconfigured, and the database engine label reflects the active adapter.

Platform merchant onboarding now transactionally provisions an inactive owner, organization, shop, baseline paise rate rules, seven-day trial, hashed 48-hour invitation, and audit event. The owner sets a strong password using a single-use invitation; the raw token is returned once with `Cache-Control: no-store`. API tests cover role gating, validation, persistence, expiry, replay rejection, activation, and login. Merchant printer health is derived from heartbeat freshness, and stale or unknown printers cannot receive print dispatch. Rate rules reject printer IDs outside the authenticated shop.

Developer API keys are bound to the issuing user and shop, require `ENABLE_EXTERNAL_API_ACCESS=true`, and are checked for environment, expiry, revocation, active membership, and least-privilege scopes. Key verifier hashes are omitted from creation and listing responses. Developer webhook secrets use purpose-bound AES-256-GCM encryption at rest; legacy plaintext rows are transactionally migrated and creation fails closed if the stable encryption key is unavailable. Registration requires HTTPS, rejects literal IPs and local hostnames, and validates supported events. The webhook explorer accurately labels its operation as an unsigned, local synthetic preview. Durable signed delivery, DNS-pinned SSRF-safe dispatch, retry history, and rotation/revocation are not implemented.

WhatsApp Cloud API onboarding and message delivery are unavailable. The merchant screen contains no simulated QR or connected-account state; setup writes and pairing requests return HTTP 503 until secure Meta onboarding, credential storage, and delivery are implemented.

## Deployment and integration limits

- These results are from the current local source tree, built after the merchant vault and platform-console honesty changes. The latest checked-in baseline is `0ac3f47`; platform-console changes in this verification are not yet published. Vercel serves the frontend from published commit `0ac3f47`; the current local admin-console changes build to `assets/index-Cj61txgf.js` and are not published yet. Render `/health` returned HTTP 200 but omitted the `revision` field emitted by current source; its live OpenAPI document contained seven paths, with no merchant storage routes. Render is still serving an older backend revision. The live `/api/v1/portal/shop/campus1` endpoint returns HTTP 404; the deployed customer path is unusable until the backend is updated and the correct tenant is provisioned.
- The latest Render log connected to Supabase PostgreSQL and then exited because Supabase Storage settings are missing or invalid. The current source reports the specific invalid settings; the supplied deployed log has an older generic error, so its revision is unverified.
- Supabase Storage tests mock the HTTP API. Live bucket permissions and file retention have not been verified against the production project.
- Razorpay tests use test doubles; a live sandbox checkout/webhook round trip has not been verified here.
- Subscription checkout and per-successfully-printed-side SaaS billing are not implemented.
- The desktop agent refuses physical printing by default. If explicitly enabled, it requires an exact fresh online local queue match and rejects unsupported mixed-color, manual-duplex, or multi-up requests; real printer output, hardware status/capability accuracy, OS queue reconciliation, and post-spool outcome confirmation still require Windows hardware verification.
- Agent ticket polling is now gated by merchant release status and verified online payment. The server integration test confirms an unreviewed customer order is withheld and becomes pollable after release. The full agent-to-Windows-spooler lifecycle is not verified on physical hardware.
- The merchant dashboard uses grouped order-status counts and returns at most five hydrated recent orders; live print refresh is paginated. Revenue sums the customer-payment ledger. Tests cover aggregate counts and confirm a collected-but-unpaid order does not increase revenue.
- Merchant storage category and document tables are present in the generated schema; a versioned migration upgrades existing SQLite and PostgreSQL databases and a test checks migration registration and table presence. Live PostgreSQL migration/startup is not yet verified.
- Merchant vault files are distinct from temporary order uploads and remain until staff delete them. The retention sweep now recognizes database-referenced vault objects and only applies 24-hour completed-order deletion to order files.
- Browser visual/E2E testing was not run; the local browser surface was unavailable in this session.
- PostgreSQL migration and transaction behavior for the latest API-key and nested-order-transaction changes have not been verified against the live Supabase database.
- PostgreSQL ledger triggers and provider-transaction uniqueness have not been verified against Supabase. Migration v10 fails closed if existing duplicate provider transaction IDs are found; inspect production data before deployment.

## Reproduction

Run from this directory:

```sh
npm run build
npm test
```
