# Inklly Implementation Status Ledger

**Project Root:** `/Users/bhavishs/Documents/Education/Projects Source_Code/Inkly/Source Code/`
**Authoritative Documentation:** `../printproject1/PrintCatalyst_Master_Codex_Package/reference/`
**Started:** 2026-10-25 (Asia/Kolkata)  
**Current Phase:** Productization and workflow hardening (not release-ready)

> **Verified snapshot (2026-10-28):** Most phase checklists below are historical feature inventory, not proof that every UI control is production-connected. Current local verification is 197 tests passing (database 6, shared 13, agent 12, server 166); `npm run build` passes and `npm audit --audit-level=high` reports zero vulnerabilities. Merchant printing assigns orders only to fresh online shop printers, and agent polling is scoped to the reporting agent's queues; ticket downloads are paired-origin restricted, bounded, and redirect-blocked; unexpected agent execution exceptions are persisted as `OUTPUT_UNCERTAIN`, worker cycles serialize, and shutdown drains active work; merchant permissions use current membership data. Developer webhook secrets are encrypted at rest and legacy rows are migrated. Platform tenant onboarding uses a single-use owner setup flow; the admin fleet uses persisted agent records and heartbeat-derived status; financial summaries use available source data; retention metrics and purge actions use database/storage results with audit records. Actual webhook delivery, PostgreSQL migration, and hardware output remain unverified. See `BUILD_AND_TEST_RESULTS.md` and `REMAINING_ISSUES.md` for current evidence and blockers.

**Implemented and tested in source:**

- Customer portal upload/order/quote paths use server-side document inspection and integer-Paise pricing; tenant-specific APIs enforce shop scope.
- Merchant sessions are signed, persisted, checked on every authenticated request, and revocable. Pricing edits require the settings permission.
- Per-shop Razorpay customer payments validate the provider order, captured status, amount, currency, and webhook signature. Live provider credentials and callbacks have not been verified here.
- PostgreSQL startup installs the baseline schema on a new database and applies versioned dispatch-ack, merchant-vault, and agent-owned-printer migrations; live PostgreSQL application of the newest migrations is not yet verified. TLS certificate verification is enabled.
- Private Supabase Storage is required in production. The latest Render log connects to PostgreSQL but exits because Storage environment settings/bucket are missing or invalid.
- Agent results are persisted locally for retry, unacknowledged dispatch tickets replay with stable IDs, and expired handoffs become `OUTPUT_UNCERTAIN`. Physical printing is disabled by default for this pilot.
- Agent polling now selects only orders released to `READY_FOR_PRINT` or `IN_PROGRESS`; online orders also require `payment_status=VERIFIED`. A regression test verifies customer-submitted orders are not dispatched before merchant release.
- Merchant customer-payment revenue is read from the append-only payment ledger, not inferred from order status. Merchant storage categories/documents now have tenant-scoped relational tables; category persistence has API test coverage.
- Printer profiles save through the API; registration no longer claims that hardware is online. Customer tracking distinguishes payment-pending and attention-required states.
- The Live Print screen now loads printer queues from the merchant API, and the Orders view offers explicit selection when multiple queues are available. It no longer claims live tray levels, fake test prints, or page-by-page spool progress.
- Subscription checkout and per-successful-side SaaS billing are not implemented. Pilot prices remain configurable, and the dashboard now states that no subscription charge will be taken there. WhatsApp Meta messaging and a verified agent installer also remain unavailable.

**Production verification still required:** configure Render's private Supabase bucket and service-role credentials; verify the running revision and health endpoint; exercise the live Supabase schema/storage path and Razorpay sandbox; and validate actual provider/billing workflows. Physical printing remains in scope but pilot-gated until the executor and hardware workflow are safe and verified.

**Correction to historical checklists below:** claims such as “100% interactive,” fixed printer models/status, local vault completion, simulated payments/referrals/payouts, WhatsApp pairing, and physical print confirmation are not current production guarantees. The merchant print workflow now requires a registered online queue, and the agent reports only detected local queues. A successful spooler handoff is not proof that paper exited a device. Treat every unchecked provider, installer, vault-upload, billing, support, and hardware workflow as incomplete until source-backed behavior and tests prove otherwise.

> Historical phase checklists below contain earlier claims and are retained for traceability only. Some claims describe prototype behavior or integrations that are now explicitly unavailable. The checked boxes are not evidence that those features currently work. Use source, current tests, and deployment evidence above when assessing status.

---

## 1. Phase Progress Checklist

