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
- **Private files:** production refuses local-disk storage; upload concurrency is bounded, storage is private, and cleanup targets the configured retention policy.
- **Platform data:** tenant onboarding, persisted agent fleet status, retention operations, financial summaries, and tenant status updates with audit records use backend data.

## Incomplete or unverified

- Render has not exposed a verifiable deployed source revision; live `campus1` shop lookup returned 404 on 2026-10-28. Vercel served the bundle matching commit `ed18be7` during the live check.
- PostgreSQL migration/startup against the live production project and Supabase private bucket behavior remain unverified.
- Razorpay sandbox checkout and webhook round trip, refunds/reconciliation against provider statements, subscription checkout, and hybrid per-successful-side billing are not verified or fully implemented.
- Financial ledger integrity is not proven database-immutable; database triggers/permissions and broad reconciliation remain open.
- The merchant vault has category and file access foundations, but no completed merchant upload workflow.
- WhatsApp UI and setup routes report unavailable; real Meta onboarding, secure account lifecycle, inbound customer intake, and outbound messages are not implemented.
- API key creation/revocation does not yet authenticate business API calls. Webhook subscriptions are encrypted and validated, but signed delivery, DNS-pinned SSRF protection, retries, delivery history, replay, and rotation are incomplete.
- Platform incident handling and mutable runtime configuration require durable, audited backend services. Subscription plan changes and quota enforcement are incomplete.
- A signed, verified desktop installer is unavailable. The agent refuses physical printing by default; no supported printer has been verified end to end.
- Browser-level visual testing, production load testing, shared rate limits, backup/restore drills, monitoring, legal/privacy review, and account recovery remain release work.

## Product decisions already set

- India pilot: Razorpay, with each shop entering its own Key ID, API Secret, and webhook secret.
- Hybrid subscription plus usage is planned; base and per-successfully-printed-side rates remain configurable for the pilot.
- Customer print files are intended to be deleted 24 hours after order completion.
- Countertop QR and print-shop pickup are in scope; kiosk/ATM, franchise, delivery, and space-sharing models are excluded.

## Verification record

The latest code snapshot is still under active change. Re-run `npm run build`, `npm test`, and `npm audit --audit-level=high` before relying on the prior result. See `BUILD_AND_TEST_RESULTS.md` for exact last-observed commands and deployment checks.
