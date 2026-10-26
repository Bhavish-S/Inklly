# Inklly — Smart Print-Shop Automation & Self-Service Document OS

> 🧠 **AI Agent & Multi-Machine Portable Notice:**  
> When unzipping this project on any new machine or using Antigravity CLI / AI coding assistants, **read [`BRAIN.md`](./BRAIN.md) first**. It contains complete persistent context, project scope, architecture map, implementation state, and build instructions.

Inklly is an independent, production-oriented multi-tenant SaaS platform built for existing print shops, photocopy centers, and document-service businesses. It replaces chaotic counter queues and WhatsApp file sharing with countertop QR code customer ordering, real-time deterministic quotation in Paise, edge desktop print spooling, and append-only financial ledgers.

---

## 🏗 Architecture & Workspace Structure

```text
D:\Inkly\Source Code\
├── BRAIN.md                    # Master memory & AI agent operational context
├── README.md                   # Public project documentation & quick start
├── IMPLEMENTATION_STATUS.md    # Phase-by-phase implementation ledger
├── BUILD_AND_TEST_RESULTS.md   # Test execution log (33 passing automated tests - 100% pass rate)
├── REMAINING_ISSUES.md         # Production readiness & scope boundary documentation
│
├── apps/
│   ├── web/        # React + Vite Single Page Application (Marketing, Customer QR Portal, Merchant Dashboard, Platform Admin, Developer Hub)
│   ├── server/     # Multi-tenant Node.js Express REST API & Edge Command Dispatch Gateway
│   └── agent/      # Desktop Edge Print Agent Daemon (Windows / macOS Spooler Connector on localhost:8765)
│
├── packages/
│   ├── shared/     # Domain TypeScript models, state machines (Order, Payment, PrintJob), & deterministic pricing engine
│   └── db/         # Relational database schema (16 tables), ACID transactions via native node:sqlite, & seed data
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js v20+ or v24+
- Windows, macOS, or Linux

### 2. Install Dependencies & Build All Workspaces
```bash
# In D:\Inkly\Source Code\
npm install
npm run build
```

### 3. Run Automated Tests
```bash
npm run test
```
*Executes all 33 unit, integration, and state machine tests across `@inklly/shared`, `@inklly/db`, `@inklly/agent`, and `@inklly/server`.*

### 4. Running the Development Services

#### A. Backend API Server (Port 4000)
```bash
npm run dev:server
```
- Health Check: `http://localhost:4000/health`
- Shop QR API: `http://localhost:4000/api/v1/portal/shop/campus1`
- OpenAPI Specification: `http://localhost:4000/api/v1/developer/openapi.json`

#### B. Desktop Edge Print Agent Daemon (Port 8765)
```bash
npm run dev:agent
```
- Status & Diagnostics: `http://127.0.0.1:8765/status`
- Offline SQLite Spool Queue: `http://127.0.0.1:8765/queue`

#### C. Frontend Web Application & Inklly Website (Port 3000)
```bash
npm run dev:web
```
- Inklly Website & Portals: `http://localhost:3000/`
  - Print Shop Automation: `http://localhost:3000/print-shop-automation-software`
  - WhatsApp Printing: `http://localhost:3000/whatsapp-printing-software`
  - QR Code System: `http://localhost:3000/qr-code-printing-system`
  - How It Works: `http://localhost:3000/how-it-works`
  - Transparent Pricing: `http://localhost:3000/pricing`
  - Contact: `http://localhost:3000/contact`
  - Merchant Login: `http://localhost:3000/login`
  - Merchant Sign Up: `http://localhost:3000/register`
  - Legal Policies: `http://localhost:3000/legal/privacy-policy`
- Customer QR Portal (Campus Print Express demo): `http://localhost:3000/p/campus1`
- Merchant Workspace (Order Queue, Rates, Printers, Staff): `http://localhost:3000/merchant`
- Platform Owner Console (GMV, Ledger, Organizations): `http://localhost:3000/platform` (or `/admin`)
- Developer Portal (OpenAPI Spec, API Key Generator, Webhooks): `http://localhost:3000/developer`

---

## 🪟 Windows One-Click Launchers
For Windows users where PowerShell script execution is restricted (`PSSecurityException`), run the batch files directly:
- `start-all.bat`: Launches Server, Desktop Agent, and Web App concurrently in separate windows.
- `run-tests.bat`: Runs all 33 automated tests.
- `start-server.bat`: Runs port 4000 backend API server.
- `start-agent.bat`: Runs port 8765 edge spooler daemon.
- `start-web.bat`: Runs port 3000 web application.

---

## 🔒 Security & Safety Invariants Enforced
1. **Hardware Safety:** Paper jams or spooler connection losses trigger `OUTPUT_UNCERTAIN`. Blind retries are strictly forbidden by the state machine; physical counter verification is required.
2. **Deterministic Minor Units:** All pricing math is computed in integer Paise (₹1.00 = 100 paise), preventing floating point roundoff errors.
3. **Multi-Tenant Isolation:** Server-side tenant scoping enforces that merchants can only access resources belonging to their `shopId` and `organizationId`.
4. **Append-Only Ledgers:** Financial transactions across all 6 money domains (`CUSTOMER_PRINT_PAYMENT`, `SAAS_SUBSCRIPTION`, `CONVERSION_CREDIT`, `MERCHANT_PAYOUT`, `REFUND_DISPUTE`, `REFERRAL_REWARD`) are recorded immutably with webhook idempotency guards.
