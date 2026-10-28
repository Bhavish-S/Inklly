# Inklly Requirement Traceability

This table records what the current source and local tests prove. A working code path or passing test is not evidence that its production integration is configured.

| Requirement | Current evidence | Remaining work |
| --- | --- | --- |
| Customer QR order intake, document validation, quote, and order tracking | Portal and order controllers inspect uploaded bytes, calculate prices server-side in integer Paise, persist orders, and return status. API tests cover upload/order and client-supplied page-count tampering. | Browser-level visual and end-to-end verification; live private-storage verification. |
| Tenant isolation and permissions | Authenticated routes enforce shop scope; staff pricing writes require `settings:manage`; platform permissions are checked explicitly. Tests exercise cross-tenant denial and unauthorized pricing changes. | Continue route-by-route security review as features are added. |
| Revocable authentication | Signed session tokens carry a session ID and token hash; authentication checks the persisted active session. Tests cover revocation invalidating an issued token. | HttpOnly cookie migration, MFA, and delivered password-reset flow are not implemented. |
| Customer payments | Per-shop Razorpay credentials are encrypted at rest. Checkout, server-side payment verification, webhook HMAC validation, amount/currency/shop binding, and idempotent ledger updates are implemented. | Live Razorpay sandbox round-trip and production account setup. |
| Cash collection and refunds | Counter cash records payment/order/ledger changes transactionally; refund requests remain pending unless provider processing is configured. | Live provider refund workflow and settlement reconciliation. |
| PostgreSQL persistence | PostgreSQL startup installs the baseline schema and applies versioned dispatch-ack migration. TLS verification is enabled. | Validate migrations against a clean Supabase project and a copy of the deployed schema. |
| Private customer-file storage | Production requires Supabase Storage; startup checks the configured bucket exists and is private; upload/read/delete use authenticated server requests. | Latest Render log reports missing/invalid Supabase Storage settings. Configure Render and verify live object lifecycle/retention. |
| Agent dispatch handoff | Poll tickets have stable IDs, are replayed until locally acknowledged, and expire to `OUTPUT_UNCERTAIN` without blind redispatch. Agent outcomes persist in a local SQLite outbox and retry after restart. Tests exercise replay, acknowledgment, expiry, and result persistence. | Validate against the deployed server and packaged agent binary. |
| Physical printing | Disabled by default via `INKLLY_ENABLE_PHYSICAL_PRINTING`; the agent fails explicitly without downloading or submitting customer files. | Explicitly out of scope for this build pass; hardware setup and output reconciliation remain future work. |
| Printer profiles | Merchant Save Printer persists the profile through the API; the UI reloads from server and distinguishes save from refresh failure. New profiles are offline until an agent reports connectivity. | Agent-to-printer inventory/heartbeat reporting is not yet established; the web workspace has no UI test runner. |
| Customer order tracker | `AWAITING_PAYMENT`, processing, collection, cancelled, and attention-required states have explicit copy; pickup token is shown only when available. | Add browser component tests when the web workspace has a test framework. |
| SaaS subscriptions and usage billing | Dashboard states pilot billing is not active; checkout endpoints fail closed. | Implement platform subscription lifecycle, configurable monthly/per-printed-side rates, idempotent usage events, and platform billing provider integration. |
| WhatsApp | Setup scaffolding exists. | Meta OAuth, inbound webhook, and message delivery are not implemented; do not treat the current setup panel as a live integration. |
| Developer APIs and webhooks | API docs and credential/webhook management scaffolding exist behind authentication and an external-access gate. | Confirm actual public API lifecycle, signing, delivery retries, and governance before enabling external access. |
| Local checks | `npm run build` passes; `npm test` passes 171 tests (DB 3, shared 12, agent 8, server 148). | Configure linting and browser visual/E2E checks. |

## Deployment blocker from current Render logs

The latest Render attempt successfully connected to PostgreSQL but exited during private file-storage initialization. Set `STORAGE_DRIVER=supabase`, the project HTTPS `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and an existing private `SUPABASE_STORAGE_BUCKET` in Render. Never expose the service-role key to the browser or commit it.
