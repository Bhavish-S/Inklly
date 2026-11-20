# Inklly product handbook

**Start here.** This is the single orientation document for anyone (person or AI agent) continuing work on Inklly. It explains what the product is, how every part fits, how money and printing flow, where the code lives, how to run, test and deploy it, and the rules you must not break. Older documents (`BRAIN.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_STATUS.md`, `REMAINING_ISSUES.md`, …) are historical notes; when they disagree with this file or the source, trust the source, then this file.

Last updated: 2026-11-20.

---

## 1. The product in one minute

Inklly is software for Indian xerox / print shops.

- **Customer** (phone, no app or login needed): finds a shop on the map (`/shops`) or scans the shop's QR (`/p/<shopCode>`) → uploads PDFs/photos → chooses colour/B&W, sides, paper, pages, copies, can crop/enhance photos → reviews the exact server price → **pays by UPI straight to the shop** (amount pre-filled in PhonePe / Google Pay / Paytm / CRED / BHIM …) **or chooses to pay at the counter** → gets a **4-digit token** and a live tracker page that alerts them when prints are ready.
- **Shopkeeper** (PC at the counter, or phone/tablet): opens **Counter** → types the token or name → picks a printer per file (B&W laser, colour inkjet…) → presses **Print** → checks the pages → takes **Cash** or confirms **UPI** → hands over. **Nothing ever prints automatically.**
- **Platform owner/admin**: `/platform` console — every shop, order, customer, payment, printer, setting and audit entry, with controls.
- **Developers** (optional, gated): `/developer` portal with API keys and webhooks.

Business model: shops pay Inklly a monthly SaaS subscription (Starter/Pro…, 7-day trial). Customer money never passes through Inklly.

---

## 2. Repository map

```
Source Code/                      ← git root (GitHub: Bhavish-S/Inklly)
├─ apps/
│  ├─ web/        React 18 + Vite + Tailwind. Public site, customer portal, merchant app, admin, developer portal. → Vercel
│  ├─ server/     Express 5 + TypeScript REST API (/api/v1). → Render
│  ├─ agent/      "Inklly Print App": Node desktop process that prints to local printers. Shipped as a zip.
│  └─ mobile/     Expo (React Native) app for customers and shop owners. NOT an npm workspace (own lockfile).
├─ packages/
│  ├─ shared/     Domain types, deterministic pricing engine (paise), order/print state machines.
│  └─ db/         DatabaseService (SQLite locally / Postgres-Supabase in prod), schema.sql, repositories.
├─ HANDBOOK.md    ← this file
└─ package.json   npm workspaces: packages/*, apps/web, apps/server, apps/agent (mobile is deliberately excluded)
```

### Web app routes (`apps/web/src/App.tsx`, custom router)

| Path | Who | File |
| --- | --- | --- |
| `/` `/how-it-works` `/pricing` `/contact` `/legal/*` | public | `src/pages/*` |
| `/shops` | customer — map of nearby shops | `src/pages/FindShopsPage.tsx` (lazy, Leaflet + OpenStreetMap) |
| `/p/<shopCode>` (also `/customer?shop=`) | customer — upload, options, review, pay | `src/views/CustomerPortalOrderView.tsx` |
| `/track?order=<orderId>` | customer — live status, UPI pay sheet, ready alerts | `src/views/OrderTrackerView.tsx` + `src/components/UpiPaySheet.tsx` |
| `/display/<shopCode>` | TV "now serving" board | `src/components/NowServingBoard.tsx` |
| `/login` `/register` `/accept-invitation` | shop owners/staff | `src/pages/*` |
| `/merchant?view=counter` (default) | shop — Counter | `src/components/CounterView.tsx` inside `src/views/MerchantAppView.tsx` |
| `/merchant?view=…` | shop — dashboard, orders, quick sale, reports, QR, storage, billing, employees, business setup (profile, **UPI**, **map location**, printers, prices) | `MerchantAppView.tsx` (large file — make small, targeted edits) |
| `/platform` (`/admin`) | platform owner/admins | `src/views/PlatformAdminView.tsx` |
| `/developer` | developers (feature-flagged) | `src/views/DeveloperPortalView.tsx` |

