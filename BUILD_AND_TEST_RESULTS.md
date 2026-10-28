# Inkly Build and Test Evidence

**Last verified:** 2026-10-28 (local workspace, Asia/Kolkata)

## Current local verification

- `npm run build` — passed for database, shared, desktop agent, server, and web workspaces. Vite reports a large JavaScript chunk warning; the build completes successfully.
- `npm test` — 178 passed, 0 failed: database 5, shared 13, agent 8, server 152.
- `npm run lint` — no root lint script is currently configured.

The test suite covers deterministic Paise pricing, tenant boundaries, signed/revocable sessions, customer order and payment paths, private-storage behavior through a mocked Supabase API, merchant vault and printer ownership migrations, agent result persistence, dispatch replay/acknowledgment, expired handoff safety, and the physical-printing pilot gate.

The print-release path now requires an online registered shop printer (or exactly one online default), assigns the target to every unassigned print job in the same transaction as order state changes, and excludes unassigned/offline targets from agent polling. Agent heartbeats synchronize inventory under the paired agent identity, so agents receive only their own queue's jobs. The Live Print screen and order printer selector consume API inventory instead of displaying sample devices. Printer discovery no longer invents HP/Canon devices, and a successful Sumatra process reports spooler submission rather than confirmed physical output.

## Deployment and integration limits

- These results are from the local source tree. After pushing `749ac97`, Vercel still serves `assets/index-BeUK2xKp.js`, while this build produced `assets/index-CPgLLU-_.js`; the frontend deployment is not yet current. Render `/health` returns HTTP 200 but omits a source revision, so its deployed commit remains unverified.
- The latest Render log connected to Supabase PostgreSQL and then exited because `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and/or the configured private Storage bucket are missing or invalid.
- Supabase Storage tests mock the HTTP API. Live bucket permissions and file retention have not been verified against the production project.
- Razorpay tests use test doubles; a live sandbox checkout/webhook round trip has not been verified here.
- Subscription checkout and per-successfully-printed-side SaaS billing are not implemented.
- The desktop agent refuses physical printing by default. If explicitly enabled, it requires an exact online local queue match and rejects unsupported mixed-color, manual-duplex, or multi-up requests; real printer output, hardware status/capability accuracy, OS queue reconciliation, and post-spool outcome confirmation still require Windows hardware verification.
- Agent ticket polling is now gated by merchant release status and verified online payment. The server integration test confirms an unreviewed customer order is withheld and becomes pollable after release. The full agent-to-Windows-spooler lifecycle is not verified on physical hardware.
- The merchant dashboard's revenue KPI now sums the customer-payment ledger. A regression test confirms a collected-but-unpaid order does not increase revenue.
- Merchant storage category and document tables are present in the generated schema; a versioned migration upgrades existing SQLite and PostgreSQL databases and a test checks migration registration and table presence. Live PostgreSQL migration/startup is not yet verified.
- Browser visual/E2E testing was not run; the local browser surface was unavailable in this session.

## Reproduction

Run from this directory:

```sh
npm run build
npm test
```
