# Inklly Implementation Plan

**Status:** Active productization; not production-ready.
**Last updated:** 2026-10-28

## Milestones

| Milestone | Current state | Evidence / remaining work |
|---|---|---|
| 1. Foundation, auth, tenancy | Implemented locally | Signed sessions with revocation; tenant-scoped API tests pass. PostgreSQL baseline schema startup works in source. Verify deployed Render revision and live schema. |
| 2. Customer ordering and private uploads | In progress | Server inspects stored bytes; uploads require shop-scoped keys. Customer view generates ID-card and photo sheets as real PNG uploads. Verify private Supabase bucket on Render and document retention against production storage. |
| 3. Pricing and order persistence | In progress | Integer-paise quote engine covers configured page rates, mixed B&W/colour, copy and bulk discounts. Customer checkout uses server quotes and requires review on stale price. Taxes, configured media/finishing prices, and explicit immutable quote snapshots need completion. |
| 4. Merchant operations | In progress | API-backed queue and printer-profile saving; unpaid Razorpay orders have a dedicated queue and server-side release guard. Add complete filters/pagination, audit history, and verify all operational actions end to end. |
| 5. Razorpay payments | Integration boundary implemented | Per-shop encrypted credentials, server-created intents, capture verification, and signed/idempotent webhook path have local tests. Verify using the shop's sandbox account and deployed webhook. |
| 6. Desktop agent | Partial | Authenticated polling, heartbeat, local SQLite outbox, and dispatch acknowledgement work in tests. Installer is unavailable and physical printing is disabled. |
| 7. Routing and recovery | Partial | Stable command IDs, acknowledgement lease, and `OUTPUT_UNCERTAIN` behavior exist. Capability-based route selection and hardware reconciliation remain unverified. |
| 8. Messaging integrations | Not complete | WhatsApp lookup is explicitly labelled unavailable. Implement official Meta messaging only with approved credentials, templates, consent, and delivery records. |
| 9. Platform administration and SaaS billing | Partial | Platform tenant/admin surfaces and ledger APIs exist. Recurring subscription checkout and hybrid usage billing are not live; configure pilot rates before enabling billing. |
| 10. Hardening and release verification | In progress | Local build and tests pass; production storage and payments, security review, browser accessibility, load/performance, backups, and hardware workflow remain open. |

## Current verified commands

- `npm run build` — passed on 2026-10-28; Vite reports a large JavaScript chunk warning.
- `npm test` — passed on 2026-10-28: database 3, shared 13, agent 8, server 152 (176 total).
- `npm run lint` — no workspace currently defines a lint script.

These checks validate local code only. They do not verify live Render configuration, Supabase bucket access, Razorpay account events, the Vercel deployment, or physical printing.

## Next work

1. Configure Render's private Supabase Storage variables and bucket, then verify the running source revision.
2. Confirm uploaded documents, private merchant/agent reads, and 24-hour post-completion deletion on the real bucket.
3. Reconcile customer, merchant, platform, and developer screens against `reference/pasted-text-1.txt`; replace remaining simulated state with API-backed workflows or label it unavailable.
4. Finish payment reconciliation/idempotency and persist an immutable quote/rate-rule snapshot with every accepted order.
5. Complete tenant/role boundary review and user-facing accessibility/responsive checks.
6. Complete physical-print settings, exact printer targeting, authenticated document fetching, crash reconciliation, and hardware verification before enabling `INKLLY_ENABLE_PHYSICAL_PRINTING`.

## Product boundaries

Inklly branding, QR ordering, multi-tenant shop data, exact server-generated prices, and safe print uncertainty are in scope. Kiosk/ATM and franchise flows are excluded. Physical printing remains in scope and is pilot-gated until the end-to-end workflow is safe and verified.
