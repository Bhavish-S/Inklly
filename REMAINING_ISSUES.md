# Inklly Production Readiness — Open Work

**Status:** Not ready for production; development and verification continue.
**Updated:** 2026-10-27

## Current verification

- `packages/db`, `packages/shared`, `apps/server`, and `apps/web` production builds pass.
- Full workspace test run after the website enquiry change: 153 passed, 0 failed (database 3, shared 12, agent 7, server 131). `npm run lint` completed but no workspace defines a lint script. Supabase Storage behavior is tested with a mocked HTTP transport; it has not yet been verified against the connected project.
- Web build emits a bundle-size warning (main JavaScript bundle is about 1.22 MB before gzip).
- Before this turn, GitHub `main` contained commit `a27b0a4`; the current enquiry implementation is being prepared for push and deployment verification.
- After that push, live Render returned HTTP 200 for `/health` but did not include the new `revision` field; unauthenticated `/api/v1/developer/keys` still returned HTTP 200 with `[]`. Render is not confirmed to be running current source. The pasted Render build log checked out older commit `33cd615` and failed startup for missing `JWT_SECRET`.
- Public upload now has a per-process concurrency cap before JSON parsing. Per-IP/distributed rate limiting and production-like load validation remain open.
- A live Render probe during the latest turn timed out at `https://inklly.onrender.com/health`; current runtime health could not be confirmed.
- Public enquiries are now durably stored and shown in the authenticated platform console. No email/WhatsApp notification is configured, and an approved retention period for enquiry contact details/message text is still required. Rate limiting is process-local; a shared edge/WAF limit is needed before horizontal scaling.

## Release blockers and follow-up

1. Confirm Render deploys commit `025dbca`; configure a stable `JWT_SECRET`, `STORAGE_DRIVER=supabase`, Supabase URL, service-role key, bucket name, and production database URL. Verify `/health.revision` matches `025dbca` and unauthenticated `/api/v1/developer/keys` returns 401.
2. Exercise upload, private preview, authenticated agent download, and 24-hour deletion against the real private Supabase bucket. Confirm saved files survive Render restarts and expired objects are physically removed.
   - Implemented locally: PDF page counts and file MIME are derived from stored bytes at upload and order submission; a regression test verifies a forged client page count cannot undercharge an order. Production rollout remains pending.
3. Provide and verify a signed Windows agent installer, checksum, and owner-scoped delivery. The API reports installer availability as false (503) and does not fabricate a checksum.
4. Validate Razorpay end to end with shop-owned Key ID, API Secret, and webhook secret; confirm secrets are encrypted and never returned after save. Use test credentials before production credentials.
5. Verify the real Windows print-agent workflow on supported hardware, including printer discovery, spooler outcomes, network interruption, and `OUTPUT_UNCERTAIN` recovery. No physical print has been verified.
6. Review remaining merchant, admin, developer, billing, support, and WhatsApp screens against the reference package and acceptance matrix. Existing historical phase checkmarks are not sufficient evidence of completeness.
7. Confirm production CORS, rate limits, backups, monitoring, incident handling, privacy/legal statements, and account recovery before accepting customer data.

## Product scope choices

- India launch uses Razorpay, with each shop entering its own credentials.
- Hybrid shop subscription plus usage is planned; pilot base and per-printed-side prices remain configurable.
- Customer files are intended to be deleted 24 hours after order completion.
- QR ordering and print-shop pickup are in scope. Kiosk/ATM, franchise, space-partner, and delivery workflows are excluded.
- WhatsApp outbound messaging requires configured Meta Business credentials and verified end-to-end behavior.
