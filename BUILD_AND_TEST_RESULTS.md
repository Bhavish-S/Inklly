# Inklly Build & Test Execution Results

**Execution Date:** 2026-10-26  
**Runtime Environment:** Windows (PowerShell / cmd.exe), Node.js v24.14.0  
**Compilation Status:** ALL WORKSPACES COMPILED CLEANLY  
**Total Automated Tests:** 33 Tests (33 Passed, 0 Failed, 0 Skipped - 100% Pass Rate)  

---

## Latest verification — 2026-10-27

Executed after the public-enquiry persistence/inbox change:

- `npm run build` — passed across all workspaces. Vite reported the existing large-bundle warning (about 1.22 MB main JS and 2.23 MB PDF worker before gzip).
- `npm test` — passed: 3 database, 12 shared, 7 agent, and 131 server tests (153 total).
- New coverage verifies enquiry validation, idempotent retry, platform-only inbox access, and rate-limit rejection.
- `npm run lint` remains unavailable because no workspace defines a lint script.
- No browser screenshots or real Render/Supabase/provider/hardware verification were performed in this change.

---

## 1. Workspace Build Matrix

| Workspace | Package / App Name | Output Target | Build Command | Status |
| :--- | :--- | :--- | :--- | :--- |
| `packages/shared` | `@inklly/shared` | `dist/` (CJS/ESM & `.d.ts`) | `tsc` | **PASS (0 errors)** |
| `packages/db` | `@inklly/db` | `dist/` (`node:sqlite` ORM) | `tsc` | **PASS (0 errors)** |
| `apps/agent` | `@inklly/agent` | `dist/` (Local loopback daemon) | `tsc` | **PASS (0 errors)** |
| `apps/server` | `@inklly/server` | `dist/` (Express API) | `tsc` | **PASS (0 errors)** |
| `apps/web` | `@inklly/web` | `dist/` (Vite SPA production bundle) | `tsc && vite build` | **PASS (0 errors, 464.4 kB JS, 62.2 kB CSS)** |

---

## 2. Test Execution Breakdown

### A. `@inklly/shared` (Domain Math & State Machines)
Command: `npm run test --workspace=@inklly/shared`
- `pricing.test.ts`:
  - ✔ correctly parses complex page ranges (`1-3, 5, 7-9`)
  - ✔ handles "all" or undefined as complete document pages
  - ✔ calculates physical sheets for simplex and duplex correctly
  - ✔ calculates deterministic quote in integer minor units (Paise)
  - ✔ applies copy discounts for additional copies correctly
  - ✔ applies bulk order discount percentage when threshold is reached
- `state-machines.test.ts`:
  - ✔ Order State Machine: allows valid order progression (`DRAFT` $\rightarrow$ `AWAITING_REVIEW` $\rightarrow$ `READY_FOR_PRINT` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `READY_FOR_COLLECTION` $\rightarrow$ `COLLECTED`)
  - ✔ Order State Machine: rejects illegal order progression (e.g. `DRAFT` directly to `COLLECTED`)
  - ✔ Payment State Machine: allows normal payment capture and verified state
  - ✔ Payment State Machine: rejects unauthorized payment jumps
  - ✔ Print Job State Machine & Hardware Safety: allows clean dispatch and confirmation
  - ✔ Print Job State Machine & Hardware Safety: handles uncertain output by requiring operator intervention (`isBlindRetryForbidden`)
- **Result:** **12 / 12 Passing** (Duration: ~111 ms)

### B. `@inklly/db` (Relational Schemas & Multi-Tenancy)
Command: `npm run test --workspace=@inklly/db`
- `database.test.ts`:
  - ✔ correctly loads seeded shop by shopCode (`campus1` $\rightarrow$ Campus Print Express)
  - ✔ stores and retrieves rate rules scoped to shop
  - ✔ persists and updates orders with state machine validation
- **Result:** **3 / 3 Passing** (Duration: ~253 ms)

### C. `@inklly/agent` (Desktop Edge Spooler Connector)
Command: `npm run test --workspace=@inklly/agent`
- `agent.test.ts`:
  - ✔ Enqueues and retrieves print command tickets idempotently
  - ✔ Transitions local offline queue item statuses properly (`PENDING` $\rightarrow$ `DISPATCHED_TO_SPOOLER` $\rightarrow$ `COMPLETED`)
  - ✔ Discovers local printer capabilities including duplex and color
  - ✔ SpoolerExecutor returns `PRINT_CONFIRMED` on clean print submission
  - ✔ Enforces Safety Invariant: Hardware paper jam triggers `OUTPUT_UNCERTAIN` without auto-retry
  - ✔ AgentDaemon boots diagnostics server and serves status on loopback (`http://127.0.0.1:8799/status`)
- **Result:** **6 / 6 Passing** (Duration: ~6.8 s)

### D. `@inklly/server` (Multi-Tenant Backend & Edge Dispatch API)
Command: `npm run test --workspace=@inklly/server`
- `api.test.ts`:
  - ✔ Health Check responds with `HEALTHY` status
  - ✔ QR Portal retrieves shop information by `shop_code` (`/api/v1/portal/shop/campus1`)
  - ✔ Calculates deterministic quote in integer Paise for customer files (`/api/v1/portal/quote`)
  - ✔ Submits order and queries order status via public portal (`/api/v1/portal/orders`)
  - ✔ Authenticates merchant owner and returns JWT session payload (`/api/v1/auth/login`)
  - ✔ Retrieves merchant dashboard stats and orders queue (`/api/v1/merchant/dashboard`)
  - ✔ Enforces valid state transition on order status update (`/api/v1/merchant/orders/:id/status`)
  - ✔ Desktop Print Agent pairs, receives heartbeat, and polls queued tickets (`/api/v1/agent/*`)
  - ✔ Agent download endpoint generates Windows setup script and metadata (`/api/v1/agent/download`)
  - ✔ Collects cash at counter and credits ledger (`/api/v1/payments/orders/:id/collect-cash`)
  - ✔ Platform Owner Console returns system metrics and ledger (`/api/v1/platform/overview`)
  - ✔ Developer Portal generates OpenAPI spec and creates scoped API keys (`/api/v1/developer/*`)
- **Result:** **12 / 12 Passing** (Duration: ~1.9 s)

---

## 3. Overall Test Summary

```text
Total Test Suites: 8
Total Test Cases:  33
Passed:            33
Failed:            0
Skipped:           0
Pass Rate:         100%
```
