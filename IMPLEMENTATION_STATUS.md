# Inklly implementation status

**Snapshot:** 2026-10-28 (local source; not a production-readiness claim)

Use `BUILD_AND_TEST_RESULTS.md` for the latest executed checks and `REMAINING_ISSUES.md` for release blockers. Historical phase checklists were removed because several previously marked “complete” features were UI simulations or unavailable integrations.

## Working in source with regression coverage

- **Customer ordering:** shop lookup, private upload path, server-side file inspection, quote generation in integer Paise, stale quote confirmation, order persistence, and idempotent retry when the client supplies a stable key.
- **Merchant API:** signed persisted sessions, active-user and current-membership checks, route permissions, tenant-scoped order search/filter/sort/pagination, private order-file authorization, rate-rule printer ownership, and order status/dispatch rules.
- **Merchant dashboard:** status counts and recent orders come from tenant-scoped database queries; it no longer hydrates the complete order history to render its overview. Revenue is read from the payment ledger, not inferred from order state.
- **Staff and onboarding:** owner-created shop staff and platform-created tenant owners receive hashed single-use activation tokens; staff remain inactive until password setup.
- **Printer/agent safety:** agent-owned printer inventory, heartbeat freshness, dispatch to shop-owned queues, local durable outcome reporting, replay-safe dispatch IDs, and `OUTPUT_UNCERTAIN` handling are covered by local tests. The agent loopback endpoints are read-only and validate host/origin.
- **Payments and secrets:** Razorpay checkout uses shop credentials; payment verification validates provider records and webhook signatures. Razorpay and developer webhook secrets are encrypted at rest and omitted from ordinary API responses.
- **Private files:** production refuses local-disk storage; upload concurrency is bounded, storage is private, and customer-order cleanup targets the configured retention policy. Merchant vault upload/list/download/delete now use private storage and tenant-scoped metadata.
- **Request parsing:** ordinary JSON requests are capped at 1 MiB. The two base64 file-upload routes have a shared pre-parser concurrency cap; vault uploads pass persisted session, tenant, subscription, and permission checks before large-body parsing.
- **Print confirmation:** agents can report spooler submission or uncertain output, but cannot attest printed pages. An authorized merchant must physically inspect output, confirm it with a reason, and the server records an audit event before an order becomes collectible.
- **Cash collection:** generic order status updates cannot mark an unpaid order collected. Cash collection requires finance permission and the payment route that writes a verified payment and append-only ledger entry; the regression suite covers a staff account with only `orders:process`.
- **Merchant/public copy:** fixed plan prices and quotas, unsupported printer controls, and unconditional payment/privacy claims were removed or qualified. Marketing labels illustrative order data, Razorpay availability is described as shop-configured, and legal copy no longer promises unimplemented subscription or instant print refunds.
- **Platform data:** tenant onboarding, persisted agent fleet status, retention operations, financial summaries, and tenant status updates with audit records use backend data. Incident intake, runtime configuration, signed installer distribution, subscription billing, and quota editing are not yet backed by persistent services; the console now labels those gaps.

## Incomplete or unverified

- Commit `7b017f8` is the latest pushed revision; Vercel served `assets/index-Cfcklamd.js` at 2026-10-28 10:00 UTC. Render timed out on the latest health check; its last successful response served the older seven-path OpenAPI document, omitted `revision`, and did not expose the latest storage or print-reconciliation routes.
- PostgreSQL migration/startup against the live production project and Supabase private bucket behavior remain unverified.
- Razorpay sandbox checkout and webhook round trip, refunds/reconciliation against provider statements, subscription checkout, and hybrid per-successful-side billing are not verified or fully implemented.
- Database migrations now install append-only ledger triggers and a unique provider-transaction index; local SQLite tests cover immutability, compensating entries, and duplicate rejection. Live Supabase migration, pre-existing duplicate review, role/owner bypass protection, and complete reconciliation remain open.
- The merchant vault upload workflow supports inspected PDF/JPEG/PNG files, shop-owned categories, private downloads and deletion. Vault files are excluded from temporary order-file retention and remain until staff delete them; live Supabase behavior and approved long-term retention/privacy policy remain unverified.
- WhatsApp UI and setup routes report unavailable; real Meta onboarding, secure account lifecycle, inbound customer intake, and outbound messages are not implemented.
- Shop-bound API keys authenticate merchant business routes only when `ENABLE_EXTERNAL_API_ACCESS=true`, with environment, expiry, revocation, active membership, and least-privilege scope checks. Webhook subscriptions are encrypted and validated, but signed delivery, DNS-pinned SSRF protection, retries, delivery history, replay, and rotation are incomplete.
- Platform incident handling and mutable runtime configuration require durable, audited backend services. Subscription plan changes and quota enforcement are incomplete.
- A signed, verified desktop installer is unavailable. The agent refuses physical printing by default; no supported printer has been verified end to end.
- Browser-level visual testing, production load testing, shared rate limits, backup/restore drills, monitoring, legal/privacy review, and account recovery remain release work.

## Product decisions already set

- India pilot: Razorpay, with each shop entering its own Key ID, API Secret, and webhook secret.
- Hybrid subscription plus usage is planned; base and per-successfully-printed-side rates remain configurable for the pilot.
- Customer print files are intended to be deleted 24 hours after order completion.
- Countertop QR and print-shop pickup are in scope; kiosk/ATM, franchise, delivery, and space-sharing models are excluded.

## Verification record

For the current local snapshot, `npm run build` and `npm test` (204 passed) completed successfully. `npm audit --audit-level=high` timed out twice at the npm registry. Vercel serves the latest pushed frontend bundle; Render's current response is unverified after a timeout. See `BUILD_AND_TEST_RESULTS.md` for deployment checks.