`?app=1` on any URL means "opened inside the Inklly mobile app" (used by the UPI sheet to choose plain `upi://` links that the app hands to Android/iOS).

### Server (`apps/server/src`)

- `index.ts` — `createApp(db)`; mounts routers under `/api/v1/*`. `GET /health` returns `{status, revision}` (revision = deployed git SHA; use it to confirm a deploy).
- `routes/*-routes.ts` → `controllers/*-controller.ts` → `services/*` and `@inklly/db` repositories.
- Key routers: `portal` (public customer API), `merchant` (shop staff, authenticated + tenant-scoped), `payments`, `agent` (print app), `admin` (platform), `developer`, `auth`, `subscriptions`.

### Database (`packages/db`)

- `src/schema.sql` is the single schema (SQLite + Postgres compatible). After editing run `node scripts/embed-schema.mjs` (the package `build` does it). New `CREATE TABLE/INDEX IF NOT EXISTS` statements are applied automatically at every boot on both databases. **Never put a `;` inside a SQL comment** — the Postgres bootstrap splits on `;`.
- Adding columns to existing tables needs explicit migration code in `database.ts` (see the `ensurePostgres*Migration` functions). Prefer new side tables (`shop_profiles`, `order_upi_claims`, `platform_settings`, `shop_counter_settings`) over altering core tables.
- Money is always **integer paise** (`*_paise`). Never use floats for money.

---

## 3. Core flows (how it really works)

### 3.1 Customer order

