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
- Treat all payment, printer, WhatsApp, webhook, installer, and automated billing integrations as unavailable until end-to-end evidence exists. Local pilot invoice statements do not represent collected money.

## Repository map

The active application is this nested `Source Code` npm-workspaces monorepo:

- `apps/web`: React/TypeScript/Vite public site, QR customer portal, merchant workspace, platform console, and developer portal.
- `apps/server`: Express/TypeScript REST API, authentication, merchant workflows, payments, platform and developer routes, and private-file operations.
- `apps/agent`: separate Node desktop process, local queue, printer discovery, and spooler adapter.
- `packages/shared`: domain types, deterministic pricing, and state machines.
- `packages/db`: SQLite/PostgreSQL adapter, schema, migrations, and repositories.

## User-supplied product reference

The product blueprint/reference package lives beside the app at `/Users/bhavishs/Documents/Education/Projects Source_Code/Inkly/printproject1/PrintCatalyst_Master_Codex_Package/`. Its canonical Inklly requirements are under `docs/`, especially `product/PARITY_AND_GAP_MATRIX.md`, `testing/EXHAUSTIVE_ACCEPTANCE_MATRIX.md`, `design/UI_UX_SPEC.md`, `admin/PLATFORM_OWNER_CONSOLE.md`, `saas/FINANCIAL_OPERATIONS_AND_LEDGER.md`, and `developer/DEVELOPER_PORTAL_SPEC.md`. `reference/source-snapshots/` contains preserved historical evidence, not runnable product source or current implementation truth. Use the reference to guide workflows and coverage while keeping Inklly's own scope, brand, copy, data, and code authoritative; kiosk/franchise/space-partner paths are explicitly out of scope.

Start at `README.md` for commands and workflow diagrams, `IMPLEMENTATION_STATUS.md` for source-backed status, `BUILD_AND_TEST_RESULTS.md` for executed verification, and `REMAINING_ISSUES.md` for release blockers. `WINDOWS_DRIVERS_AND_INSTALLER_AUDIT.md` records the evidence boundary for the desktop printer workflow.

## Merchant API request path

`apps/server/src/routes/merchant-routes.ts` mounts merchant handlers under `/api/v1/merchant`. The router applies signed persisted-session authentication, active membership/tenant checks, subscription gating, then endpoint-specific role or permission checks. Controllers validate input and ownership, repositories perform tenant-scoped persistence, and private files are served through `PrivateFileStorage`. Read the actual route and handler before relying on a prior API summary.

The reference Merchant API page supplied with the product was not accessible during the 2026-10-28 audit (the site returned an access checkpoint). GitDiagram's target returned a 404. The README contains the requested architecture badge. Source and tests remain authoritative; record any later reference discrepancy here only after verifying it.

## Current verified implementation snapshot

Implemented locally with regression coverage:

