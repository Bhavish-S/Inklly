# Inklly Remaining Issues & Production Readiness Ledger

**Status:** ALL PHASES (0 THROUGH 9) SUCCESSFULLY IMPLEMENTED & VERIFIED  
**Date:** 2026-10-25  

---

## 1. Resolved Items
- [x] **Windows PowerShell Execution Policy:** All commands configured to run reliably through `cmd.exe /c "npm ..."` or standard Node scripts.
- [x] **Zero C++ Dependencies:** Replaced heavy sqlite dependencies with Node v24's native `node:sqlite` (`DatabaseSync`), achieving zero compilation failure risks on fresh environments.
- [x] **Hardware Safety Invariant:** Spooler execution guarantees that uncertain paper jam / communication loss scenarios emit `OUTPUT_UNCERTAIN` and block automatic retry loops until the desk operator confirms physical sheets.
- [x] **Integer Minor Unit Currency Calculation:** All pricing math is computed in Paise minor units, preventing floating point roundoff errors across simplex, duplex, copy discounts, and bulk volume thresholds.
- [x] **Cross-Tenant Isolation:** Validated in middleware that merchants cannot query or modify another merchant organization's orders, printers, or settings.
- [x] **Authoritative Brand Alignment & Scope Exclusion:** Purged legacy competitor "Print Catalyst" branding across all active pages, components, meta tags, and views. Replaced with pure Inklly branding. Excluded kiosk and franchise routes from active navigation and wired the Platform Owner Console (`/platform`, `/admin`) and Developer Portal (`/developer`) into the router.

---

## 2. Deferred & Future Enhancements (Per Documented Scope Boundaries)
1. **Live Cloud Payment Provider Credentials:**
   - Production deployment requires configuring live production Razorpay API keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) and webhook signing secrets in `.env`. The codebase currently includes a safe mock test adapter that generates valid payloads and verifies signatures.
2. **Third-Party WhatsApp Cloud API Gateway:**
   - WhatsApp bot template editor and data storage are fully functional. Production broadcasting requires configuring Meta WhatsApp Business Account access tokens and phone number ID.
3. **Physical Kiosk / ATM Hardware:**
   - Explicitly excluded from Inklly scope per `CODEX_MASTER_BUILD_PROMPT.md` and `PRD.md`.
4. **Third-Party 10-Minute Rapid Delivery:**
   - Explicitly deferred per product specifications. Countertop QR ordering and pickup workflow is active.
