import { DatabaseService } from '@inklly/db';

/**
 * Read models for the platform owner console (/platform). SQL stays portable
 * between SQLite and Postgres: ISO-8601 text timestamps, `?` placeholders,
 * COALESCE/LOWER/LIKE only, and every aggregate is wrapped in Number().
 */

export const ORDER_STATUSES = [
  'DRAFT', 'SUBMITTED', 'AWAITING_PAYMENT', 'AWAITING_REVIEW', 'READY_FOR_PRINT', 'IN_PROGRESS', 'READY_FOR_COLLECTION',
  'COLLECTED', 'PRINT_FAILED', 'PRINT_UNCONFIRMED', 'PENDING_RELEASE', 'PENDING_AGENT_SPOOL', 'CANCEL_REQUESTED',
  'CANCELLED', 'ON_HOLD', 'FAILED_REQUIRES_SUPPORT',
] as const;
export const PAYMENT_METHODS = ['CASH_ON_COLLECTION', 'ONLINE_RAZORPAY', 'UPI_DIRECT'] as const;
export const PAYMENT_STATUSES = [
  'NOT_REQUIRED', 'NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUND_PENDING',
  'PARTIALLY_REFUNDED', 'REFUNDED', 'REVERSED', 'RECONCILIATION_REQUIRED',
] as const;

const AGENT_ONLINE_WINDOW_MS = 45_000;
const IST_OFFSET_MS = 330 * 60_000;
const OPEN_ORDER_EXCLUDED = `('COLLECTED', 'CANCELLED', 'DRAFT')`;

export class ConsoleQueryError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

/** Start of the current calendar day in India, as a UTC ISO string. */
export function startOfIstDay(now = Date.now()): string {
  const local = new Date(now + IST_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - IST_OFFSET_MS).toISOString();
}

