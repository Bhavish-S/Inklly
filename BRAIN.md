# Inklly engineering context

**Last checked:** 2026-10-29 (Asia/Kolkata)

This file is an orientation guide, not a release certification. Older feature inventories in this repository included UI-only controls and simulated integrations; use current source, tests, and runtime evidence before describing a feature as live.

## Product and scope

Inklly serves existing print shops and photocopy businesses. The core workflow is counter QR ordering, server-side document inspection and quotes, merchant review, authorized dispatch to a paired desktop agent, and pickup at the shop. India launch money is INR in integer Paise. Kiosk, franchise, delivery, and space-sharing workflows are out of scope.

Safety requirements:

- Never use floating-point arithmetic for amounts. The shared pricing engine is the canonical print quote implementation.
- An ambiguous spooler result is `OUTPUT_UNCERTAIN`. Never automatically retry it; require operator reconciliation.
- Derive merchant tenant scope from the authenticated membership. Client-provided shop IDs are not authorization.
- Distinguish provider acceptance, spooler submission, and confirmed physical output. Do not imply a printer produced paper unless the system can prove it.
- Treat all payment, printer, WhatsApp, webhook, installer, and billing integrations as unavailable until end-to-end evidence exists.

## Repository map

The active application is this nested `Source Code` npm-workspaces monorepo:

- `apps/web`: React/TypeScript/Vite public site, QR customer portal, merchant workspace, platform console, and developer portal.
- `apps/server`: Express/TypeScript REST API, authentication, merchant workflows, payments, platform and developer routes, and private-file operations.
- `apps/agent`: separate Node desktop process, local queue, printer discovery, and spooler adapter.
- `packages/shared`: domain types, deterministic pricing, and state machines.
- `packages/db`: SQLite/PostgreSQL adapter, schema, migrations, and repositories.

Start at `README.md` for commands and workflow diagrams, `IMPLEMENTATION_STATUS.md` for source-backed status, `BUILD_AND_TEST_RESULTS.md` for executed verification, and `REMAINING_ISSUES.md` for release blockers. `WINDOWS_DRIVERS_AND_INSTALLER_AUDIT.md` records the evidence boundary for the desktop printer workflow.

## Merchant API request path

`apps/server/src/routes/merchant-routes.ts` mounts merchant handlers under `/api/v1/merchant`. The router applies signed persisted-session authentication, active membership/tenant checks, subscription gating, then endpoint-specific role or permission checks. Controllers validate input and ownership, repositories perform tenant-scoped persistence, and private files are served through `PrivateFileStorage`. Read the actual route and handler before relying on a prior API summary.

The reference Merchant API page supplied with the product was not accessible during the 2026-10-28 audit (the site returned an access checkpoint). GitDiagram's target returned a 404. The README contains the requested architecture badge. Source and tests remain authoritative; record any later reference discrepancy here only after verifying it.

## Current verified implementation snapshot

Implemented locally with regression coverage:

- Signed, revocable merchant sessions; account activity and current membership role/permissions are checked on requests.
- Customer upload and server-side quote/order paths use stored document metadata, integer Paise, and retry idempotency when clients provide a stable key.
- Accepted customer orders persist an immutable pricing snapshot containing the server-computed quote and the exact applicable rate/discount rules. Rate-rule writes use partial unique indexes and atomic upsert semantics to prevent conflicting duplicates.
- Merchant order search/filter/sort/pagination is tenant-scoped. Dashboard status counts and recent orders are aggregated without hydrating all shop order history.
- Printer health uses fresh agent heartbeat evidence; print dispatch requires a shop-owned online printer and does not auto-retry uncertain output.
- Staff invitation and platform tenant onboarding use hashed single-use activation links.
- Razorpay credentials and developer webhook secrets are encrypted at rest; payment signature checks and provider event deduplication exist in source, but live provider verification has not been done.
- Private customer files use a private-storage abstraction and retention cleanup; production Supabase storage has not been verified against the live bucket.
- After audited physical-output confirmation, one idempotent usage event stores expected selected pages multiplied by copies. The owner can view period totals; this is an operator-confirmed meter, not a printer hardware count, and it creates no charge. Subscription tariff, invoicing, and checkout remain inactive.
- Refund requests reserve the remaining verified payment balance. A merchant can reject a pending request with an audited reason and no money movement; approval remains unavailable until provider refund processing is configured.
- Agent local status endpoints are read-only and host/origin validated. Physical printing remains disabled by default; the production installer is unavailable.

Latest verified local run on 2026-10-29: `npm run build` and `npm test` passed after changes for quote snapshots, unique/upserted rate rules, physical-output usage metering, and payment-aware merchant collection. Recheck this statement after subsequent edits. `npm audit --audit-level=high` could not reach the npm advisory endpoint on two earlier attempts. Current hosted Render continues serving the older seven-path API; hosted Vercel bundle freshness is not confirmed for the current local work. Live PostgreSQL migrations/triggers, object storage, provider, browser, and hardware behavior remain unverified.

## Known incomplete product areas

- Real tenant provisioning/deployment state: the local health handler returns `RENDER_GIT_COMMIT`, but the live Render health response still omits `revision`; its OpenAPI document has only seven paths and `/api/v1/portal/shop/campus1` returns 404. This indicates Render is still serving an older backend revision. Do not seed fake production tenants.
- Payment: no verified live Razorpay sandbox checkout/webhook round trip. Per-side output usage is recorded after operator confirmation and visible to owners; tariff management and subscription charges remain inactive.
- Financial ledger: SQLite and PostgreSQL startup migrations add update/delete rejection triggers and provider transaction uniqueness. These migrations have local SQLite tests; live Supabase migration, legacy duplicate analysis, database-owner privilege hardening, and full reconciliation remain unverified.
- Vault: authorized staff can upload inspected PDF/JPEG/PNG files, organize categories, download through the private storage API, and delete stored documents. Order-file 24-hour cleanup does not purge vault documents; vault records remain until staff delete them, so approve a retention/privacy policy before production use. Live Supabase behavior is unverified.
- WhatsApp: no real Meta onboarding, credential lifecycle, inbound intake, or outbound delivery; setup/pairing fails closed.
- Developer API keys can be created/revoked and authenticate merchant business routes only when `ENABLE_EXTERNAL_API_ACCESS=true`; they are bound to one shop and checked for environment, expiry, revocation, owner membership, and limited scopes. Webhook subscriptions are stored, but signed delivery, SSRF-safe dispatch, retries, and history are incomplete.
- Platform incidents and runtime configuration are not fully backed by durable operational services. The admin console labels these workflows unavailable and does not fabricate records or success messages. Subscription billing and plan quota enforcement are incomplete.
- Physical Windows printer output, capabilities, status fidelity, signed installer, and crash/recovery behavior still require supported hardware verification.
- Production backups, recovery drills, shared rate limiting, monitoring, legal/privacy review, and account recovery need release work.

## Build and test commands

Run from this directory:

```sh
npm install
npm run build
npm test
npm audit --audit-level=high
```

There is no configured root lint command with implemented workspace lint scripts. Do not report a check as passed unless it was run in the current worktree.

## Preserving user work

Do not overwrite or stage unrelated local configuration edits. In the current checkout, `apps/agent/bin/SumatraPDF-settings.txt` and `apps/agent/sea-config.json` were pre-existing user edits and must remain untouched unless the user directly asks otherwise.
