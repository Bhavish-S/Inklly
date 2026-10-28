# Inkly Build and Test Evidence

**Last verified:** 2026-10-28 (local workspace, Asia/Kolkata)

## Current local verification

- `npm run build` — passed for database, shared, desktop agent, server, and web workspaces. Vite reports a large JavaScript chunk warning; the build completes successfully.
- `npm test` — 171 passed, 0 failed: database 3, shared 12, agent 8, server 148.
- `npm run lint` — no root lint script is currently configured.

The test suite covers deterministic Paise pricing, tenant boundaries, signed/revocable sessions, customer order and payment paths, private-storage behavior through a mocked Supabase API, agent result persistence, dispatch replay/acknowledgment, expired handoff safety, and the physical-printing pilot gate.

## Deployment and integration limits

- These results are from the local source tree. They do not prove the hosted Vercel or Render services are running this revision.
- The latest Render log connected to Supabase PostgreSQL and then exited because `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and/or the configured private Storage bucket are missing or invalid.
- Supabase Storage tests mock the HTTP API. Live bucket permissions and file retention have not been verified against the production project.
- Razorpay tests use test doubles; a live sandbox checkout/webhook round trip has not been verified here.
- Subscription checkout and per-successfully-printed-side SaaS billing are not implemented.
- The desktop agent refuses physical printing by default. Real printer output is outside the current build scope.
- Browser visual/E2E testing was not run; the local browser surface was unavailable in this session.

## Reproduction

Run from this directory:

```sh
npm run build
npm test
```