- [x] **Phase 0: Workspace Verification, Architecture & Baseline Tooling**
  - [x] Workspace `D:\Inkly\Source Code\` established cleanly and strictly isolated from reference docs.
  - [x] Tracking ledgers created (`IMPLEMENTATION_STATUS.md`, `BUILD_AND_TEST_RESULTS.md`, `REMAINING_ISSUES.md`).
  - [x] Monorepo structure initialized (`apps/web`, `apps/server`, `apps/agent`, `packages/shared`, `packages/db`).
  - [x] Root build configuration & typecheck verified.
- [x] **Phase 1: Brand & Public Web Shell**
  - [x] Inklly design system tokens (`#4A69ED` primary blue, `#182230` navy, `#F7F8FA` neutral surfaces).
  - [x] Responsive navigation shell & footer with dynamic view routing.
  - [x] Public routes: Home, Print Automation, WhatsApp Printing, QR Ordering, How it works, Pricing tiers, FAQ, Contact, Legal disclosures.
  - [x] Pure Inklly branding across all pages, views, modals, and index.html (purged all competitor "Print Catalyst" naming).
  - [x] Zero kiosk/ATM hardware or franchise routes (strictly excluded from active navigation and cleanly redirected).
  - [x] Platform Owner Console (`/platform`, `/admin`) and Developer Portal (`/developer`) wired into client router.
- [x] **Phase 2: Authentication & Multi-Tenancy Engine**
  - [x] Multi-tenant isolation (`shop_id`, `organization_id`) enforced across all API routes and database queries.
  - [x] Session tokens & JWT auth in `apps/server/src/middleware/auth.ts`.
  - [x] Role-Based Access Control (RBAC): `PLATFORM_OWNER`, `PLATFORM_ADMIN`, `MERCHANT_OWNER`, `SHOP_STAFF`, `DEVELOPER`, `CUSTOMER`.
  - [x] Staff Role Presets ('Order Handler', 'Print Operator', 'Manager').
- [x] **Phase 3: Customer Intake, File Validation & Pricing Engine**
  - [x] Countertop shop QR upload portal (`/p/:shop_code`).
  - [x] Client & server file validation (PDF, DOCX, XLSX, PPTX, TXT, images up to 10 MB).
  - [x] Per-document print options (B&W/Color, Simplex/Duplex, Paper size/type, Copies, Page Ranges).
  - [x] Deterministic server-side quotation engine using minor units (integer Paise) in `packages/shared/src/pricing-engine/calculator.ts`.
  - [x] Additional copy discounts and bulk order threshold percentage discounts.
- [x] **Phase 4: Order & Payment State Machines**
  - [x] Decoupled Order (`DRAFT` $\rightarrow$ `AWAITING_REVIEW` $\rightarrow$ `READY_FOR_PRINT` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `READY_FOR_COLLECTION` $\rightarrow$ `COLLECTED`), Payment (`NOT_STARTED` $\rightarrow$ `PENDING` $\rightarrow$ `VERIFIED`), and PrintJob lifecycles.
  - [x] Cash-on-collection and Razorpay/Stripe checkout session intents.
  - [x] Webhook signature verification & idempotency guards via event-id tracking in ledger.
  - [x] Counter Cash Collection workflow crediting `CUSTOMER_PRINT_PAYMENT` ledger.
  - [x] **Refund lifecycle** (`REQUESTED` $\rightarrow$ `COMPLETED`/`FAILED`/`REVERSED`) with Razorpay provider refund API, signature-verified callbacks, idempotency protection, and `REFUND_DISPUTE` ledger entries.
  - [x] Cash collection now creates an auditable `payments` record enabling refund linkage and financial reconciliation.
- [x] **Phase 5: Merchant Workspace**
  - [x] Real-time order queue with status filters and active metrics bar.
  - [x] Document Studio preview & inspection modal.
  - [x] Business Setup tabs: Profile, Printers & Fleet, Rates & Discounts, Staff RBAC, WhatsApp Bot Templates.
  - [x] 1-Click "Dispatch Print" forwarding print tickets to Desktop Agent.
  - [x] WhatsApp bot notification templates with variable placeholders (`{{order_number}}`, `{{customer_name}}`, `{{total}}`).
- [x] **Phase 6: Desktop Print Agent & Spooler Integration**
  - [x] Local agent server running on `http://127.0.0.1:8765` with `/status`, `/queue`, `/sync`, `/pair` endpoints.
  - [x] Shop pairing protocol with `Shop ID` + `Secret Key`.
  - [x] OS print driver & tray capability discovery (Windows PowerShell `Get-Printer` + multi-tray PCL fallback adapter).
  - [x] Embedded SQLite offline queue (`local_queue.db`) using native `node:sqlite`.
  - [x] Hardware Safety Invariant: `OUTPUT_UNCERTAIN` state enforced on paper jam or interruption (zero blind retries).
