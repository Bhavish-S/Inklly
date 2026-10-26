# 🧠 Inklly Project Brain — Persistent Agent Context & Memory

> **PURPOSE OF THIS FILE:**  
> This file is the **master memory and operational context** for Antigravity CLI, AI pair programmers, and autonomous agents. When this codebase is unzipped onto any computer, drive, or VM, reading this single document gives the agent complete situational awareness: what this project is, what has already been built, strict architectural rules, how to build/run/test, and exactly how to continue.

---

## 📌 1. Project Overview & Identity

- **Project Name:** Inklly (Print Shop Automation & Document Operating System)
- **Primary Mission:** A modern, multi-tenant cloud and desktop software suite built for existing print shops, xerox centers, and document service providers. It replaces chaotic WhatsApp document sharing and counter bottlenecks with **countertop QR code customer ordering**, **deterministic rate calculation in integer Paise**, **desktop edge print spooling**, and **tamper-evident financial ledgers**.
- **Application Workspace:** `D:\Inkly\Source Code\` (or root directory of this unzipped package).
- **Core Technology Stack:**
  - **Monorepo:** npm workspaces (`@inklly/web`, `@inklly/server`, `@inklly/agent`, `@inklly/shared`, `@inklly/db`)
  - **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide icons, HTML5 2D Canvas Editor
  - **Backend API:** Node.js, Express, TypeScript, JWT auth, Role-Based Access Control (RBAC)
  - **Desktop Edge Agent:** Node.js loopback daemon (Port 8765), Windows Spooler integration via PowerShell/PCL fallback
  - **Database & Storage:** Native `node:sqlite` (`DatabaseSync` — zero external C++ dependencies), 16 relational tables with ACID transactions, embedded offline queue SQLite

---

## 🚫 2. Strict Scope & Branding Invariants (NON-NEGOTIABLE)

1. **Brand Identity:** Exclusively **Inklly**. NEVER re-introduce competitor names like *"Print Catalyst"*, *"PrintCatalyst"*, or previous legacy branding.
2. **Excluded Hardware / Scope:**
   - **NO Kiosks or ATM hardware:** Kiosk-specific screens, touchscreens, banknote acceptors, and kiosk hardware telemetry are strictly **EXCLUDED**.
   - **NO Franchise or Space-Partner Flows:** Franchise sales, franchise onboarding, and space-sharing partner models are strictly **EXCLUDED**.
   - **Countertop Shop QR ordering REMAINS INCLUDED** (customers scan a counter QR on their smartphone to upload and configure prints).
3. **Hardware Safety Invariant (`OUTPUT_UNCERTAIN`):**
   - Whenever physical printers encounter a paper jam, spooler disconnection, or power interruption, the state machine MUST transition the job ticket to `OUTPUT_UNCERTAIN`.
   - **Blind retries are forbidden.** The merchant must physically verify the paper tray and clear the jam before retrying or refunding.
4. **Deterministic Money Math:**
   - All rates, quotes, line items, and ledger balances are stored and computed in **integer minor units (Paise: ₹1.00 = 100 Paise)** to guarantee zero floating-point rounding errors.

---

## 🗺️ 3. Workspace Architecture & File Map

```text
Source Code/
├── BRAIN.md                     <-- YOU ARE HERE: Persistent memory & agent instructions
├── README.md                    <-- Public project documentation & quick start
├── IMPLEMENTATION_STATUS.md     <-- Ledger of all implemented phases and features
├── BUILD_AND_TEST_RESULTS.md    <-- Verification & test suite execution audit
├── REMAINING_ISSUES.md          <-- Scope boundaries & production deployment notes
├── package.json                 <-- Monorepo root workspaces configuration
├── start-all.bat                <-- 1-Click Windows launcher (Server + Agent + Web)
├── run-tests.bat                <-- 1-Click Windows test runner
│
├── apps/
│   ├── web/                     <-- React + Vite SPA (Port 3000)
│   │   ├── src/
│   │   │   ├── App.tsx          <-- Client-side router & navigation state
│   │   │   ├── components/      <-- Navbar, Footer, EnquiryForm, Icons
│   │   │   └── views/
│   │   │       ├── MerchantAppView.tsx       <-- Complete 12-family merchant workspace
│   │   │       ├── CustomerPortalOrderView.tsx<-- QR customer upload & Canvas Editor
│   │   │       ├── PlatformAdminView.tsx     <-- Superadmin / Platform Owner Console
│   │   │       ├── DeveloperPortalView.tsx   <-- Developer API & Webhook tools
│   │   │       └── ... (Public marketing pages: Home, Pricing, How It Works, etc.)
│   │
│   ├── server/                  <-- Express REST API (Port 4000)
│   │   ├── src/
│   │   │   ├── index.ts         <-- Server bootstrapper & middleware
│   │   │   ├── routes/          <-- Portal, Merchant, Agent, Platform, Developer routes
│   │   │   └── middleware/      <-- Auth (JWT), Tenant scoping, Error handlers
│   │
│   └── agent/                   <-- Desktop Edge Print Agent Daemon (Port 8765)
│       ├── src/
│       │   ├── daemon.ts        <-- HTTP server on localhost:8765
│       │   ├── discovery.ts     <-- Windows PowerShell printer discovery
│       │   ├── queue.ts         <-- Offline SQLite spooler queue
│       │   └── executor.ts      <-- Print execution & paper jam safety logic
│
└── packages/
    ├── shared/                  <-- Core domain logic & state machines
    │   ├── src/
    │   │   ├── models/          <-- Domain interfaces (Order, Shop, Printer, Quote)
    │   │   ├── state-machines/  <-- Order, Payment, and PrintJob state engines
    │   │   └── pricing-engine/  <-- Integer Paise calculator with copy/bulk discounts
    │
    └── db/                      <-- SQLite database adapter using node:sqlite
        ├── src/
        │   ├── schema.ts        <-- 16 relational tables
        │   ├── database.ts      <-- ACID transaction wrappers & queries
        │   └── seed.ts          <-- Seed data (Shop campus1, default rates, printers)
