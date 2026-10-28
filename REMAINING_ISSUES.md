# Inklly Production Readiness — Open Work

**Status:** Not ready for production; development and verification continue.
**Updated:** 2026-10-28

## Current verification

- `npm run build` passes for all workspaces. The Vite build still reports a large web bundle (~1.19 MB minified JavaScript, before gzip).
- `npm test` passes 178 tests (database 5, shared 13, agent 8, server 152). These are local unit/integration tests, not live provider, storage, browser or hardware verification. `npm run lint` is not configured.
- Agent command polling is now gated on merchant release (`READY_FOR_PRINT`/`IN_PROGRESS`) and verified online payment. Merchant dashboard revenue now comes from the customer-payment ledger rather than order status; both changes have regression coverage.
- Physical printing remains disabled by default and is not verified on hardware. The executor now requires an exact discovered queue match, applies supported range/copies/color/duplex/orientation/paper/collation settings, rejects unsupported options, and reports `SUBMITTED_TO_SPOOLER` instead of claiming physical output. Printer ownership is scoped to the reporting agent, and the Orders UI allows explicit queue selection. Remaining risks include download URL/redirect validation, bounded downloads and safe temporary filenames, stranded local jobs after crashes, driver capability/status fidelity, and hardware verification. Keep `INKLLY_ENABLE_PHYSICAL_PRINTING=false` until these gates are closed.
- Merchant vault categories now persist, but there is no vault document-upload route or connected UI workflow. A versioned migration upgrades existing SQLite and PostgreSQL databases; live PostgreSQL deployment remains unverified.
- Web build emits a bundle-size warning (main JavaScript bundle is about 1.22 MB before gzip).
- Latest supplied Render log: PostgreSQL connects, then startup exits while validating private Supabase Storage configuration. Render requires `STORAGE_DRIVER=supabase`, the Supabase HTTPS project URL, service-role key, and an existing private bucket. The logs use an older generic error than the current source, so the deployed revision is also unverified.
- After pushing `749ac97`, `/p/campus1` still serves Vercel asset `index-BeUK2xKp.js`; the local build generated `index-CPgLLU-_.js`. Render `/health` returns HTTP 200 but does not expose a revision. Neither deployment is verified on the current source.
- Public upload has a per-process concurrency cap before JSON parsing. Per-IP/distributed rate limiting and production-like load validation remain open.
- Public enquiries are now durably stored and shown in the authenticated platform console. No email/WhatsApp notification is configured, and an approved retention period for enquiry contact details/message text is still required. Rate limiting is process-local; a shared edge/WAF limit is needed before horizontal scaling.

## Release blockers and follow-up

1. Configure Render with a stable `JWT_SECRET`, `STORAGE_DRIVER=supabase`, Supabase URL, service-role key, private bucket name, and production database URL. Redeploy current `main`; verify `/health.revision` matches the deployed Git SHA and unauthenticated `/api/v1/developer/keys` returns 401. Current provided log fails at Storage initialization after PostgreSQL connects.
2. Exercise upload, private preview, authenticated agent download, and 24-hour deletion against the real private Supabase bucket. Confirm saved files survive Render restarts and expired objects are physically removed.
   - Implemented locally: PDF page counts and file MIME are derived from stored bytes at upload and order submission; a regression test verifies a forged client page count cannot undercharge an order. Production rollout remains pending.
3. Provide and verify a signed Windows agent installer, checksum, and owner-scoped delivery. The API reports installer availability as false (503) and does not fabricate a checksum.
4. Validate Razorpay end to end with shop-owned Key ID, API Secret, and webhook secret; confirm secrets are encrypted and never returned after save. Use test credentials before production credentials.
5. Verify the real Windows print-agent workflow on supported hardware, including printer discovery, spooler outcomes, network interruption, and `OUTPUT_UNCERTAIN` recovery. No physical print has been verified.
6. Complete origin-restricted authenticated file downloads, bounded downloads and safe filenames, multi-agent inventory ownership, crash recovery to `OUTPUT_UNCERTAIN`, driver capability/status fidelity, and hardware-in-the-loop validation before enabling physical printing.
7. Review remaining merchant, admin, developer, billing, support, vault, and WhatsApp screens against the reference package and acceptance matrix. Existing historical phase checkmarks are not sufficient evidence of completeness.
8. Confirm production CORS, rate limits, backups, monitoring, incident handling, privacy/legal statements, and account recovery before accepting customer data.

## Product scope choices

- India launch uses Razorpay, with each shop entering its own credentials.
- Hybrid shop subscription plus usage is planned; pilot base and per-printed-side prices remain configurable.
- Customer files are intended to be deleted 24 hours after order completion.
- QR ordering and print-shop pickup are in scope. Kiosk/ATM, franchise, space-partner, and delivery workflows are excluded.
- WhatsApp outbound messaging requires configured Meta Business credentials and verified end-to-end behavior.
