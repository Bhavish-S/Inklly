# Inklly implementation status

**Snapshot:** 2026-10-29 (local source; not a production-readiness claim)

Use `BUILD_AND_TEST_RESULTS.md` for the latest executed checks and `REMAINING_ISSUES.md` for release blockers. Historical phase checklists were removed because several previously marked “complete” features were UI simulations or unavailable integrations.

## Working in source with regression coverage

- **Customer ordering:** shop lookup, private upload path, server-side file inspection, quote generation in integer Paise, stale quote confirmation, order persistence, and idempotent retry when the client supplies a stable key.
- **Accepted pricing and rate integrity:** order rows persist the calculated quote plus the exact rate and discount rules accepted at submission. Rate-rule updates use database uniqueness keys and atomic upserts so concurrent writes cannot create ambiguous prices. Existing duplicate pricing keys fail migration for manual reconciliation.
- **Merchant API:** signed persisted sessions, active-user/current-membership/current-shop checks (inactive shops are denied), route permissions, tenant-scoped order search/filter/sort/pagination, private order-file authorization, rate-rule printer ownership, and order status/dispatch rules.
- **Shop settings:** profile and operational settings now validate exact supported fields/types/enums and persist through the merchant settings route used by the UI; malformed truthy strings and unknown keys are rejected.
- **Shop settings authorization:** updates require the current persisted `settings:manage` permission; the API test confirms a manager without it is denied and a staff member with it can update settings.
- **Merchant dashboard:** status counts and recent orders come from tenant-scoped database queries; it no longer hydrates the complete order history to render its overview. Revenue is read from the payment ledger, not inferred from order state.
- **Staff and onboarding:** owner-created shop staff and platform-created tenant owners receive hashed single-use activation tokens; staff remain inactive until password setup.
- **Printer/agent safety:** agent-owned printer inventory, heartbeat freshness, dispatch to shop-owned queues, inactive-shop agent revocation, local durable outcome reporting, replay-safe dispatch IDs, and `OUTPUT_UNCERTAIN` handling are covered by local tests. Agent polling and private-file routes reject an already paired agent after its shop is deactivated. The agent loopback endpoints are read-only and validate host/origin.
- **Platform permissions:** platform admin grants are stored separately from merchant memberships; owners can view and replace grants through owner-only APIs and the admin console. Successful changes are audited, and middleware reloads permissions for every request so an existing session cannot retain revoked access. SQLite migration and API tests cover grant, denial, invalid grants, owner-only management, and revocation. Live PostgreSQL behavior remains unverified.
- **Payments and secrets:** Razorpay checkout uses shop credentials; payment verification validates provider records and webhook signatures. Razorpay and developer webhook secrets are encrypted at rest and omitted from ordinary API responses.
- **Developer webhooks:** order-created, order-status, and payment-success events enter the persistent outbox in their source transaction. Signed HTTPS delivery uses HMAC-SHA256, DNS-pinned public IPs, a bounded retry policy, attempt history, and owner controls for one-time secret display, rotation, and revocation. The developer portal separates synthetic preview from actual persisted delivery history.
- **Private files:** production refuses local-disk storage; upload concurrency is bounded, storage is private, and customer-order cleanup preserves objects referenced by any active order or vault document. Once all orders sharing a key are eligible, one removal expires every order reference. Merchant vault upload/list/download/delete use private storage and tenant-scoped metadata.
- **Request parsing:** ordinary JSON requests are capped at 1 MiB. The two base64 file-upload routes have a shared pre-parser concurrency cap; vault uploads pass persisted session, tenant, subscription, and permission checks before large-body parsing.
- **Print confirmation:** agents can report spooler submission or uncertain output, but cannot attest printed pages. An authorized merchant must physically inspect output, confirm it with a reason, and the server records an audit event before an order becomes collectible.
- **Cash collection:** generic order status updates cannot mark an unpaid order collected. Cash collection requires finance permission and the payment route that writes a verified payment and append-only ledger entry; the regression suite covers a staff account with only `orders:process`.
- **Merchant pickup and usage:** the active order details action records unverified cash through the ledger-backed payment route, and only completes already-verified payments through order status. Owner billing view reads organization-scoped, operator-confirmed selected-page-times-copy usage; it does not initiate charges.
- **Pilot statements:** platform billing admins can set append-only organization tariffs effective by calendar month and issue idempotent immutable monthly statements from confirmed printed-side usage. Owners can read only their organization's statements. Statements remain manual-pending, before tax, and do not create payment or ledger entries.
- **Refund reservations:** pending refund requests can be rejected transactionally with a reason and audit record, releasing their reserved balance without changing payment or ledger records. Provider refund approval is still unavailable.
- **Merchant/public copy:** fixed plan prices and quotas, unsupported printer controls, and unconditional payment/privacy claims were removed or qualified. Marketing labels illustrative order data, Razorpay availability is described as shop-configured, and legal copy no longer promises unimplemented subscription or instant print refunds.
- **Platform data:** tenant onboarding, persisted agent fleet status, retention operations, financial summaries, tenant status updates, and invoice-only pilot billing use backend data. Incident intake, runtime configuration, signed installer distribution, automated subscription billing, and quota editing are not yet backed by persistent services; the console now labels those gaps.
- **Platform ledger:** cursor pagination uses stable `(created_at, id)` ordering, the table supports loading further pages, and CSV export fetches every page across all domains. A 205-row regression checks complete traversal without duplicates.
- **Print-file concurrency:** migration v17 adds lifecycle claims for SQLite and PostgreSQL. A five-minute token lease prevents deletion/order-creation races and recovers abandoned cleanup claims; storage deletion is bounded to 60 seconds, and customer order submission returns HTTP 409 if cleanup already claimed the object. Local migration, API, and concurrency tests cover the behavior; live PostgreSQL rollout remains unverified.

