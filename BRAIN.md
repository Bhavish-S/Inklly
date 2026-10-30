# Inklly engineering context

**Last checked:** 2026-10-30 (Asia/Kolkata)

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

The reference Merchant API page supplied with the product was not accessible during the 2026-10-28 audit (the site returned an access checkpoint); a 2026-10-30 direct fetch returned HTTP 429. GitDiagram's target returned 404 on 2026-10-30. The README contains the requested architecture badge. Source and tests remain authoritative; record any later reference discrepancy here only after verifying it.

## Current verified implementation snapshot

Implemented locally with regression coverage:

- Signed, revocable merchant sessions; account activity and current membership role/permissions are checked on requests.
- Merchant session authentication also joins the current shop record and denies inactive shops; shop-bound developer API keys already required an active shop. Regression tests cover inactive-shop denial across dashboard and printer routes.
- Paired-agent authentication now joins the current shop record and rejects inactive shops; the print-ticket query independently excludes inactive shops. Heartbeat, polling, and agent-file access are covered by a regression test after shop deactivation.
- Customer upload and server-side quote/order paths use stored document metadata, integer Paise, and retry idempotency when clients provide a stable key.
- Accepted customer orders persist an immutable pricing snapshot containing the server-computed quote and the exact applicable rate/discount rules. Rate-rule writes use partial unique indexes and atomic upsert semantics to prevent conflicting duplicates.
- Merchant order search/filter/sort/pagination is tenant-scoped. The legacy no-paging array response is capped at 100 orders and reports total/page metadata plus a continuation link; explicit paginated responses retain their existing object contract. Dashboard status counts and recent orders are aggregated without hydrating all shop order history.
- Merchant page hydration batches order files and print-job summaries for the bounded result set rather than issuing per-order queries; regression checks ensure the payload hides private storage keys and retains print-job summaries.
- Merchant order detail, status, print, and reconciliation handlers now resolve orders within the authenticated shop before returning state or acting; foreign IDs and order numbers use the same 404 response as missing orders. Private order-file tests cover foreign-shop denial, owner download, `private, no-store`, and `nosniff` headers.
- Printer health uses fresh agent heartbeat evidence; print dispatch requires a shop-owned online printer, a physical-print-ready agent, and a saved printer capability profile compatible with every order file. Agent inventory reuses an exact shop-configured queue profile by queue name and driver name, preserving color, duplex, and tray-size settings across heartbeats. Dispatch rejects unsupported or unverified modes before any job assignment; tests cover color, duplex, paper size, unchanged order state, and compatible output.
- Agent heartbeat payload counters, health fields, and optional printer inventories are strictly type/range checked before heartbeat or inventory persistence; malformed entries cannot be silently discarded or partially applied.
- Merchant rate API methods surface non-2xx responses, and the business settings form shows failure as a failure rather than a success toast.
- Shop settings writes now enforce the persisted `settings:manage` permission; API regression coverage denies an unprivileged manager and accepts a staff member granted that permission. Platform admins cannot use merchant routes or choose tenants by query/header; only platform owners retain support access, with a regression proving granted admin settings reads/writes are denied.
- The platform ledger API uses stable `(created_at, id)` cursor pagination; the console can load further rows and its full CSV export walks every page across all domains. A 205-row same-timestamp regression verifies complete, duplicate-free traversal.
- Developer webhooks for order creation, order status, and payment success use a transactionally written outbox, per-subscription delivery records, timestamped HMAC-SHA256 signatures, HTTPS requests pinned to public DNS results, bounded backoff, attempt history, and owner controls for rotation/revocation. This code has local verification only; external API access defaults off, and live hosted delivery remains unverified.
- Staff invitation and platform tenant onboarding use hashed single-use activation links. Authenticated profile name/phone updates are validated and audited; password changes verify the current password, require a strong replacement, and revoke all other sessions.
- Platform admin grants now use a separate persisted permission table. Only a platform owner can list administrators and replace grants; changes are audited and reloaded on every authenticated request so revocation invalidates access on existing sessions. The owner console has a permission editor. Migration v16 and local SQLite/API coverage are implemented; PostgreSQL rollout remains unverified.
- Razorpay credentials and developer webhook secrets are encrypted at rest; payment signature checks and provider event deduplication exist in source, but live provider verification has not been done. Razorpay credential status/save/test/remove routes require the persisted organization owner of the authenticated shop; platform-owner support bypass is rejected. Save/removal and non-secret metadata are audited in the same transaction, with regression coverage against platform-owner cross-tenant attempts.
- Private customer files use a private-storage abstraction and retention cleanup; production Supabase storage has not been verified against the live bucket. Cleanup checks every order and vault reference before deleting an object. A transactionally claimed, five-minute lease coordinates deletion with new order creation; a 60-second storage timeout and expired-lease recovery prevent abandoned claims from blocking files indefinitely. Order submission returns a safe conflict if cleanup has already claimed a file. For keys shared by orders, cleanup waits until all references reach the 24-hour terminal-state window, then expires all order references together. SQLite, API, and concurrency regressions cover these paths; live PostgreSQL behavior remains unverified.
- Merchant output reconciliation is per print job/file: staff can confirm only the files they physically inspected. The order stays in progress and usage is not metered until every file is confirmed; then one idempotent usage event stores expected selected pages multiplied by copies. The owner can view period totals; this is an operator-confirmed meter, not a printer hardware count. Effective-dated tariffs and invoice-only statements are implemented locally. A platform-owned Razorpay monthly checkout, signed webhook, verification, and reconciliation path now exists in source; it does not establish live collection, automatic renewals, tax, quota enforcement, or automatic usage-invoice collection.
- Invoice-only pilot billing now stores append-only organization-specific tariffs by effective month and immutable, idempotent monthly statements from confirmed-side usage. Platform tariff/invoice operations are permission-gated and transactionally audited; merchant owners see only their organization's statements. Statements are manual-pending, before tax, and create no ledger/payment entry; automatic usage collection remains inactive.
- Refunds reserve verified payment balance. Razorpay refunds use shop-owned credentials and stable provider idempotency; signed refund webhooks reconcile asynchronous outcomes, and the ledger records a negative entry only after provider confirmation. Cash refunds require explicit return confirmation plus an audit note. Live provider and hosted database behavior remain unverified.
- Shop Razorpay credentials cannot be rotated or removed while a Razorpay payment is CREATING/PENDING or a refund remains REQUESTED/PROCESSING. Credential mutations, checkout reservation, and refund reservation serialize on the shop row, so operations cannot slip through the in-flight check concurrently.
- Agent local status endpoints are read-only and host/origin validated. Physical printing remains disabled by default; the production installer is unavailable.
- Merchant printer creation validates queue names, boolean capabilities, tray counts, supported paper sizes, and default-tray uniqueness; client-supplied printer/tray IDs and live status are ignored.
- Shared quote calculations now cap files, pages, copies, and total Paise; reject malformed page-range tokens and non-integer monetary rule values; and validate bulk-discount bounds before pricing. These limits prevent huge page expansions and malformed configuration from producing unsafe quotes.
- Platform audit-log rows and CSV export use the API's camelCase event fields, include actor role/target/outcome, escape formula-capable CSV values, and reject out-of-range limits. The UI can page through the stable timestamp/ID cursor and export the complete audit history.
- Public customer quote, upload, and order routes now reject null or structurally invalid bodies with HTTP 400; malformed JSON parser errors also return 400 instead of being surfaced as server failures. Staff audit regression queries are stable when events share a timestamp.
- Per-file customer instructions are validated to 500 characters and stored in the order file's print options, where the merchant queue already reads them. The customer editor renders uploaded PDFs with PDF.js and applies supported PDF page-box crop/rotation edits without rasterizing content; supported image edits are applied through canvas. The transformed file replaces the original only after a successful private upload returns a storage key. Failed edits preserve the original file. PDF rendering remains a lazy-loaded chunk.
- Counter cash collection requires `READY_FOR_COLLECTION`, which is reached only after authorized physical-output reconciliation. The payment, ledger entry, order transition, and webhook outbox event are created within a transaction; concurrent retries return the already-recorded cash result without duplicating records.
- Cross-tenant cash collection and refund controls are reserved for `PLATFORM_OWNER`. Platform-admin finance grants cannot authorize shop financial routes, and both route role gates and controller ownership checks enforce this boundary.
- Merchant discount settings now load and save a single threshold bulk discount plus A4 additional-copy rates through the tenant-scoped API. Writes validate integer Paise/whole percentages, require additional-copy prices no higher than the normal rate, commit atomically and create an audit event. Migration v23 adds a unique copy-discount key and fails closed on legacy duplicates. Shop profile and portal settings writes now also share one transaction.
- Local agent dispatch now atomically claims a durable queue item before spooler execution, preventing two daemons sharing a queue file from submitting the same job. The merchant connection check probes local agent health and persisted shop printer inventory independently and reports that neither proves physical output.
- Agent heartbeats now report `physicalPrintingEnabled` from `INKLLY_ENABLE_PHYSICAL_PRINTING`. Migration v24 defaults existing agents to disabled; merchant dispatch refuses assignment and agent polling withholds jobs until the authenticated agent reports true. The local agent diagnostics expose the same flag, and the OpenAPI heartbeat contract documents the fail-closed default. SQLite/API regressions cover upgrade, disabled-agent denial, and enabled-agent dispatch; deployed PostgreSQL and Windows behavior remain unverified.
- Merchant billing now labels the current screen `Billing & usage` and displays server-backed print-side statements instead of the dormant mock conversion-credit purchase panel. Credit top-ups fail closed with HTTP 503 until provider-backed purchase and conversion usage are implemented; the API regression asserts no balance change.
- Merchant settlement and referral screens no longer contain the hidden prototype withdrawal/referral wallets, sample bank payouts, or local-only success handlers. The live settlement screen explains that Razorpay settles to the shop and payout requests are unavailable; the referral screen explains the program is not in the pilot.
- Migration v20 adds persistent upload-rate buckets. Customer upload requests use atomic database-backed per-IP minute and UTC-day limits before large body parsing, store only HMAC-derived keys, and fail closed if counters are unavailable. The rate limit is shared across API instances; merchant vault uploads retain authenticated upload authorization and a per-process concurrency bound.
- Merchant vault listing now returns bounded pages (1-100 documents, default 50) with a tenant-scoped opaque cursor and total counts; the merchant screen loads further pages on demand. Deletion marks a hidden tombstone before object removal, and a bounded background worker retries failed object or metadata cleanup each minute. Order-file references protect shared objects. Regressions cover pagination, failed-delete retry, hidden pending records, legacy migration, and shared order-file preservation; live PostgreSQL/Supabase behavior remains unverified.
- Platform fleet refresh now reloads the authenticated `/platform/agents` inventory and reports success only after the server response; it does not claim to poll desktops. Printer availability is zero unless the owning agent heartbeat is fresh (45 seconds), with stale counts exposed separately for diagnostics. Future-dated heartbeats are classified `UNKNOWN`. Local API regression covers stale reported printers; live agent fleet remains unverified.
- Merchant portal-service availability now persists ID-card and passport-photo flags with existing shop portal settings. Those settings default off for existing/new shops; the customer portal only presents the relevant studio modes when enabled. Legacy portal-settings updates that omit the new flags preserve existing values. Database/API tests cover defaults and persistence; a real customer browser session remains unverified.