```

---

## ✅ 4. Current Implementation State (What Has Been Completed)

### A. Merchant Workspace (`/merchant` via [MerchantAppView.tsx](file:///D:/Inkly/Source%20Code/apps/web/src/views/MerchantAppView.tsx))
All 12 navigation destinations are 100% interactive and wired to reactive state:
1. **Dashboard:**
   - 4 Dynamic KPI cards (*Today's Revenue in ₹*, *Total Orders Processed*, *Pending Orders*, *Completed*).
   - SVG Area chart with *Orders vs Revenue* toggle.
   - Dynamic Order Status Donut chart with live status breakdown.
   - Recent Orders table with real-time status badges and *"Open Order Handler →"* button.
2. **Order Queue (All 7 Statuses):**
   - Dynamic tab counter pills: `Pending`, `Processing`, `Printing`, `Rejected`, `Print Failed`, `Done`, `All Orders`.
   - Top-right summary counters: Total Orders, Revenue (₹ INR), Pages.
   - Multi-field search filtering across Order ID, customer, phone, and document title.
   - Contextual actions: `One-Click Print` (sends job ticket to spooler on port 8765, moves to printing, auto-completes to done), `Reject`, `Clear Jam & Retry`, `Reprint`, `View`.
   - Comprehensive Order Detail Modal.
3. **Live Print:**
   - 3 Top KPIs: *Working Printers (2)*, *Printing Now*, *Waiting to Print*.
   - Connected hardware cards: *HP LaserJet Pro M401dne* (USB port 8765) and *Canon imageRUNNER ADVANCE C3530i* (Network IP) with paper tray level gauges, queue pause/resume controls, and calibration test prints.
   - Live Spool Queue Buffer with progress bars.
4. **WhatsApp Setup:**
   - Official Meta WhatsApp Cloud API connection.
   - Alternative QR pairing with 60s countdown timer and pairing simulator.
5. **Permanent Local Storage:**
   - Inklly Agent daemon private folder (`C:\Users\Merchant\InkllyStorage\documents\`).
   - Categorized folders (*College Exams*, *KYC Docs*, *Project Thesis*, *Receipts*).
   - Document inspection with direct **"Send to Spooler (Print Now)"** action.
   - `+ New category` and `Upload files` interactive creation.
6. **Conversion Credits:**
   - Real-time balances (*Remaining*, *Used*, *Included*, *Purchased*).
   - Quick-buy quantity chips (100, 500, 1000, 5000) and custom input.
   - Idempotent purchase simulation with balance updates and toasts.
7. **Withdraw Earnings:**
   - Available, Gross, Platform Fee (2%), and Settled balances.
   - UPI Instant and NEFT Bank Transfer payout requests with min ₹100 validation.
   - Dynamic net payout calculator and historical settlement log.
8. **Referrals:**
   - Permanent code `PUNE2026` with clipboard copy.
   - 6-state financial breakdown chips (*Locked*, *Available*, *Reserved*, *Withdrawn*, etc.).
   - Interactive "Claim ₹500.00 Bonus" action.
9. **Employees:**
   - Active store staff list with roles, shifts, phone, and Counter QR access.
   - `+ Add employee` modal provisioning counter operators/managers.
10. **Train Bot:**
    - Auto-responder store templates (Greeting, Received, Rejection, Completed).
    - Interactive live WhatsApp bot test chat console.
11. **Business Setup (6 Tabs):**
    - *Profile:* Shop identity, GSTIN, shop code (`campus1`), 12 services, onboarding checklist.
    - *Printers:* Edge Agent v1.0.0 installer, pairing key reveal/rotate, printer hardware list.
    - *Pricing:* Paper size tabs (A4, A3, Legal), B&W and Colour rates, single/duplex, live calculator.
    - *Discounts:* 3-tier bulk order discount table, additional copies discount.
    - *Customer Portal:* Accent color themes, feature switches, **interactive live phone preview**.
    - *Automation & Payment:* Razorpay sandbox toggle, cash counter toggle, auto-print policies, separator sheet options.
12. **Shop QR:**
    - Printable standee preview poster, intake URL (`https://inklly.in/p/campus1`), PDF download and test page link.