- Signed, revocable merchant sessions; account activity and current membership role/permissions are checked on requests.
- Merchant session authentication also joins the current shop record and denies inactive shops; shop-bound developer API keys already required an active shop. Regression tests cover inactive-shop denial across dashboard and printer routes.
- Paired-agent authentication now joins the current shop record and rejects inactive shops; the print-ticket query independently excludes inactive shops. Heartbeat, polling, and agent-file access are covered by a regression test after shop deactivation.
- Customer upload and server-side quote/order paths use stored document metadata, integer Paise, and retry idempotency when clients provide a stable key.
- Accepted customer orders persist an immutable pricing snapshot containing the server-computed quote and the exact applicable rate/discount rules. Rate-rule writes use partial unique indexes and atomic upsert semantics to prevent conflicting duplicates.
- Merchant order search/filter/sort/pagination is tenant-scoped. The legacy no-paging array response is capped at 100 orders and reports total/page metadata plus a continuation link; explicit paginated responses retain their existing object contract. Dashboard status counts and recent orders are aggregated without hydrating all shop order history.
- Printer health uses fresh agent heartbeat evidence; print dispatch requires a shop-owned online printer and does not auto-retry uncertain output.
- Agent heartbeat payload counters, health fields, and optional printer inventories are strictly type/range checked before heartbeat or inventory persistence; malformed entries cannot be silently discarded or partially applied.
- Merchant rate API methods surface non-2xx responses, and the business settings form shows failure as a failure rather than a success toast.
- Shop settings writes now enforce the persisted `settings:manage` permission; API regression coverage denies an unprivileged manager and accepts a staff member granted that permission.
- The platform ledger API uses stable `(created_at, id)` cursor pagination; the console can load further rows and its full CSV export walks every page across all domains. A 205-row same-timestamp regression verifies complete, duplicate-free traversal.
- Developer webhooks for order creation, order status, and payment success use a transactionally written outbox, per-subscription delivery records, timestamped HMAC-SHA256 signatures, HTTPS requests pinned to public DNS results, bounded backoff, attempt history, and owner controls for rotation/revocation. This code has local verification only; external API access defaults off, and live hosted delivery remains unverified.
- Staff invitation and platform tenant onboarding use hashed single-use activation links.
- Platform admin grants now use a separate persisted permission table. Only a platform owner can list administrators and replace grants; changes are audited and reloaded on every authenticated request so revocation invalidates access on existing sessions. The owner console has a permission editor. Migration v16 and local SQLite/API coverage are implemented; PostgreSQL rollout remains unverified.
- Razorpay credentials and developer webhook secrets are encrypted at rest; payment signature checks and provider event deduplication exist in source, but live provider verification has not been done.
- Private customer files use a private-storage abstraction and retention cleanup; production Supabase storage has not been verified against the live bucket. Cleanup checks every order and vault reference before deleting an object. A transactionally claimed, five-minute lease coordinates deletion with new order creation; a 60-second storage timeout and expired-lease recovery prevent abandoned claims from blocking files indefinitely. Order submission returns a safe conflict if cleanup has already claimed a file. For keys shared by orders, cleanup waits until all references reach the 24-hour terminal-state window, then expires all order references together. SQLite, API, and concurrency regressions cover these paths; live PostgreSQL behavior remains unverified.
- After audited physical-output confirmation, one idempotent usage event stores expected selected pages multiplied by copies. The owner can view period totals; this is an operator-confirmed meter, not a printer hardware count. Effective-dated tariffs and invoice-only statements are implemented locally. A platform-owned Razorpay monthly checkout, signed webhook, verification, and reconciliation path now exists in source; it does not establish live collection, automatic renewals, tax, quota enforcement, or automatic usage-invoice collection.
- Invoice-only pilot billing now stores append-only organization-specific tariffs by effective month and immutable, idempotent monthly statements from confirmed-side usage. Platform tariff/invoice operations are permission-gated and transactionally audited; merchant owners see only their organization's statements. Statements are manual-pending, before tax, and create no ledger/payment entry; automatic usage collection remains inactive.
- Refund requests reserve the remaining verified payment balance. A merchant can reject a pending request with an audited reason and no money movement; approval remains unavailable until provider refund processing is configured.
- Agent local status endpoints are read-only and host/origin validated. Physical printing remains disabled by default; the production installer is unavailable.
- Merchant printer creation validates queue names, boolean capabilities, tray counts, supported paper sizes, and default-tray uniqueness; client-supplied printer/tray IDs and live status are ignored.
- Shared quote calculations now cap files, pages, copies, and total Paise; reject malformed page-range tokens and non-integer monetary rule values; and validate bulk-discount bounds before pricing. These limits prevent huge page expansions and malformed configuration from producing unsafe quotes.
- Platform audit-log rows and CSV export use the API's camelCase event fields, include actor role/target/outcome, escape formula-capable CSV values, and reject out-of-range limits. The UI can page through the stable timestamp/ID cursor and export the complete audit history.
- Public customer quote, upload, and order routes now reject null or structurally invalid bodies with HTTP 400; malformed JSON parser errors also return 400 instead of being surfaced as server failures. Staff audit regression queries are stable when events share a timestamp.
- Per-file customer instructions are validated to 500 characters and stored in the order file's print options, where the merchant queue already reads them. The customer editor renders uploaded PDFs with PDF.js and applies supported PDF page-box crop/rotation edits without rasterizing content; supported image edits are applied through canvas. The transformed file replaces the original only after a successful private upload returns a storage key. Failed edits preserve the original file. PDF rendering remains a lazy-loaded chunk.
- Counter cash collection requires `READY_FOR_COLLECTION`, which is reached only after authorized physical-output reconciliation. The payment, ledger entry, order transition, and webhook outbox event are created within a transaction; concurrent retries return the already-recorded cash result without duplicating records.
- Migration v20 adds persistent upload-rate buckets. Customer upload requests use atomic database-backed per-IP minute and UTC-day limits before large body parsing, store only HMAC-derived keys, and fail closed if counters are unavailable. The rate limit is shared across API instances; merchant vault uploads retain authenticated upload authorization and a per-process concurrency bound.