Latest pushed source snapshot on 2026-10-30: commit `f95d896` records verified deployment evidence after `44d6973` enforced persisted organization ownership for Razorpay credential routes and atomically audited successful save/removal. The current local changes batch printer and tray hydration and use compact dashboard/existence queries. `npm run build` and `npm test` passed locally with 281 tests (database 21, shared 16, agent 15, server 218, web 11). The deployed Vercel MerchantAppView bundle SHA-256 matches the local asset. Render health is live but omits a revision; its OpenAPI document still has only 7 paths, and unauthenticated developer-key access returns HTTP 200 with an empty array. Render service settings and auto-deploy state cannot be inspected or changed from this session. Live PostgreSQL migrations/triggers, object storage, provider, webhook destinations, browser visual verification, and hardware behavior remain unverified.

## Known incomplete product areas

- Real tenant provisioning/deployment state: the local health handler returns `RENDER_GIT_COMMIT`, but live Render omits `revision`, its curated OpenAPI spec lacks current subscription/billing paths, and anonymous `/api/v1/developer/keys` returns 200 instead of the source's 401. The repo has no Render CLI, deploy hook, credentials, or dashboard session to inspect/trigger a deploy. Do not seed fake production tenants.
- Payment and billing: no verified live Razorpay sandbox checkout/webhook round trip. The platform-owned monthly checkout and payment reconciliation paths are implemented in source but need credentials and live sandbox verification. Per-side output usage drives immutable invoice-only pilot statements with configurable effective-dated rates; automatic renewals, tax calculation, quota enforcement, and usage-invoice collection remain inactive.
- Financial ledger: SQLite and PostgreSQL startup migrations add update/delete rejection triggers and provider transaction uniqueness. These migrations have local SQLite tests; live Supabase migration, legacy duplicate analysis, database-owner privilege hardening, and full reconciliation remain unverified.
- Vault: authorized staff can upload inspected PDF/JPEG/PNG files, organize categories, browse bounded cursor pages, download through the private storage API, and delete stored documents through hidden, retryable tombstones. Order-file 24-hour cleanup does not purge vault documents; vault records remain until staff delete them, so approve a retention/privacy policy before production use. Live Supabase behavior is unverified.
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