### B. Customer Intake Portal & Canvas Document Editor (`/p/campus1`)
- Walk-in mobile and desktop upload flow without app download.
- Per-file print options: colorMode, duplexMode, paperSize, orientation, copies, page range.
- **HTML5 Canvas 2D Editor:**
  - 8 draggable corner and edge crop handles with darkened background shroud.
  - 90° clockwise document rotation.
  - Brightness and contrast sliders.
  - 4 Document filters: `natural`, `bw_doc` (thresholded high contrast), `enhanced`, `grayscale`.
- Deterministic quote calculation in integer Paise.
- Order submission with offline fallback tokens (`INK-XXXX`).

### C. Platform Owner / Admin Console (`/platform` via [PlatformAdminView.tsx](file:///D:/Inkly/Source%20Code/apps/web/src/views/PlatformAdminView.tsx))
Complete 7-tab administrative control surface:
1. **Fleet Overview:**
   - Real-time KPIs: Active Tenant Orgs, Active Counter Shops, Connected Spoolers, Platform GMV, Monthly MRR, 100% Spooler Uptime.
   - Quick action shortcuts to Merchants, Incident Queue, and SaaS Plans.
2. **Merchants Directory:**
   - Full-text search and status filter (`ALL`, `ACTIVE`, `SUSPENDED`).
   - One-click `Suspend / Reactivate` toggle with immediate state update and audit trail entry.
   - Deep `"Inspect Tenant Diagnostics"` modal with shop code, owner email, connected printers, and Edge Agent port status.
   - **`+ Onboard Tenant` Modal:** Interactive form to provision new print shop organizations with custom slug, owner details, plan tier (`STARTER`, `GROWTH`, `ENTERPRISE`), and automated audit trail logging.
3. **Plans & Quotas:**
   - Versioned plan catalog (v2.4 Active): Starter (₹499/mo), Growth (₹999/mo), Enterprise (₹2,499/mo) with quotas, feature flags, and active subscriber metrics.
4. **Immutable Financial Ledger:**
   - Partitioned across 6 official domains (`CUSTOMER_PRINT_PAYMENT`, `SAAS_SUBSCRIPTION`, `CONVERSION_CREDIT`, `MERCHANT_PAYOUT`, `DISPUTE_RESERVE`).
   - Cryptographic SHA-256 integrity badge.
   - **`📥 Export Platform Financial Ledger (CSV)`:** Real browser file download generating `Inklly-Platform-Financial-Ledger-{date}.csv`.