1. `GET /api/v1/portal/shop/:shopCode` → shop, rates, allowed options, `upiDirectAvailable`, `acceptCashOnCollection`, `onlinePaymentAvailable` (Razorpay), queue estimate, paused state.
2. `POST /portal/upload` (base64, ≤25 MB, PDF/JPEG/PNG; the server inspects the file and counts pages itself) → `storageKey`.
3. `POST /portal/quote` → exact server quote (shared pricing engine). The client never decides prices.
4. `POST /portal/orders` with `Idempotency-Key` header and `paymentMethod`:
   - `UPI_DIRECT` → status `AWAITING_REVIEW`, payment `PENDING`, response includes `upiPayment {upiId, payeeName, amount, note, uri}`.
   - `CASH_ON_COLLECTION` → `AWAITING_REVIEW`, payment `PENDING`.
   - `ONLINE_RAZORPAY` → `AWAITING_PAYMENT` until Razorpay verifies (shop's own Razorpay account; checkout restricted to UPI).
5. The customer lands on `/track?order=<orderId>`. The order id is the access credential (high-entropy); the short order number/token is not.

### 3.2 Direct UPI — money goes straight to the shop

`apps/server/src/services/upi-direct.ts`, `apps/web/src/components/UpiPaySheet.tsx`.

- The shop saves its UPI ID in **Business Setup → Profile → "Get paid by UPI"** (also in Quick sale → Counter settings). Stored in `shop_counter_settings.upi_id / upi_payee_name`. Advise a **business** UPI ID (PhonePe Business, Paytm for Business, GPay for Business, BharatPe): some apps limit collect-to-personal-ID payments.
- The server builds `upi://pay?pa=<upiId>&pn=<name>&am=<rupees.paise>&cu=INR&tn=Inklly print token NNNN`. Only these five widely supported parameters are used. The amount is fixed, so the customer only enters their UPI PIN.
- UpiPaySheet:
  - Android browser: big "Pay ₹X with a UPI app" (generic `upi://` → Android shows every installed UPI app), plus per-app buttons using `intent://…#Intent;scheme=upi;package=<app>;S.browser_fallback_url=<upi uri>;end` (PhonePe `com.phonepe.app`, Google Pay `com.google.android.apps.nbu.paisa.user`, Paytm `net.one97.paytm`, CRED `com.dreamplug.androidapp`, BHIM `in.org.npci.upiapp`, Amazon Pay `in.amazon.mShop.android.shopping`). Other apps (Kotak, slice, bank apps) appear in the generic chooser.
  - iPhone: per-app schemes (`phonepe://pay?`, `gpay://upi/pay?`, `paytmmp://pay?`, `credpay://upi/pay?`).
  - Desktop/tablet: a QR of the same `upi://` link to scan with any UPI app.
  - Inside the mobile app (`?app=1`): plain schemes; the app's WebView hands them to the OS.
- A plain UPI link gives **no payment callback**. So after paying, the customer taps **"I've paid"** (optional 12-digit UTR) → `POST /portal/orders/:id/upi-claim {upiReference?, payerApp?}` → row in `order_upi_claims`. The Counter shows "Customer says they paid ₹X by UPI · UTR …"; staff check the credit in their UPI app/SMS and press **UPI received** (`POST /payments/orders/:id/collect-cash {method:'UPI'}`), which records a `COUNTER_UPI` payment + ledger entry and completes the order. Inklly never marks a direct-UPI order paid on the customer's word alone.
- Admin can switch direct UPI off platform-wide: `platform_settings` key `feature_flags` → `{"upi_direct": false}`.
- Future upgrade path for automatic confirmation: shop-linked Razorpay/Cashfree/PhonePe PG accounts (already supported for Razorpay per shop) or a UPI payment-aggregator with webhooks.

### 3.3 Printing (never automatic)

Two ways, both started by staff pressing a button in the Counter:

1. **Print on this computer** (no install): `apps/web/src/browser-print.ts` downloads the files, applies page ranges and copies with pdf-lib, groups by colour/sides/paper (B&W first) and opens the browser print dialog per group; staff choose the printer there. Then "All pages printed correctly" → `reconcile-output`.
2. **Inklly Print App** (`apps/agent`): for direct printing to chosen printers (also when the printers are on another computer). Shop downloads `https://inklly.vercel.app/downloads/inklly-print-app.zip` (built by `node apps/agent/scripts/package.mjs`), runs `Start Inklly (Windows).bat` / `.command` / `.sh`, enters the pairing code from **Business Setup → Printers** (`INK-XXXX-XXXX-XXXX-XXXX`, single use, 30 min). The app heartbeats every few seconds with printers + capabilities (colour, duplex, paper sizes). Printers are "online" only while heartbeats are < 45 s old. Counter → per-file printer select → `POST /merchant/orders/:id/print {assignments:{fileId: printerId}}`; the server refuses a colour file on a mono printer etc. Windows prints via bundled SumatraPDF, macOS/Linux via CUPS `lp`.

Print job states: dispatched → `SUBMITTED_TO_SPOOLER` → staff confirm pages. `OUTPUT_UNCERTAIN` is **never retried automatically**.

### 3.4 Order status machine

`AWAITING_PAYMENT` (Razorpay only) → `AWAITING_REVIEW` → `READY_FOR_PRINT` → `IN_PROGRESS` → `READY_FOR_COLLECTION` → `COLLECTED`. Side states: `CANCELLED`, `PRINT_FAILED`, `PRINT_UNCONFIRMED`, `ON_HOLD`. Payment status: `NOT_STARTED` / `PENDING` / `VERIFIED` / `EXPIRED` / refunds. Defined in `packages/shared`.

### 3.5 Shop map / discovery

`apps/server/src/services/shop-profiles.ts`.

- `GET /api/v1/portal/shops/nearby?lat=&lng=&radiusKm=25&limit=50&q=` → `{shops:[{shopCode,name,tagline,address,city,latitude,longitude,distanceKm,landmark,openingHours,isOpenNow,acceptingOrders,acceptsUpi,acceptsCash,portalPath}]}`. Only active shops with `listed_on_map=1` and coordinates. Haversine sort in JS. `isOpenNow` is `boolean|null` (null = no hours set), computed in IST. Cached 30 s; 120 req/min/IP.
- Merchant: `GET/PUT /api/v1/merchant/shop-profile` `{latitude, longitude, landmark, openingHours:{open:"HH:MM",close:"HH:MM",closedDays:[0-6]}, listedOnMap}`; UI `src/components/ShopLocationPanel.tsx` in Business Setup → Profile (tap/drag pin, "use my location").
- Map tiles: OpenStreetMap (free, attribution required, fair-use policy — move to a paid tile provider such as MapTiler/Stadia before heavy traffic).

### 3.6 Platform admin

See section 6.

---

## 4. Running locally

Requirements: Node 22+ (the agent needs `node:sqlite`), npm 10.

```bash
npm install                                  # root, installs all workspaces
npm run build                                # shared → db → server → agent → web
# API on :4000 — a SQLite file path as DATABASE_URL, local file storage, demo shop "campus1"
cd apps/server && PORT=4000 NODE_ENV=development SEED_DEMOS=true \
  DATABASE_URL=/tmp/inklly.db STORAGE_DRIVER=local LOCAL_STORAGE_DIR=/tmp/inklly-uploads \
  JWT_SECRET=$(openssl rand -hex 32) RAZORPAY_CREDENTIALS_ENCRYPTION_KEY=$(openssl rand -base64 32) \
  CORS_ORIGIN=http://localhost:3000 node dist/index.js
npm run dev:web                              # (repo root) Vite on :3000, proxies /api to :4000
```

Local demo logins exist only in seeded local databases (see `packages/db/src/seed.ts`); the login page's one-click demo buttons render only in `vite dev` builds and are stripped from production bundles.

Print app from source: `cd apps/agent && INKLLY_SERVER_URL=http://localhost:4000/api/v1 INKLLY_ENABLE_PHYSICAL_PRINTING=true npm run dev`.

Mobile app: see `apps/mobile/README.md` (`cd apps/mobile && npm install && npx expo start`, scan with Expo Go).

## 5. Tests and checks

```bash
npm test                                     # all workspaces (server ~270, db, shared, agent, web)
npm test --workspace=apps/server             # API integration tests (in-memory SQLite, real HTTP)
cd apps/web && npx tsc --noEmit -p .         # web typecheck
cd apps/mobile && npx tsc --noEmit           # mobile typecheck
```

Server tests boot `createApp(new DatabaseService(':memory:'))` with the seeded demo shop `shop-campus-1` / `campus1` and owner `owner@campusprint.in`. Copy the pattern from `apps/server/src/test/upi-direct.test.ts` or `counter-features.test.ts` for new features.

## 6. Platform admin console

`/platform` (alias `/admin`) — shell `src/views/PlatformAdminView.tsx`, one file per section in `src/views/platform/*`, shared UI in `src/components/console-ui.tsx`, API helpers in `src/api/platform-admin.ts`. Server: `controllers/admin-controller.ts`, `services/platform-console.ts`, `services/platform-settings.ts`; routes mounted under **`/api/v1/platform`** (reads `platform:view`, writes `platform:manage`; every write needs a `note` of 5–500 chars and is audited).

Sections: Overview (live KPIs, GMV, alerts), Shops (search, drawer with owner/plan/UPI/location/printers/revenue; edit, activate/deactivate, map listing, reset print-app pairing), Orders (cross-shop search by token/number/name/phone; cancel, mark paid — never for Razorpay orders), Customers (grouped by phone), Payments & ledger, Printers & agents, Settings, Audit log, Team & permissions, and the Developer portal (`/developer`).

Key endpoints: `GET /overview`, `GET|PATCH /shops/:id`, `POST /shops/:id/status`, `POST /shops/:id/agent-pairing/reset`, `GET /orders`, `POST /orders/:id/cancel`, `POST /orders/:id/mark-paid`, `GET /customers`, `GET|PUT /settings`. Public subset: `GET /api/v1/portal/platform-config` (announcement, maintenance, feature flags, support contacts, map defaults; cached 60 s).

Settings stored in `platform_settings` (one row per key, JSON value): `announcement`, `maintenance`, `map_defaults`, `support_contacts`, `max_upload_mb`, `signups_open`, `feature_flags {map_discovery, upi_direct, razorpay_online}`. **Currently enforced:** `upi_direct`, and `map_defaults` (used by `/shops`). **Stored but not yet enforced** (next task): announcement banner display, maintenance mode, `max_upload_mb`, `signups_open`, `map_discovery`, `razorpay_online`.

## 7. Deploy

- **API — Render** (`inklly` service): auto-deploys `main`. Build `npm install && npm run build:render`, start `node apps/server/dist/index.js`. Verify: `curl https://inklly.onrender.com/health` → `revision` equals the pushed commit SHA. Environment variables are listed in `RENDER_DEPLOYMENT.md` (JWT_SECRET, DATABASE_URL, STORAGE_DRIVER=supabase, SUPABASE_*, CORS_ORIGIN, RAZORPAY_CREDENTIALS_ENCRYPTION_KEY, optional platform Razorpay keys, PLATFORM_OWNER_* bootstrap).
- **Database/storage — Supabase** Postgres + private Storage bucket `customer-print-files`. A free Supabase project pauses after inactivity; if Render logs "tenant/user not found", restore the project in the Supabase dashboard.
- **Web — Vercel** (`inklly.vercel.app`): auto-deploys `main`, root `apps/web`. `vercel.json` rewrites unknown paths to `index.html`; static files (e.g. `/downloads/inklly-print-app.zip`) are served first.
- **Print App zip**: rebuild with `node apps/agent/scripts/package.mjs` whenever `apps/agent` changes, and commit `apps/web/public/downloads/inklly-print-app.zip`.
- **Mobile**: Expo EAS — `cd apps/mobile && npx eas-cli login && npm run build:apk` (needs the owner's free Expo account). Play Store later via the `production` profile (AAB).
- Branches: work lands on `main` (also mirrored to `launch-readiness`). Commit trailer used so far: `Co-Authored-By: Claude …`.

## 8. Rules you must not break

1. **No automatic printing.** Printing starts only when staff press Print.
2. Money is integer paise; prices come only from the server quote.
3. Customer money goes to the shop (its UPI ID or its own Razorpay account). Inklly never holds it and never marks a direct-UPI payment as received without staff confirmation.
4. Tenant isolation: a merchant's shop comes from the authenticated membership, never from a client-provided shop id.
5. `OUTPUT_UNCERTAIN` print jobs are never retried automatically.
6. No demo/test data or "test mode" UI in production. Seeded demo shops exist only when `SEED_DEMOS` is set locally.
7. Secrets stay in Render/Vercel/Supabase settings — never in git, logs or chat.
8. Prefer deactivation over hard deletion for shops, users and orders.
9. `apps/agent/bin/SumatraPDF-settings.txt` and `apps/agent/sea-config.json` are intentionally fixed — don't modify.
10. Keep `apps/mobile` out of the root npm workspaces (React Native's React version must not leak into the web build).

## 9. Known gaps / next steps

- Direct-UPI confirmation is manual by design. For automatic confirmation, onboard shops to a payment gateway with sub-merchant payouts (Razorpay Route / Cashfree Easy Split) and webhooks.
- OpenStreetMap tiles: switch to a commercial tile provider before large-scale traffic.
- Rate limiter and nearby-shops cache are per server process; move to Redis if you run several API instances.
- Mobile app is a native shell (map, scanner, orders) around the web portal/merchant app via WebView; native upload/print screens can replace WebViews screen by screen later.
- A self-contained Windows installer (.exe/.msi with code signing) for the print app would remove the Node.js prerequisite.
- WhatsApp/SMS "ready for pickup" notifications need a provider (e.g. Gupshup/MSG91) and customer opt-in.
