# Current implementation evidence

This file records evidence for the current application workspace only. The package acceptance matrix remains the specification; historical phase checkboxes are not verification evidence.

| Requirement | Current implementation | Evidence | Remaining gap |
| --- | --- | --- | --- |
| PUB-04 / PUB-T04: valid contact form submissions persist and do not falsely report success | Home and Contact forms submit to the API; server validates fields, rejects the honeypot, applies an IP rate limit, persists an idempotent request, and returns an error when persistence fails. The browser requires the new record ID/status response and fails closed against a stale backend. | `apps/server/src/controllers/enquiry-controller.ts`; `apps/server/src/middleware/enquiry-rate-limit.ts`; `apps/web/src/api/client.ts`; `apps/server/src/test/api.test.ts`; 153 workspace tests passed on 2026-10-27. | Email/WhatsApp notification and approved retention period are not configured. Rate limit is process-local. Browser visual/E2E coverage is absent. |
| PUB-T05: duplicate submission retry does not create another request | The form reuses a request key for retries; DB uniqueness returns the original enquiry. | Enquiry API integration test submits the same `Idempotency-Key` twice and verifies identical record ID. | Multi-instance concurrency against live PostgreSQL is not yet exercised. |
| ADM-T05 / ADM-T07: support-contact data is restricted and access recorded | Enquiry listing is under the authenticated platform owner/admin router; each list read adds an audit event with actor, address, pagination and purpose. | `apps/server/src/routes/admin-routes.ts`; `apps/server/src/controllers/admin-controller.ts`; API test verifies anonymous denial and audit record. | Dedicated least-privilege support role and user-entered reason flow are not implemented. |
| Scope: no franchise enquiry funnel | Removed the unused franchise-only form variant from the shared public form component. | `apps/web/src/components/EnquiryForm.tsx`; only Home and Contact instantiate it. | Full public sitemap and route inventory still need end-to-end review. |

## Latest commands

- `npm run build` — passed across all workspaces; Vite bundle-size warning remains.
- `npm test` — 153 passed, 0 failed (DB 3, shared 12, agent 7, server 131).
- `npm run lint` — command exits successfully but no workspace lint script is configured.