5. **Edge Agents Fleet:**
   - Live telemetry for desktop nodes (`agt-campus1-win11`, `agt-viman2-win10`), Windows OS platform, loopback port 8765, connected OEM printers, and local SQLite queue depths.
   - **`Ping Diagnostics`:** Interactive loopback probe measuring network latency and updating heartbeat status.
6. **Incident Response:**
   - Escalation queue for spooler paper jams (`OUTPUT_UNCERTAIN`), webhook spikes, and delayed UPI webhooks.
   - Severity badges (`HIGH`, `MEDIUM`, `LOW`) and interactive **`Mark Resolved`** button.
7. **Privileged Security & Operational Audit Log:**
   - Immutable security trail logging Event ID, Actor, Role, Executed Action, Target Tenant, IP Address, and Timestamp.
   - **`📥 Export Audit Log (CSV)`:** Real browser file download generating `Inklly-Platform-Audit-Trail-{date}.csv`.
8. **System Config & Runtime Rules (`config`):**
   - Global Money & Currency rules (INR ₹, 100 Paise invariant, 2.0% platform fee, ₹100 minimum payout).
   - Edge Spooler Standards (Loopback port 8765, 15s heartbeats, `OUTPUT_UNCERTAIN` paper jam policy prohibiting blind retries).
   - Feature flags & killswitches (Canvas crop, instant UPI QR, WhatsApp Cloud gateway, offline emergency queue).
   - Interactive **`Save Runtime Configuration`** with audit trail logging.

### D. Developer & Integration Portal (`/developer` via [DeveloperPortalView.tsx](file:///D:/Inkly/Source%20Code/apps/web/src/views/DeveloperPortalView.tsx))
Comprehensive 6-tab developer & integration engineering suite:
- **Environment & Gateway Selector Bar:** Fast switching between `Local (:4000)`, `Sandbox Staging`, and `Production (Read-Only)`.
- **Integrations Health Matrix & Diagnostic Ping:** Live status of Express REST API, SQLite ACID database, Windows Spooler loopback, Razorpay Webhooks, and Meta WhatsApp Cloud API with interactive `Ping All Integrations` probe.
1. **Interactive API Explorer & "Try It Out" Console:**
   - Grouped by Domain: *Customer Portal API* (`/portal/quote`, `/portal/orders`, `/portal/shop/campus1`), *Merchant POS API* (`/merchant/orders`, `/merchant/orders/:id/dispatch-print`), *Edge Spooler Daemon API* (`:8765/health`), and *Webhooks API* (`/developer/test-webhook`).
   - Live execution against local backend with real HTTP status codes (200 OK, 201 Created), latency timer (ms), response headers, and formatted syntax-colored JSON responses.
2. **Scoped API Key Manager:**
   - Dual environment support: Sandbox / Test (`ink_test_...`) and Production (`ink_live_...`).
   - Granular least-privilege checkboxes: `orders:read`, `orders:write`, `printers:read`, `printers:spool`, `ledger:read`, `webhooks:manage`.
   - **Secure One-Time Reveal Modal:** Displays newly generated key token once with 1-click clipboard copy and storage warnings.
   - Revoke Key action with state updates.
3. **Webhook Event Simulator & HMAC-SHA256:**
   - Supported event types: `order.created`, `order.status_changed`, `payment.succeeded`, `print_job.jammed`, `spooler.offline`.
   - Dynamic HMAC-SHA256 signature generator (`X-Inklly-Signature-256`).
   - Real-time event dispatcher with delivery history table and payload preview.
4. **Multi-Language SDK Code Snippets:**
   - Interactive code generator for `cURL`, `TypeScript / Node.js`, `Python (requests)`, and `C# .NET (HttpClient)`.
   - 1-click copy with instant feedback toast.
5. **Edge Spooler Daemon Diagnostics (Port 8765):**
   - Direct loopback probe to `http://localhost:8765/health` testing Windows Print Spooler (`winspool.drv`), latency metrics, local SQLite buffer, and detected OEM hardware queues.
   - Ready-to-run PowerShell discovery command (`Get-Printer | Select-Object Name, PortName, DriverName, PrinterStatus`).