function likeTerm(search: string): string {
  return `%${search.toLowerCase().replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/** Digits-only phone, last 10 digits for Indian numbers, as a portable SQL expression. */
const PHONE_DIGITS_SQL = `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(o.customer_phone, ''), ' ', ''), '-', ''), '+', ''), '.', '')`;
const PHONE_KEY_SQL = `CASE WHEN LENGTH(${PHONE_DIGITS_SQL}) > 10 THEN SUBSTR(${PHONE_DIGITS_SQL}, LENGTH(${PHONE_DIGITS_SQL}) - 9) ELSE ${PHONE_DIGITS_SQL} END`;

export function parsePaging(query: any, defaultLimit = 50): { limit: number; offset: number } {
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ConsoleQueryError('limit must be a whole number from 1 to 100.');
  if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) throw new ConsoleQueryError('offset must be a whole number from 0 to 100000.');
  return { limit, offset };
}

export function parseSearch(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.trim().length > 120) throw new ConsoleQueryError('search must be at most 120 characters.');
  return value.trim();
}

export function presentOrderRow(row: any) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    tokenNumber: String(row.token_number || '').replace(/^T-/, '') || null,
    shopId: row.shop_id,
    shopName: row.shop_name || null,
    shopCode: row.shop_code || null,
    customerName: row.customer_name || null,
    customerPhone: row.customer_phone || null,
    customerEmail: row.customer_email || null,
    channel: row.channel,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    totalAmountPaise: Number(row.total_amount_paise || 0),
    currency: row.currency || 'INR',
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    collectedAt: row.collected_at || null,
  };
}

function agentStatus(row: { is_active: any; last_heartbeat: string | null }, now: number): 'ONLINE' | 'STALE' | 'REVOKED' | 'UNKNOWN' {
  if (!Number(row.is_active)) return 'REVOKED';
  const beat = row.last_heartbeat ? Date.parse(row.last_heartbeat) : NaN;
  if (!Number.isFinite(beat)) return 'UNKNOWN';
  const age = now - beat;
  if (age < 0) return 'UNKNOWN';
  return age <= AGENT_ONLINE_WINDOW_MS ? 'ONLINE' : 'STALE';
}

export class PlatformConsoleService {
  constructor(private db: DatabaseService) {}

  private count(sql: string, params: any[] = []): number {
    return Number(this.db.queryOne<any>(sql, params)?.count || 0);
  }

  private sum(sql: string, params: any[] = []): number {
    return Number(this.db.queryOne<any>(sql, params)?.total || 0);
  }

  // ─── Overview ────────────────────────────────────────────────────────────

  public overview() {
    const now = Date.now();
    const today = startOfIstDay(now);
    const sevenDays = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const onlineSince = new Date(now - AGENT_ONLINE_WINDOW_MS).toISOString();

    const metrics = {
      shops: this.count(`SELECT COUNT(*) AS count FROM shops`),
      activeShops: this.count(`SELECT COUNT(*) AS count FROM shops WHERE is_active = 1`),
      shopsOnMap: this.count(
        `SELECT COUNT(*) AS count FROM shops s JOIN shop_profiles sp ON sp.shop_id = s.id
         WHERE s.is_active = 1 AND sp.listed_on_map = 1 AND sp.latitude IS NOT NULL AND sp.longitude IS NOT NULL`
      ),
      ordersToday: this.count(`SELECT COUNT(*) AS count FROM orders WHERE created_at >= ? AND status <> 'DRAFT'`, [today]),
      orders7d: this.count(`SELECT COUNT(*) AS count FROM orders WHERE created_at >= ? AND status <> 'DRAFT'`, [sevenDays]),
      openOrders: this.count(`SELECT COUNT(*) AS count FROM orders WHERE status NOT IN ${OPEN_ORDER_EXCLUDED}`),
      gmvTodayPaise: this.sum(`SELECT COALESCE(SUM(amount_paise), 0) AS total FROM ledger_entries WHERE domain = 'CUSTOMER_PRINT_PAYMENT' AND created_at >= ?`, [today]),
      gmv7dPaise: this.sum(`SELECT COALESCE(SUM(amount_paise), 0) AS total FROM ledger_entries WHERE domain = 'CUSTOMER_PRINT_PAYMENT' AND created_at >= ?`, [sevenDays]),
      gmvAllTimePaise: this.sum(`SELECT COALESCE(SUM(amount_paise), 0) AS total FROM ledger_entries WHERE domain = 'CUSTOMER_PRINT_PAYMENT'`),
      agentsRegistered: this.count(`SELECT COUNT(*) AS count FROM agent_registrations WHERE is_active = 1`),
      agentsOnline: this.count(`SELECT COUNT(*) AS count FROM agent_registrations WHERE is_active = 1 AND last_heartbeat >= ?`, [onlineSince]),
      printersTotal: this.count(`SELECT COUNT(*) AS count FROM printers`),
      printersOnline: this.count(
        `SELECT COUNT(*) AS count FROM printers p WHERE p.is_online = 1 AND EXISTS (
           SELECT 1 FROM agent_registrations ar WHERE ar.shop_id = p.shop_id AND ar.is_active = 1 AND ar.last_heartbeat >= ?)`,
        [onlineSince]
      ),
      customers7d: this.count(
        `SELECT COUNT(*) AS count FROM (SELECT DISTINCT ${PHONE_KEY_SQL} AS phone_key FROM orders o
         WHERE o.created_at >= ? AND COALESCE(o.customer_phone, '') <> '') c`,
        [sevenDays]
      ),
    };

    const recentOrders = this.db.query<any>(
      `SELECT o.*, s.name AS shop_name, s.shop_code FROM orders o JOIN shops s ON s.id = o.shop_id
       WHERE o.status <> 'DRAFT' ORDER BY o.created_at DESC, o.id DESC LIMIT 12`
    ).map(presentOrderRow);

    return { metrics, recentOrders, alerts: this.alerts(now), generatedAt: new Date(now).toISOString() };
  }

  /** Things the owner should look at. Every alert is derived from live data. */
  public alerts(now = Date.now()) {
    const alerts: Array<{ id: string; level: 'critical' | 'warning' | 'info'; title: string; detail: string; target?: { tab: string; filter?: Record<string, string> } }> = [];
    const onlineSince = new Date(now - AGENT_ONLINE_WINDOW_MS).toISOString();

    const stuck = this.count(`SELECT COUNT(*) AS count FROM orders WHERE status IN ('FAILED_REQUIRES_SUPPORT', 'PRINT_FAILED', 'PRINT_UNCONFIRMED')`);
    if (stuck) alerts.push({ id: 'orders-need-support', level: 'critical', title: `${stuck} order${stuck === 1 ? '' : 's'} need attention`, detail: 'Print failed, unconfirmed, or flagged for support.', target: { tab: 'orders', filter: { status: 'NEEDS_ATTENTION' } } });

    const staleAgents = this.db.query<any>(
      `SELECT ar.shop_id, s.name AS shop_name FROM agent_registrations ar JOIN shops s ON s.id = ar.shop_id
       WHERE ar.is_active = 1 AND s.is_active = 1 AND (ar.last_heartbeat IS NULL OR ar.last_heartbeat < ?)`,
      [onlineSince]
    );
    const staleShops = [...new Set(staleAgents.map((row) => row.shop_name || row.shop_id))];
    if (staleShops.length) alerts.push({ id: 'agents-offline', level: 'warning', title: `${staleShops.length} shop${staleShops.length === 1 ? '' : 's'} with print agent offline`, detail: staleShops.slice(0, 4).join(', ') + (staleShops.length > 4 ? ` and ${staleShops.length - 4} more` : ''), target: { tab: 'agents' } });

    const awaitingSince = new Date(now - 30 * 60 * 1000).toISOString();
    const waiting = this.count(`SELECT COUNT(*) AS count FROM orders WHERE status = 'AWAITING_PAYMENT' AND created_at < ?`, [awaitingSince]);
    if (waiting) alerts.push({ id: 'orders-awaiting-payment', level: 'info', title: `${waiting} order${waiting === 1 ? '' : 's'} waiting for payment over 30 min`, detail: 'Customers may have abandoned checkout.', target: { tab: 'orders', filter: { status: 'AWAITING_PAYMENT' } } });

    const pastDue = this.count(`SELECT COUNT(*) AS count FROM organizations WHERE plan_status IN ('PAST_DUE', 'SUSPENDED')`);
    if (pastDue) alerts.push({ id: 'orgs-past-due', level: 'warning', title: `${pastDue} organisation${pastDue === 1 ? '' : 's'} past due or suspended`, detail: 'Their shops cannot use the merchant app until the plan is active.', target: { tab: 'shops' } });

    const noUpi = this.count(
      `SELECT COUNT(*) AS count FROM shops s LEFT JOIN shop_counter_settings cs ON cs.shop_id = s.id
       WHERE s.is_active = 1 AND COALESCE(cs.upi_id, '') = ''`
    );
    if (noUpi) alerts.push({ id: 'shops-without-upi', level: 'info', title: `${noUpi} active shop${noUpi === 1 ? '' : 's'} without a UPI ID`, detail: 'Customers can only pay cash at these shops.', target: { tab: 'shops' } });

    const openIncidents = this.count(`SELECT COUNT(*) AS count FROM platform_incidents WHERE status IN ('OPEN', 'INVESTIGATING') AND severity IN ('CRITICAL', 'HIGH')`);
    if (openIncidents) alerts.push({ id: 'incidents-open', level: 'critical', title: `${openIncidents} high-severity incident${openIncidents === 1 ? '' : 's'} open`, detail: 'Review the incident list.', target: { tab: 'incidents' } });

    return alerts;
  }

  // ─── Shops ───────────────────────────────────────────────────────────────

  public listShops(query: any) {
    const { limit, offset } = parsePaging(query);
    const search = parseSearch(query.search);
    const status = query.status === undefined ? 'ALL' : query.status;
    if (!['ALL', 'ACTIVE', 'INACTIVE'].includes(status)) throw new ConsoleQueryError('status must be ALL, ACTIVE or INACTIVE.');
    const filters: string[] = [];
    const params: any[] = [];
    if (status !== 'ALL') { filters.push('s.is_active = ?'); params.push(status === 'ACTIVE' ? 1 : 0); }
    if (search) {
      const term = likeTerm(search);
      filters.push(`(LOWER(s.name) LIKE ? ESCAPE '\\' OR LOWER(s.shop_code) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(s.city, '')) LIKE ? ESCAPE '\\'
        OR LOWER(COALESCE(s.phone, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(org.name, '')) LIKE ? ESCAPE '\\'
        OR LOWER(COALESCE(u.full_name, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(u.email, '')) LIKE ? ESCAPE '\\')`);
      params.push(term, term, term, term, term, term, term);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const from = `FROM shops s JOIN organizations org ON org.id = s.organization_id LEFT JOIN users u ON u.id = org.owner_user_id`;
    const total = this.count(`SELECT COUNT(*) AS count ${from} ${where}`, params);
    const onlineSince = new Date(Date.now() - AGENT_ONLINE_WINDOW_MS).toISOString();
    const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const rows = this.db.query<any>(
      `SELECT s.id, s.shop_code, s.name, s.phone, s.city, s.is_active, s.created_at, s.organization_id,
              org.name AS organization_name, org.plan_tier, org.plan_status, u.full_name AS owner_name, u.email AS owner_email,
              sp.listed_on_map, sp.latitude, sp.longitude, cs.upi_id,
              (SELECT COUNT(*) FROM orders o WHERE o.shop_id = s.id AND o.created_at >= ? AND o.status <> 'DRAFT') AS orders_7d,
              (SELECT MAX(o.created_at) FROM orders o WHERE o.shop_id = s.id) AS last_order_at,
              (SELECT COUNT(*) FROM agent_registrations ar WHERE ar.shop_id = s.id AND ar.is_active = 1 AND ar.last_heartbeat >= ?) AS agents_online,
              (SELECT COUNT(*) FROM agent_registrations ar WHERE ar.shop_id = s.id AND ar.is_active = 1) AS agents_registered
       ${from}
       LEFT JOIN shop_profiles sp ON sp.shop_id = s.id
       LEFT JOIN shop_counter_settings cs ON cs.shop_id = s.id
       ${where}
       ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?`,
      [sevenDays, onlineSince, ...params, limit, offset]
    );
    const shops = rows.map((row) => ({
      id: row.id,
      shopCode: row.shop_code,
      name: row.name,
      phone: row.phone || '',
      city: row.city || '',
      isActive: Boolean(Number(row.is_active)),
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      planTier: row.plan_tier,
      planStatus: row.plan_status,
      owner: { name: row.owner_name || null, email: row.owner_email || null },
      listedOnMap: row.listed_on_map === null || row.listed_on_map === undefined ? true : Boolean(Number(row.listed_on_map)),
      hasLocation: row.latitude !== null && row.latitude !== undefined && row.longitude !== null && row.longitude !== undefined,
      hasUpi: Boolean(row.upi_id),
      orders7d: Number(row.orders_7d || 0),
      lastOrderAt: row.last_order_at || null,
      agentsOnline: Number(row.agents_online || 0),
      agentsRegistered: Number(row.agents_registered || 0),
      createdAt: row.created_at,
    }));
    return { shops, total, limit, offset, hasMore: offset + shops.length < total };
  }

  public shopDetail(shopId: string) {
    const row = this.db.queryOne<any>(
      `SELECT s.*, org.name AS organization_name, org.plan_tier, org.plan_status, org.owner_user_id, org.created_at AS organization_created_at,
              u.full_name AS owner_name, u.email AS owner_email, u.phone AS owner_phone, u.is_active AS owner_active
       FROM shops s JOIN organizations org ON org.id = s.organization_id LEFT JOIN users u ON u.id = org.owner_user_id
       WHERE s.id = ?`,
      [shopId]
    );
    if (!row) return null;
    const now = Date.now();
    const profile = this.db.queryOne<any>(`SELECT * FROM shop_profiles WHERE shop_id = ?`, [shopId]);
    const counter = this.db.queryOne<any>(`SELECT upi_id, upi_payee_name, updated_at FROM shop_counter_settings WHERE shop_id = ?`, [shopId]);
    let openingHours: unknown = null;
    if (profile?.opening_hours) { try { openingHours = JSON.parse(profile.opening_hours); } catch { openingHours = profile.opening_hours; } }
    const printers = this.db.query<any>(
      `SELECT id, name, system_driver_name, is_online, is_default, supports_color, supports_duplex, last_heartbeat, updated_at
       FROM printers WHERE shop_id = ? ORDER BY is_default DESC, name ASC`,
      [shopId]
    );
    const agents = this.db.query<any>(
      `SELECT id, hostname, os_platform, os_version, agent_version, is_active, last_heartbeat, created_at
       FROM agent_registrations WHERE shop_id = ? ORDER BY is_active DESC, created_at DESC LIMIT 10`,
      [shopId]
    );
    const agentPresent = agents.map((agent) => ({
      agentId: agent.id, hostname: agent.hostname || null, osPlatform: agent.os_platform || null, osVersion: agent.os_version || null,
      agentVersion: agent.agent_version || null, status: agentStatus(agent, now), lastHeartbeat: agent.last_heartbeat || null, createdAt: agent.created_at,
    }));
    const anyAgentOnline = agentPresent.some((agent) => agent.status === 'ONLINE');
    const pendingPairing = this.db.queryOne<any>(`SELECT expires_at FROM agent_pairing_codes WHERE shop_id = ? AND expires_at > ?`, [shopId, new Date(now).toISOString()]);
    const recentOrders = this.db.query<any>(
      `SELECT o.* FROM orders o WHERE o.shop_id = ? ORDER BY o.created_at DESC, o.id DESC LIMIT 15`,
      [shopId]
    ).map((order) => presentOrderRow({ ...order, shop_name: row.name, shop_code: row.shop_code }));
    const revenueSince = (iso: string | null) => this.sum(
      `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM ledger_entries WHERE domain = 'CUSTOMER_PRINT_PAYMENT' AND shop_id = ?${iso ? ' AND created_at >= ?' : ''}`,
      iso ? [shopId, iso] : [shopId]
    );
    const day = startOfIstDay(now);
    const week = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const month = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ordersSince = (iso: string) => this.count(`SELECT COUNT(*) AS count FROM orders WHERE shop_id = ? AND created_at >= ? AND status <> 'DRAFT'`, [shopId, iso]);

    return {
      shop: {
        id: row.id, shopCode: row.shop_code, name: row.name, tagline: row.tagline || null, phone: row.phone || '', email: row.email || '',
        address: row.address || '', city: row.city || '', state: row.state || '', pinCode: row.pin_code || '', gstin: row.gstin || null,
        isActive: Boolean(Number(row.is_active)), acceptCashOnCollection: Boolean(Number(row.accept_cash_on_collection)),
        paymentGateway: row.payment_gateway, createdAt: row.created_at, updatedAt: row.updated_at,
      },
      organization: { id: row.organization_id, name: row.organization_name, planTier: row.plan_tier, planStatus: row.plan_status, createdAt: row.organization_created_at },
      owner: row.owner_user_id ? { id: row.owner_user_id, name: row.owner_name || null, email: row.owner_email || null, phone: row.owner_phone || null, isActive: Boolean(Number(row.owner_active)) } : null,
      payments: { upiId: counter?.upi_id || null, upiPayeeName: counter?.upi_payee_name || null },
      profile: {
        latitude: profile?.latitude === null || profile?.latitude === undefined ? null : Number(profile.latitude),
        longitude: profile?.longitude === null || profile?.longitude === undefined ? null : Number(profile.longitude),
        landmark: profile?.landmark || null,
        openingHours,
        listedOnMap: profile ? Boolean(Number(profile.listed_on_map)) : true,
        updatedAt: profile?.updated_at || null,
      },
      printers: printers.map((printer) => ({
        id: printer.id, name: printer.name, driverName: printer.system_driver_name,
        // Printer state is only live while an agent for the shop is heartbeating.
        isOnline: anyAgentOnline && Boolean(Number(printer.is_online)),
        reportedOnline: Boolean(Number(printer.is_online)), isDefault: Boolean(Number(printer.is_default)),
        supportsColor: Boolean(Number(printer.supports_color)), supportsDuplex: Boolean(Number(printer.supports_duplex)),
        lastHeartbeat: printer.last_heartbeat || null,
      })),
      agents: agentPresent,
      pairingCodePendingUntil: pendingPairing?.expires_at || null,
      recentOrders,
      revenue: { todayPaise: revenueSince(day), last7dPaise: revenueSince(week), last30dPaise: revenueSince(month), allTimePaise: revenueSince(null) },
      orderCounts: {
        today: ordersSince(day), last7d: ordersSince(week), last30d: ordersSince(month),
        open: this.count(`SELECT COUNT(*) AS count FROM orders WHERE shop_id = ? AND status NOT IN ${OPEN_ORDER_EXCLUDED}`, [shopId]),
      },
    };
  }

  // ─── Orders ──────────────────────────────────────────────────────────────

  public listOrders(query: any) {
    const { limit, offset } = parsePaging(query);
    const search = parseSearch(query.search);
    const status = query.status === undefined || query.status === 'ALL' ? null : query.status;
    const paymentMethod = query.paymentMethod === undefined || query.paymentMethod === 'ALL' ? null : query.paymentMethod;
    const paymentStatus = query.paymentStatus === undefined || query.paymentStatus === 'ALL' ? null : query.paymentStatus;
    const shopId = query.shopId === undefined || query.shopId === '' ? null : query.shopId;
    if (status !== null && status !== 'OPEN' && status !== 'NEEDS_ATTENTION' && !(ORDER_STATUSES as readonly string[]).includes(status)) throw new ConsoleQueryError('Unsupported order status filter.');
    if (paymentMethod !== null && !(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) throw new ConsoleQueryError('Unsupported payment method filter.');
    if (paymentStatus !== null && !(PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)) throw new ConsoleQueryError('Unsupported payment status filter.');
    if (shopId !== null && (typeof shopId !== 'string' || shopId.length > 128)) throw new ConsoleQueryError('shopId is invalid.');

    const filters: string[] = [];
    const params: any[] = [];
    if (status === 'OPEN') filters.push(`o.status NOT IN ${OPEN_ORDER_EXCLUDED}`);
    else if (status === 'NEEDS_ATTENTION') filters.push(`o.status IN ('FAILED_REQUIRES_SUPPORT', 'PRINT_FAILED', 'PRINT_UNCONFIRMED')`);
    else if (status) { filters.push('o.status = ?'); params.push(status); }
    if (paymentMethod) { filters.push('o.payment_method = ?'); params.push(paymentMethod); }
    if (paymentStatus) { filters.push('o.payment_status = ?'); params.push(paymentStatus); }
    if (shopId) { filters.push('o.shop_id = ?'); params.push(shopId); }
    if (search) {
      const term = likeTerm(search);
      const digits = search.replace(/\D/g, '');
      const tokenTerm = likeTerm(search.replace(/^t-/i, ''));
      const clauses = [
        `LOWER(o.order_number) LIKE ? ESCAPE '\\'`,
        `LOWER(o.token_number) LIKE ? ESCAPE '\\'`,
        `LOWER(COALESCE(o.customer_name, '')) LIKE ? ESCAPE '\\'`,
        `LOWER(COALESCE(o.customer_phone, '')) LIKE ? ESCAPE '\\'`,
      ];
      params.push(term, tokenTerm, term, term);
      if (digits.length >= 4) { clauses.push(`${PHONE_DIGITS_SQL} LIKE ?`); params.push(`%${digits.slice(-10)}%`); }
      filters.push(`(${clauses.join(' OR ')})`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const total = this.count(`SELECT COUNT(*) AS count FROM orders o ${where}`, params);
    const rows = this.db.query<any>(
      `SELECT o.*, s.name AS shop_name, s.shop_code FROM orders o JOIN shops s ON s.id = o.shop_id ${where}
       ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { orders: rows.map(presentOrderRow), total, limit, offset, hasMore: offset + rows.length < total };
  }

  public orderDetail(orderId: string) {
    const row = this.db.queryOne<any>(
      `SELECT o.*, s.name AS shop_name, s.shop_code, s.organization_id, s.phone AS shop_phone
       FROM orders o JOIN shops s ON s.id = o.shop_id WHERE o.id = ?`,
      [orderId]
    );
    if (!row) return null;
    const files = this.db.query<any>(`SELECT * FROM order_files WHERE order_id = ? ORDER BY created_at, id`, [orderId]).map((file) => {
      let printOptions: unknown = null;
      try { printOptions = JSON.parse(file.print_options); } catch { printOptions = null; }
      return {
        id: file.id, fileName: file.file_name, mimeType: file.mime_type, fileSizeBytes: Number(file.file_size_bytes || 0),
        pageCount: Number(file.page_count || 0), printOptions, lineSubtotalPaise: Number(file.line_subtotal_paise || 0),
        deletedByRetention: String(file.storage_key || '').startsWith('expired:'),
      };
    });
    const payments = this.db.query<any>(
      `SELECT id, provider, provider_transaction_id, amount_paise, currency, status, created_at, updated_at
       FROM payments WHERE order_id = ? ORDER BY created_at DESC`,
      [orderId]
    ).map((payment) => ({
      id: payment.id, provider: payment.provider, providerTransactionId: payment.provider_transaction_id || null,
      amountPaise: Number(payment.amount_paise || 0), currency: payment.currency, status: payment.status,
      createdAt: payment.created_at, updatedAt: payment.updated_at,
    }));
    const upi = this.db.queryOne<any>(`SELECT upi_reference, payer_app, claimed_at FROM order_upi_claims WHERE order_id = ?`, [orderId]);
    const printJobs = this.db.query<any>(
      `SELECT pj.id, pj.status, pj.updated_at, pj.order_file_id, p.name AS printer_name
       FROM print_jobs pj LEFT JOIN printers p ON p.id = pj.printer_id WHERE pj.order_id = ? ORDER BY pj.created_at`,
      [orderId]
    ).map((job) => ({ id: job.id, status: job.status, printerName: job.printer_name || null, orderFileId: job.order_file_id, updatedAt: job.updated_at }));
    const adminActions = this.db.query<any>(
      `SELECT a.id, a.action, a.details, a.created_at, a.actor_role, u.full_name, u.email
       FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE a.target_type = 'ORDER' AND a.target_id = ? ORDER BY a.created_at DESC LIMIT 20`,
      [orderId]
    ).map((event) => {
      let details: any = null;
      try { details = event.details ? JSON.parse(event.details) : null; } catch { details = null; }
      return { id: event.id, action: event.action, note: details?.note || null, actorName: event.full_name || event.email || event.actor_role || null, createdAt: event.created_at };
    });
    return {
      order: presentOrderRow(row),
      shop: { id: row.shop_id, name: row.shop_name, shopCode: row.shop_code, phone: row.shop_phone || '', organizationId: row.organization_id },
      files,
      payments,
      upiClaim: upi ? { upiReference: upi.upi_reference || null, payerApp: upi.payer_app || null, claimedAt: upi.claimed_at } : null,
      printJobs,
      adminActions,
    };
  }

  // ─── Customers ───────────────────────────────────────────────────────────

  public listCustomers(query: any) {
    const { limit, offset } = parsePaging(query);
    const search = parseSearch(query.search);
    const filters = [`COALESCE(o.customer_phone, '') <> ''`, `o.status <> 'DRAFT'`];
    const params: any[] = [];
    if (search) {
      const term = likeTerm(search);
      const digits = search.replace(/\D/g, '');
      const clauses = [`LOWER(COALESCE(o.customer_name, '')) LIKE ? ESCAPE '\\'`, `LOWER(COALESCE(o.customer_email, '')) LIKE ? ESCAPE '\\'`];
      params.push(term, term);
      if (digits.length >= 3) { clauses.push(`${PHONE_DIGITS_SQL} LIKE ?`); params.push(`%${digits.slice(-10)}%`); }
      filters.push(`(${clauses.join(' OR ')})`);
    }
    const base = `SELECT ${PHONE_KEY_SQL} AS phone_key, o.customer_phone, o.customer_name, o.customer_email, o.shop_id, o.created_at,
                         o.total_amount_paise, o.payment_status
                  FROM orders o WHERE ${filters.join(' AND ')}`;
    const total = this.count(`SELECT COUNT(*) AS count FROM (SELECT DISTINCT phone_key FROM (${base}) b) c`, params);
    const rows = this.db.query<any>(
      `SELECT phone_key, MAX(customer_phone) AS phone, MAX(customer_name) AS name, MAX(customer_email) AS email,
              COUNT(*) AS order_count, COUNT(DISTINCT shop_id) AS shop_count, MAX(created_at) AS last_order_at, MIN(created_at) AS first_order_at,
              COALESCE(SUM(CASE WHEN payment_status = 'VERIFIED' THEN total_amount_paise ELSE 0 END), 0) AS paid_paise
       FROM (${base}) b GROUP BY phone_key ORDER BY MAX(created_at) DESC, phone_key ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const customers = rows.map((row) => ({
      phoneKey: row.phone_key,
      phone: row.phone,
      name: row.name || null,
      email: row.email || null,
      orderCount: Number(row.order_count || 0),
      shopCount: Number(row.shop_count || 0),
      lastOrderAt: row.last_order_at,
      firstOrderAt: row.first_order_at,
      totalPaidPaise: Number(row.paid_paise || 0),
    }));
    return { customers, total, limit, offset, hasMore: offset + customers.length < total };
  }
}
