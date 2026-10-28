# Inklly Desktop Agent: Windows Installer and Printing Status

**Verified against local source:** 2026-10-28
**Release status:** Not ready for production installation or physical printing.

This document records the behavior present in `apps/agent` and the server API. It does not certify any printer model, driver, installer, or physical output.

## Installer availability

- The deployment has no verified, signed Inklly agent installer configured. `GET /api/v1/agent/download` returns HTTP 503 with `installerAvailable: false` for supported shop metadata requests.
- Public setup scripts and legacy installer file paths are disabled. The repository's `apps/agent/Inklly-Agent-Setup.bat` is a fail-closed notice, not an installer.
- Do not deploy a batch file containing shop IDs, pairing codes, agent secrets, or payment credentials. Do not publish an installer until its source, signature, checksum, owner-scoped delivery, upgrade path, and Windows configuration protection have been reviewed.

## Current agent behavior

- The agent listens on `127.0.0.1` and exposes read-only `/status` and `/health` diagnostics. Browser-originated requests cannot pair the agent, replace credentials, or submit print work.
- The agent enrolls using a short-lived shop pairing code and then authenticates to the server with its agent identity and secret. Agent configuration is stored locally; Windows ACL protection for those credentials is not yet verified.
- On Windows, discovery enumerates installed queues and reports their name, driver name, default status, and conservative online status. Color and duplex capabilities remain unknown; paper trays are not reported.
- Physical printing is disabled unless the agent process is explicitly configured with `INKLLY_ENABLE_PHYSICAL_PRINTING=true`. Keep it disabled until Windows hardware and failure-recovery verification is complete.
- The current executor rejects mixed-color, manual-duplex, multiple-pages-per-sheet, and unverified paper-size requests. A successful `SUBMITTED_TO_SPOOLER` result means the operating-system spooler accepted the request; it does not confirm that pages came out of the printer.
- Interrupted or ambiguous output is recorded as `OUTPUT_UNCERTAIN`. The queue does not blindly retry it. An operator must reconcile the physical result before taking a new print action.

## Local development

Use the repository workspace scripts from `Source Code/`:

```sh
npm install
npm run build --workspace=apps/agent
npm run dev:agent
```

The server has an owner-scoped short-lived pairing-code API for controlled development/manual testing, but production self-service pairing is not released. Keep any pairing code and resulting agent secret out of source files and logs. This source workflow has not been packaged as a production installer.

## Release verification still required

1. Build a reproducible Windows installer, sign it, publish a verified checksum, and implement owner-scoped download and upgrade flows.
2. Protect agent credentials with Windows account/ACL or OS-backed secret storage; verify permissions after first pairing and restart.
3. Validate queue discovery, driver capabilities, paper sizes, orientation, copies, duplex, page ranges, cancellation, and spooler results on supported Windows versions and real devices.
4. Exercise shutdown, power loss, network interruption, spooler restart, paper jam, duplicate delivery, and `OUTPUT_UNCERTAIN` reconciliation without creating duplicate prints.
5. Confirm installer and agent tests in CI and record hardware test results for each supported model/driver combination.

Current source-level behavior and test evidence are summarized in `BUILD_AND_TEST_RESULTS.md` and `REMAINING_ISSUES.md`.