6. **OpenAPI 3.0 Contract Tree & Download:**
   - Interactive tree of OpenAPI 3.0.3 specification paths, parameters, and responses.
   - **`📥 Download Inklly-OpenAPI-v1.json`:** Direct browser download button generating standalone OpenAPI JSON file.

### E. Brand Identity & Modern UI/UX Upgrades
- **End-to-End Workflow Synchronization (`localStorage` & API):**
  - Customer Portal (`/p/campus1`): Orders submitted via UPI or Cash immediately synchronize to `inklly_live_orders` and the merchant's real-time queue.
  - Merchant Workspace (`/merchant`): Live queue detects newly placed orders without page refresh; clicking `One-Click Print` automatically transitions the order from `Pending` $\rightarrow$ `Printing` $\rightarrow$ `Done`, updates the active spooler in `Live Print`, updates Dashboard KPI metrics, and synchronizes the live customer tracker on `/track` to display `🎉 Your Prints are Ready for Pickup!`.
  - Zero raw `alert()` popups: All buttons trigger real file downloads, clipboard copy with feedback, inline toasts, or live modal disclosures.
  - Printable Counter Standee: Clicking "Download QR (PDF)" in Shop QR generates an authentic standalone printable A4/4x6 standee HTML/PDF with vector QR and shop instructions.
