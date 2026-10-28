# Inklly Production Readiness — Open Work

**Status:** Not ready for production; development and verification continue.
**Updated:** 2026-10-28

## Current verification

- `npm run build` passes for all workspaces. Vite 6.4.5 reports a large web bundle (1,198.01 kB minified JavaScript, 314.19 kB gzip).
- `npm test` passes 197 tests (database 6, shared 13, agent 12, server 166); `npm audit --audit-level=high` reports zero vulnerabilities. These are local unit/integration tests, not live provider, storage, browser or hardware verification. `npm run lint` is not configured.
- Agent command polling is now gated on merchant release (`READY_FOR_PRINT`/`IN_PROGRESS`) and verified online payment. The local worker catches unexpected execution exceptions, preserves ambiguous output as `OUTPUT_UNCERTAIN`, serializes queue cycles, and drains in-flight work during shutdown. Printer dispatch also requires a fresh heartbeat; stale/unknown queues are not dispatchable. Merchant dashboard revenue now comes from the customer-payment ledger rather than order status; these behaviors have regression coverage.
- Physical printing remains disabled by default and is not verified on hardware. The executor requires an exact discovered queue match, applies supported range/copies/color/duplex/orientation/paper/collation settings, rejects unsupported options, and reports `SUBMITTED_TO_SPOOLER` instead of claiming physical output. Printer ownership is scoped to the reporting agent, and the Orders UI allows explicit queue selection. Downloads are origin/path restricted, redirect-blocked, bounded to 35 MiB, content-checked, and written to random private temporary paths; interrupted dispatched jobs are reported as `OUTPUT_UNCERTAIN` and never automatically retried. Driver capability/status fidelity and hardware verification remain open. Keep `INKLLY_ENABLE_PHYSICAL_PRINTING=false` until these gates are closed.
- Merchant authentication now checks persisted account activity and resolves current shop membership role and permissions for each authenticated request. Global platform permission lifecycle and broader membership-administration workflows still need separate review.
- Developer webhook secrets are encrypted at rest with purpose-bound AES-256-GCM, with legacy plaintext rows migrated at server startup. HTTPS/local-host and event validation are in place; delivery worker, DNS-pinned dispatcher, delivery history, retry policy, and secret rotation/revocation remain open. External API access remains disabled by default.
- Platform tenant onboarding and merchant staff provisioning now create durable records transactionally and return expiring, hashed, single-use setup links. Staff remain inactive until they set a strong password, and selected preset permissions are preserved. SQLite tests cover both flows; the PostgreSQL migration still needs live verification. Invitations are shown once in the authenticated UI; outbound email delivery is not configured. Admin incident handling, runtime configuration, and agent-build downloads still contain local-only or unavailable behavior.
- Merchant `GET /orders` now supports tenant-scoped status filtering, search, allowlisted sorting, and pagination; the Orders screen uses those controls. The separate dashboard refresh still fetches the full order list with files every 15 seconds and should move to aggregate queries. Printer status is heartbeat-derived and dispatch rejects stale/unknown queues. Rate-rule writes reject printer IDs outside the authenticated shop.
- Merchant vault categories now persist, but there is no vault document-upload route or connected UI workflow. A versioned migration upgrades existing SQLite and PostgreSQL databases; live PostgreSQL deployment remains unverified.
- Web build emits a bundle-size warning (main JavaScript bundle is 1,198.01 kB before gzip).
- Latest supplied Render log: PostgreSQL connects, then startup exits while validating private Supabase Storage configuration. Render requires `STORAGE_DRIVER=supabase`, the Supabase HTTPS project URL, service-role key, and an existing private bucket. The logs use an older generic error than the current source, so the deployed revision is also unverified.
- Live deployment check on 2026-10-28: Vercel serves `assets/index-ox1gelNl.js`, while local build generated `assets/index-BuP-eUeH.js`; Render `/health` returns HTTP 200 but does not expose a revision. Render `/api/v1/portal/shop/campus1` returns 404 because the shop is missing or offline. Neither deployment is verified on the current source, and this production tenant state needs correction before the public QR flow works.
- WhatsApp Cloud API onboarding and delivery remain unavailable. The UI now says so directly, and API writes/pairing requests return HTTP 503 without persisting fake pairing state; Meta onboarding, encrypted credential storage, webhooks, and message delivery remain to be built.
- Public upload has a per-process concurrency cap before JSON parsing. Per-IP/distributed rate limiting and production-like load validation remain open.
- Public enquiries are now durably stored and shown in the authenticated platform console. No email/WhatsApp notification is configured, and an approved retention period for enquiry contact details/message text is still required. Rate limiting is process-local; a shared edge/WAF limit is needed before horizontal scaling.

## Release blockers and follow-up

1. Configure Render with a stable `JWT_SECRET`, `STORAGE_DRIVER=supabase`, Supabase URL, service-role key, private bucket name, and production database URL. Redeploy current `main`; verify `/health.revision` matches the deployed Git SHA and unauthenticated `/api/v1/developer/keys` returns 401. Current provided log fails at Storage initialization after PostgreSQL connects.
2. Exercise upload, private preview, authenticated agent download, and 24-hour deletion against the real private Supabase bucket. Confirm saved files survive Render restarts and expired objects are physically removed.
   - Implemented locally: PDF page counts and file MIME are derived from stored bytes at upload and order submission; a regression test verifies a forged client page count cannot undercharge an order. Production rollout remains pending.
3. Provide and verify a signed Windows agent installer, checksum, and owner-scoped delivery. The API reports installer availability as false (503) and does not fabricate a checksum.
4. Validate Razorpay end to end with shop-owned Key ID, API Secret, and webhook secret; confirm secrets are encrypted and never returned after save. Use test credentials before production credentials.
5. Verify the real Windows print-agent workflow on supported hardware, including printer discovery, spooler outcomes, network interruption, and `OUTPUT_UNCERTAIN` recovery. No physical print has been verified.
6. Verify multi-agent inventory ownership, driver capability/status fidelity, and hardware-in-the-loop validation before enabling physical printing. Paired-origin authenticated downloads and crash-to-`OUTPUT_UNCERTAIN` handling are implemented and covered by local tests.
7. Review remaining merchant, admin, developer, billing, support, vault, and WhatsApp screens against the reference package and acceptance matrix. Existing historical phase checkmarks are not sufficient evidence of completeness.
8. Confirm production CORS, rate limits, backups, monitoring, incident handling, privacy/legal statements, and account recovery before accepting customer data.

## Product scope choices

- India launch uses Razorpay, with each shop entering its own credentials.
- Hybrid shop subscription plus usage is planned; pilot base and per-printed-side prices remain configurable.
- Customer files are intended to be deleted 24 hours after order completion.
- QR ordering and print-shop pickup are in scope. Kiosk/ATM, franchise, space-partner, and delivery workflows are excluded.
- WhatsApp outbound messaging requires configured Meta Business credentials and verified end-to-end behavior.
