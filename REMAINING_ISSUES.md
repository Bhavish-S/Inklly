# Inklly Production Readiness — Open Work

**Status:** Not ready for production; development and verification continue.
**Updated:** 2026-10-27

## Current verification

- `packages/db`, `packages/shared`, `apps/server`, and `apps/web` production builds pass.
- Fresh server test run: 102 passed, 16 failed (118 total). See the local run log `/tmp/inklly-server-current.log`; do not treat older test summaries as current.
- Web build emits a bundle-size warning (main JavaScript bundle is about 1.22 MB before gzip).
- The Vercel frontend and Render API have been deployed previously, but this does not establish that the current uncommitted revision is live or that the two deployments run compatible code.

## Release blockers and follow-up

1. Fix or explicitly replace the 16 failing server tests. Several still assume unsigned agent requests, orders without uploaded files, hardcoded payment success, or an installer artifact that is not present. Retain the security contract while updating fixtures; do not weaken authentication or payment verification to satisfy old tests.
2. Provide and verify a signed Windows agent installer, checksum, and owner-scoped delivery. The API currently reports installer availability as false (503) and does not fabricate a checksum.
3. Validate Razorpay end to end with shop-owned Key ID, API Secret, and webhook secret; confirm the secrets are encrypted and never returned after save. Use test credentials before production credentials.
4. Verify Render runtime configuration and revision, including stable `JWT_SECRET`, database persistence, file-storage persistence, and retention timer behavior. Current external runtime observations showed the deployed API may still be on an older revision.
5. Move private customer documents to durable private object storage before relying on uploads across ephemeral server restarts. Current local disk upload behavior is not a production storage architecture.
6. Verify automated deletion 24 hours after order completion against persisted files and database metadata, including retries and expired-file reads.
7. Verify the real Windows print-agent workflow on supported hardware, including printer enumeration, spooler outcomes, network interruption, and `OUTPUT_UNCERTAIN` recovery. No successful physical print is proven by a local simulation.
8. Replace demo-only or static portal flows with persistent authenticated API behavior where required; review merchant settings, staff permissions, admin operations, and developer key scope against tenant boundaries.
9. Confirm production CORS domains, HTTPS, rate limits, backups, monitoring, incident handling, privacy/legal statements, and account recovery before accepting customer data.

## Product scope choices

- India launch uses Razorpay, with each shop entering its own credentials.
- Hybrid shop subscription plus usage is planned; pilot base and per-printed-side prices remain configurable.
- Customer files are intended to be deleted 24 hours after order completion.
- QR ordering and print-shop pickup are in scope. Kiosk/ATM, franchise, space-partner, and delivery workflows are excluded.
- WhatsApp outbound messaging requires configured Meta Business credentials and verified end-to-end behavior.