Latest verified local run on 2026-10-29: `NODE_ENV=test npm test` passed 254 tests (database 15, shared 15, agent 14, server 204, web 6), and `npm run build` passed all workspaces. The initial web bundle is 218.07 kB minified (61.39 kB gzip); PDF rendering is lazy-loaded in a 484.31 kB chunk. `npm audit --audit-level=high` could not reach the npm advisory endpoint on two earlier attempts. GitHub `main` includes commit `7f61804` with the product/editor/subscription and cash-collection changes. Vercel responds HTTP 200 and serves a bundle. Render health responds HTTP 200, but its live OpenAPI document still has only seven paths and omits the new billing endpoints, so the backend deployment is stale. No Render deployment control is available in this environment. Live PostgreSQL migrations/triggers, object storage, provider, webhook destinations, browser, and hardware behavior remain unverified.

## Known incomplete product areas

- Real tenant provisioning/deployment state: the local health handler returns `RENDER_GIT_COMMIT`, but the live Render health response still omits `revision`; its OpenAPI document has only seven paths and `/api/v1/portal/shop/campus1` returns 404. This indicates Render is still serving an older backend revision. Do not seed fake production tenants.
- Payment and billing: no verified live Razorpay sandbox checkout/webhook round trip. The platform-owned monthly checkout and payment reconciliation paths are implemented in source but need credentials and live sandbox verification. Per-side output usage drives immutable invoice-only pilot statements with configurable effective-dated rates; automatic renewals, tax calculation, quota enforcement, and usage-invoice collection remain inactive.
- Financial ledger: SQLite and PostgreSQL startup migrations add update/delete rejection triggers and provider transaction uniqueness. These migrations have local SQLite tests; live Supabase migration, legacy duplicate analysis, database-owner privilege hardening, and full reconciliation remain unverified.
- Vault: authorized staff can upload inspected PDF/JPEG/PNG files, organize categories, download through the private storage API, and delete stored documents. Order-file 24-hour cleanup does not purge vault documents; vault records remain until staff delete them, so approve a retention/privacy policy before production use. Live Supabase behavior is unverified.
- WhatsApp: no real Meta onboarding, credential lifecycle, inbound intake, or outbound delivery; setup/pairing fails closed.
- Developer API keys can be created/revoked and authenticate merchant business routes only when `ENABLE_EXTERNAL_API_ACCESS=true`; they are bound to one shop and checked for environment, expiry, revocation, owner membership, and limited scopes. Webhook infrastructure supports three persisted event types and signed retrying delivery. Hosted delivery verification and broader event types remain incomplete.
- Platform incidents and runtime configuration are not fully backed by durable operational services. The admin console labels these workflows unavailable and does not fabricate records or success messages. Pilot tariff and invoice APIs are implemented locally; recurring subscription state management, automatic collection, and plan quota enforcement remain incomplete.
- Physical Windows printer output, capabilities, status fidelity, signed installer, and crash/recovery behavior still require supported hardware verification.
- Production backups, recovery drills, shared rate limiting for non-upload endpoints, monitoring, legal/privacy review, and account recovery need release work.

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