## Incomplete or unverified

- Commit `3fecd26` is pushed. The current permission, retention-concurrency, and ledger-pagination changes pass local verification; hosted status is unverified. Vercel previously served the earlier frontend bundle, and deployment of the current ledger interface is unverified. Render still returns health without a revision, lists seven OpenAPI paths, and returns HTTP 200 to anonymous `/api/v1/developer/keys` requests.
- PostgreSQL migration/startup against the live production project and Supabase private bucket behavior remain unverified.
- Razorpay sandbox checkout and webhook round trip, refunds/reconciliation against provider statements, recurring subscription checkout/collection, tax calculation, and quota enforcement are not verified or fully implemented. Invoice-only hybrid billing is locally implemented; it does not collect money.
- Database migrations now install append-only ledger triggers and a unique provider-transaction index; local SQLite tests cover immutability, compensating entries, and duplicate rejection. Live Supabase migration, pre-existing duplicate review, role/owner bypass protection, and complete reconciliation remain open.
- The merchant vault upload workflow supports inspected PDF/JPEG/PNG files, shop-owned categories, private downloads and deletion. Vault files are excluded from temporary order-file retention and remain until staff delete them; live Supabase behavior and approved long-term retention/privacy policy remain unverified.
- WhatsApp UI and setup routes report unavailable; real Meta onboarding, secure account lifecycle, inbound customer intake, and outbound messages are not implemented.
- Shop-bound API keys authenticate merchant business routes only when `ENABLE_EXTERNAL_API_ACCESS=true`, with environment, expiry, revocation, active membership, and least-privilege scope checks. Webhook delivery has local code and test coverage as described above; external API access is disabled by default, and hosted dispatch, replay controls, more event types, and full operational monitoring remain unverified or incomplete.
- Platform incident handling and mutable runtime configuration require durable, audited backend services. Subscription plan changes and quota enforcement are incomplete.
- A signed, verified desktop installer is unavailable. The agent refuses physical printing by default; no supported printer has been verified end to end.
- Browser-level visual testing, production load testing, shared rate limits, backup/restore drills, monitoring, legal/privacy review, and account recovery remain release work.

## Product decisions already set

- India pilot: Razorpay, with each shop entering its own Key ID, API Secret, and webhook secret.
- Hybrid subscription plus usage is planned; base and per-successfully-printed-side rates remain configurable for the pilot.
- Customer print files are intended to be deleted 24 hours after order completion.
- Countertop QR and print-shop pickup are in scope; kiosk/ATM, franchise, delivery, and space-sharing models are excluded.

## Verification record

For the current local snapshot, `npm run build` and `npm test` completed successfully (224 tests: database 12, shared 13, agent 12, server 187). `npm audit --audit-level=high` timed out twice at the npm registry. Render still serves a stale API. See `BUILD_AND_TEST_RESULTS.md` for the deployment checks.