- **Custom Inklly Vector Emblem (`InkllyMark` & `Logo`):**
  - Designed bespoke vector emblem combining multi-layer rounded paper sheets, high-speed print passes, and a fluid cyan ink droplet with light reflections.
  - Deployed across the entire application: [Navbar.tsx](file:///D:/Inkly/Source%20Code/apps/web/src/components/Navbar.tsx), [Footer.tsx](file:///D:/Inkly/Source%20Code/apps/web/src/components/Footer.tsx), [MerchantAppView.tsx](file:///D:/Inkly/Source%20Code/apps/web/src/views/MerchantAppView.tsx), [LoginPage.tsx](file:///D:/Inkly/Source%20Code/apps/web/src/pages/LoginPage.tsx), [RegisterPage.tsx](file:///D:/Inkly/Source%20Code/apps/web/src/pages/RegisterPage.tsx), and [CustomerPortalOrderView.tsx](file:///D:/Inkly/Source%20Code/apps/web/src/views/CustomerPortalOrderView.tsx).
- **Customer Portal Checkout & Instant UPI Flow:**
  - **Dual Checkout:** Customers can choose between **"⚡ UPI Pay (Instant Auto-Release)"** and **"💵 Cash at Counter"**.
  - **Dynamic UPI Payment Modal:** High-contrast QR code with Inklly center emblem, exact ₹ amount, 5-minute ticking countdown timer, one-click copyable UPI ID (`inklly.campus1@icici`), direct GPay/PhonePe/Paytm/BHIM app badges, and simulated webhook verification.
  - **Enhanced Drag-and-Drop Dropzone:** Real-time dragover hover highlight (`isDragging`) with glowing indigo border and drop upload animation.
  - **Visual Print Options Selector:** Color Mode with monochrome vs CMYK radial gradient swatches, Duplex Mode with green "🌿 Saves 50% Paper" badge, and live doc cost calculation.
  - **Order Confirmation Experience:** Large monospace pickup token (`INK-XXXX`) with one-click clipboard copy, 4-step real-time order pipeline tracker (`Order Validated` $\rightarrow$ `Spooler Dispatched` $\rightarrow$ `High-Speed Laser Printing` $\rightarrow$ `Counter Pickup`), and 1-click WhatsApp token sharing.
- **Merchant Operating Workspace Elevating UX:**
  - **Review Your Plan Modal:** Centered upgrade review modal directly from top-bar CTA featuring 3 plan tiers (Starter, Growth, Enterprise), monthly vs yearly billing toggle (Save 20%), GST invoice details, optional capacity add-ons (Printers, WhatsApp bots, credits), and Razorpay AutoPay mandate authorization.
  - **Global Order Search Bar:** Top-bar input wired directly to reactive `orderSearchQuery` with automatic routing to the Orders queue and instant search clearing.
  - **Live Fleet Status Pill:** Real-time pulse indicator (`🟢 Shop Online • 2 Spoolers Ready`) in the top navigation bar.
  - **Dynamic Sidebar Badges:** Real-time counter pills for active order queue (`Orders [3]`), active spooler tickets (`Live Print [1]`), and credit balances (`Credits [₹420]`).
  - **Quick Counter Test Button:** `Shop QR Portal ↗` in the top bar to test the customer intake flow instantly.
  - **Unified Global Toast:** Top-center floating toast for all cloud sync actions, setting updates, and plan upgrades.
- **Glassmorphic Navigation Bar & Micro-Interactions:**
  - Frosted glass scroll styling (`backdrop-blur-md`, subtle border and soft ambient shadow).
  - Tactile button press feedback (`button:active:not(:disabled) { transform: scale(0.985); }`).
  - Accessible `@media (prefers-reduced-motion: reduce)` motion compliance following modern web standards.
- **Cleaned CSS Architecture:**
  - Removed legacy `.btn-franchise` class from `index.css` and upgraded to `.btn-brand-deep` / `.btn-accent`.

---

## ⚡ 5. How to Build & Run on Any Machine

### Step 1: Install Dependencies
```cmd
npm install
```

### Step 2: Build All Workspaces
```cmd
npm run build
```
*(Compiles `@inklly/db`, `@inklly/shared`, `@inklly/agent`, `@inklly/server`, and runs Vite production build for `@inklly/web`)*.

### Step 3: Run Automated Test Suite
```cmd
npm test
```
*(Executes all 33 unit and integration tests across all packages; 100% pass rate).*

### Step 4: Start All Services (Windows 1-Click)
Double-click `start-all.bat` or run:
```cmd
start-all.bat
```
Or start manually in separate terminals:
- **Server:** `npm run dev:server` (Port 4000)
- **Agent:** `npm run dev:agent` (Port 8765)
- **Web:** `npm run dev:web` (Port 3000)

### Step 5: Windows Counter Agent Setup & Diagnostics
For Windows counter terminals, double-click `install-agent-windows.bat`:
- Tests Windows Print Spooler (`winspool.drv`)
- Queries hardware printers via native PowerShell (`Get-Printer`)
- Binds to loopback port `8765` and initiates offline SQLite queue (`agent_queue.db`)

---

## 🖨️ 6. Windows Drivers & Desktop Agent Architecture (Static Analysis Summary)

- **Competitor Artifact Audit (`D:\helolo\`):**
  - `PrintCatalyst-1.6.1-win-x64.msi` (128 MB): Unsigned WiX MSI packaging full Chromium/Electron runtime (85 files, >150 MB RAM). Replaced by lightweight Inklly Agent (<25 MB RAM).
  - `PrintCatalystLegacyAgent-1.5.51-windows7-x64.msi` (9.2 MB) & `x86.msi` (9.1 MB): Unsigned legacy agents packaging external `SumatraPDF-3.4.6-32.exe` and autostart Run-keys.
  - `usb-autorun-creator-2-installer.exe` (2.1 MB): Softonic download wrapper with obsolete USB autorun vectors. **Permanently excluded** from Inklly for security.
- **Inklly Native Spooler Integration:**
  - Interfaces directly with Windows Print Spooler (`winspool.drv`), utilizing existing manufacturer OEM drivers (HP, Canon, Epson, Brother, Ricoh, Xerox).
  - Multi-architecture platform selector in Merchant UI (`/merchant` $\rightarrow$ Business Setup $\rightarrow$ Printers): Windows 10/11 x64, Windows 7/8 Legacy x64, Windows 7/8 Legacy x86, macOS, Linux.
  - Real browser download of `Inklly-Agent-Setup-{platform}.bat` dynamically configured with merchant shopCode and pairing credentials.
  - Server endpoints: `/api/v1/agent/download`, `/api/v1/agent/driver-matrix`, `/api/v1/agent/diagnostics`.
  - Full technical report: [WINDOWS_DRIVERS_AND_INSTALLER_AUDIT.md](file:///D:/Inkly/Source%20Code/WINDOWS_DRIVERS_AND_INSTALLER_AUDIT.md).

---

## 🧭 7. Original Product Codebase Audit & Feature Parity Analysis (`C:\Users\user\Desktop\printcatalyst.in (1)`)

- **Codebase Discovery & Decompilation:**
  - Full analysis of `C:\Users\user\Desktop\printcatalyst.in (1)` including all 39 dynamic code chunks (`SuperAdminPanel`, `PortalPage`, `Dashboard3Panel`, `DocumentStudio`, `FinancialReportPanel`, `StaffApp`, `SubscriptionModal`, etc.).
- **Capabilities Extracted & Built into Inklly:**
  1. **Customer Self-Service Ordering Portal (`apps/web/src/views/CustomerPortalOrderView.tsx`):**
     - **4 Specialized Intake Modes:**
       - `📄 Standard Documents`: Multi-page PDFs, Word, PowerPoint, TXT, Images with automatic page count extraction.
       - `🪪 ID Card 2-in-1 Studio`: Front & Back upload, Stacked or Side-by-Side layout on a single A4 sheet, automatic cutting outlines, and live preview.
       - `📸 Passport Photo Studio`: 1-photo upload, 8-photo grid (4×6 photo paper) or 16-photo grid (A4), background tint selector (Studio White, Visa Sky Blue, Off-White), cutting guidelines, and instant preview.
       - `💬 WhatsApp Drop Link`: Instant lookup by 10-digit mobile number or 4-digit pickup code to load an existing chat order into the browser.
     - **Paper Grades & GSM Selection:** Standard 75 GSM, Bond 85 GSM (+₹0.50), Executive 100 GSM (+₹1.50), Glossy Photo Paper 180 GSM (+₹12.00), Card Stock 250 GSM (+₹8.00).
     - **Finishing & Post-Print Binding:** No Finishing (₹0), Corner Staple (+₹2.00), Spiral Binding (+₹35.00), Thermal Soft Binding (+₹60.00), Lamination (+₹25.00).
  2. **Platform Owner / Superadmin Console (`apps/web/src/views/PlatformAdminView.tsx`):**
     - 10 Enterprise Tabs: Fleet Overview, Merchants Directory, Windows Agent Builds, Plans & Quotas, Financial Ledger, Edge Spoolers Fleet, Incident Response, Storage & Retention, Audit Logs, Runtime Rules.
     - Windows Agent Builds Distribution: Download links for `Inklly-Agent-1.6.1-win-x64.msi`, `Inklly-LegacyAgent-1.5.5-win7-x86.msi`, and `Inklly-Agent-Setup.bat`.
     - Storage Retention Engine: Telemetry of cached vs expired files, one-click retention purge to enforce zero-knowledge document privacy.
     - CSV Browser Downloads: Merchants Directory CSV, Platform Financial Ledger CSV, and Audit Trail CSV.
  3. **Developer & Integration Hub (`apps/web/src/views/DeveloperPortalView.tsx`):**
     - Real-time API Explorer against Local `:4000` with latency timer, HTTP status badges, and formatted JSON output.
     - Scoped API Key Manager with 1-time secret reveal modal and revocation.
     - Webhook Event Simulator with HMAC-SHA256 signature generator (`X-Inklly-Signature-256`).
     - Multi-language SDK snippets (cURL, TypeScript/Node.js, Python, C# .NET).
     - OpenAPI 3.0 Contract with interactive schema tree and 1-click download (`Inklly-OpenAPI-v1.json`).

---

## 🧭 8. Instructions for Future AI Agents

When opening this codebase to add features, fix bugs, or expand capabilities:
1. **Always read this file first (`BRAIN.md`)** to preserve project scope and invariants.
2. **Never break the 33 automated tests:** Always run `npm test` after making modifications.
3. **Keep Node dependencies clean:** We use Node 20+ native `node:sqlite`. Do NOT install heavy native packages like `better-sqlite3` or Python-dependent C++ build tools.
4. **Preserve Integer Paise Math:** Any price calculation must use `packages/shared/src/pricing-engine/calculator.ts` or integer Paise arithmetic.
5. **Preserve Inklly Branding:** Under no circumstances use any competitor brand names.