- [x] **Phase 7: Platform Owner / Admin Console**
  - [x] Privileged platform management (`/platform/*`).
  - [x] Global metrics: Platform GMV (₹), SaaS MRR (₹), Active print agents, Total organizations and shops.
  - [x] Merchant directory with Suspend / Reactivate controls.
  - [x] Subscription plans catalog (`STARTER`, `GROWTH`, `PRO`, `SCALE`).
  - [x] **Subscription lifecycle management** (create/update with ACTIVE/PAST_DUE/GRACE/CANCELLED states, proration support, ledger entries under `SAAS_SUBSCRIPTION` domain).
  - [x] **Credit purchase & balance tracking** under `CONVERSION_CREDIT` domain with ledger entries.
  - [x] **Payout/withdrawal** with eligibility checks (`CUSTOMER_PRINT_PAYMENT` domain balance), duplicate-request prevention, step-up auth, and `MERCHANT_PAYOUT` ledger entries.
  - [x] Append-only financial ledger viewer partitioned across all 6 official money domains (`CUSTOMER_PRINT_PAYMENT`, `SAAS_SUBSCRIPTION`, `CONVERSION_CREDIT`, `MERCHANT_PAYOUT`, `REFUND_DISPUTE`, `REFERRAL_REWARD`).
  - [x] System audit log explorer.
- [x] **Phase 8: Developer & Integration Portal**
  - [x] OpenAPI 3.0 specification generation (`/api/v1/developer/openapi.json`) and interactive documentation catalog.
  - [x] Scoped API key generator (`ink_live_...`, `ink_test_...`) with revocation.
  - [x] Webhook event dispatch simulator for external integrations.
- [x] **Phase 9: Quality, Security & Production Readiness (historical checklist; not a readiness certification)**
  - [x] Historical automated-test counts are not current evidence; latest verified 2026-10-28 run passes 184 tests (DB 5, shared 13, agent 11, server 155).
  - [ ] Linting is not configured as a working project check.
  - [x] Zero external native C++ dependency requirements (`node:sqlite` DatabaseSync used throughout).
  - [x] Vite production build generated for web frontend.
  - [x] Cross-tenant isolation and hardware retry prevention verified.
- [x] **Phase 10: Reference Parity & Interactive UI Harmonization**
  - [x] **Merchant Dashboard:** Real-time dynamic KPI cards (Revenue ₹, Total Orders, Pending, Completed), SVG area chart with Orders/Revenue toggle, dynamic Status Donut matching active order states, and Recent Orders table with "Open Order Handler" CTA.
  - [x] **Order Queue (7 Statuses):** Fully connected table with dynamic tab counter pills (Pending, Processing, Printing, Rejected, Print Failed, Done, All Orders), live summary counters (Orders, Revenue INR, Pages), multi-field search filter, contextual row action buttons (One-Click Print, Reject, Retry Print, Reprint, View), tailored empty states, and comprehensive Order Detail modal.
  - [x] **Live Print:** 3 top KPI metrics (Working Printers, Printing Now, Waiting to Print), hardware cards for HP LaserJet Pro M401dne (USB port 8765) and Canon imageRUNNER C3530i (Network IP) with tray paper level gauges, queue pause/resume controls, calibration test prints, and live spooling buffer table.
  - [x] **WhatsApp Setup:** Official Meta WhatsApp Cloud API configuration, QR pairing interface with 60s countdown timer, QR refresh handler, and active connection status toggle.
  - [x] **Permanent Local Storage:** Private local directory integration on Inklly Agent (`localhost:8765`), categorized folders (College Exams, KYC, Project Thesis, Receipts), file metadata display, interactive "+ New category" and "Upload files" handlers, and 1-click "Send to Spooler (Print Now)".
  - [x] **Credits Management:** 4 KPI cards (Remaining, Used, Included, Purchased), quantity chips (100, 500, 1000, 5000) with custom input, idempotent Razorpay credit purchase simulation with immediate balance updates and toasts.
  - [x] **Withdraw Earnings:** Dynamic available, gross, platform fee (2%), and settled metrics; UPI and NEFT bank transfer forms with min ₹100 threshold validation; net payout breakdown calculator; settlement request handler updating balance and appending to payout history log.
  - [x] **Referrals:** Permanent referral link (`PUNE2026`) with clipboard copy, 6-state financial breakdown chips, interactive referral bonus claim handler transferring bonus to wallet balance, and active referred print shops list.
  - [x] **Employees & Counter Staff:** Active staff cards with roles, phone, shifts, and counter QR access; interactive "+ Add employee" modal to register and provision new team members; account revocation action.
  - [x] **Train Bot:** WhatsApp auto-responder configuration (Greeting, Received, Rejected, Completed messages) and live interactive chat preview test console.
  - [x] **Business Setup (6 Tabs):** Profile, Printers (v1.0.0 agent download, pairing key reveal/rotate, fleet setup), Pricing (A4/A3/Legal, B&W/Color, single/duplex, live calculator), Discounts (bulk tier matrix, additional copies), Customer Portal (color themes, interactive phone preview), Automation & Payment (Razorpay sandbox, cash toggle, auto-print policies).
  - [x] **Countertop QR Portal & Canvas Document Editor:** Mobile-first order intake at `/p/campus1` with HTML5 2D canvas editor featuring 8 draggable crop handles, 90° rotation, contrast/brightness adjustments, and document scan filters (`natural`, `bw_doc`, `enhanced`, `grayscale`).

