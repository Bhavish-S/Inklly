import { DatabaseService } from '@inklly/db';
import { parsePageRange } from '@inklly/shared';

/** Orders in these states are still waiting for the counter. */
export const ACTIVE_QUEUE_STATUSES = [
  'SUBMITTED', 'AWAITING_REVIEW', 'READY_FOR_PRINT', 'PENDING_RELEASE', 'PENDING_AGENT_SPOOL', 'IN_PROGRESS', 'ON_HOLD',
] as const;

const MINUTES_PER_QUEUED_ORDER = 3;
const BASE_MINUTES = 2;

export interface OperatingStatus {
  acceptingOrders: boolean;
  pauseMessage: string | null;
  updatedAt: string | null;
}

export function getOperatingStatus(db: DatabaseService, shopId: string): OperatingStatus {
  const row = db.queryOne<any>(`SELECT accepting_orders, pause_message, updated_at FROM shop_operating_status WHERE shop_id = ?`, [shopId]);
  if (!row) return { acceptingOrders: true, pauseMessage: null, updatedAt: null };
  return { acceptingOrders: Number(row.accepting_orders) === 1, pauseMessage: row.pause_message || null, updatedAt: row.updated_at || null };
}

export function setOperatingStatus(db: DatabaseService, shopId: string, acceptingOrders: boolean, pauseMessage: string | null): OperatingStatus {
  const now = new Date().toISOString();
  const message = acceptingOrders ? null : (pauseMessage?.trim().slice(0, 200) || null);
  db.execute(
    `INSERT INTO shop_operating_status (shop_id, accepting_orders, pause_message, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(shop_id) DO UPDATE SET accepting_orders = excluded.accepting_orders, pause_message = excluded.pause_message, updated_at = excluded.updated_at`,
    [shopId, acceptingOrders ? 1 : 0, message, now]
  );
  return { acceptingOrders, pauseMessage: message, updatedAt: now };
}

const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');

/** How many orders are ahead in the shop's queue and a rough wait in minutes. */
export function getQueueEstimate(db: DatabaseService, shopId: string, beforeCreatedAt?: string): { ordersAhead: number; estimatedMinutes: number } {
  const params: Array<string | number | null> = [shopId, ...ACTIVE_QUEUE_STATUSES];
  let sql = `SELECT COUNT(*) AS count FROM orders WHERE shop_id = ? AND status IN (${placeholders(ACTIVE_QUEUE_STATUSES.length)})`;
  if (beforeCreatedAt) {
    sql += ` AND created_at < ?`;
    params.push(beforeCreatedAt);
  }
  const ordersAhead = Number(db.queryOne<any>(sql, params)?.count || 0);
  return { ordersAhead, estimatedMinutes: BASE_MINUTES + ordersAhead * MINUTES_PER_QUEUED_ORDER };
}

/** Pages one order file prints, split into black-and-white and colour sides. */
export function countPrintedSides(pageCount: number, options: any): { bw: number; color: number } {
  try {
    const copies = Math.max(1, Number(options?.copies) || 1);
    const selected = parsePageRange(options?.pageRange, pageCount);
    let colorPages = 0;
    if (options?.colorMode === 'color') colorPages = selected.length;
    else if (options?.colorMode === 'mixed' && options?.colorPages) {
      const chosen = new Set(selected);
      colorPages = parsePageRange(options.colorPages, pageCount).filter((page) => chosen.has(page)).length;
    }
    return { bw: (selected.length - colorPages) * copies, color: colorPages * copies };
  } catch {
    return { bw: 0, color: 0 };
  }
}

export interface DailyReport {
  date: string;
  range: { from: string; to: string };
  orders: { received: number; completed: number; cancelled: number; open: number };
  revenue: { totalPaise: number; cashPaise: number; upiPaise: number; onlinePaise: number; refundsPaise: number };
  counterSales: { count: number; totalPaise: number };
  pages: { bw: number; color: number; total: number };
  averageTurnaroundMinutes: number | null;
  averageOrderPaise: number | null;
  hourly: Array<{ hour: number; orders: number }>;
  lastSevenDays: Array<{ date: string; orders: number; revenuePaise: number }>;
  topCustomers: Array<{ name: string; phone: string | null; orders: number; spentPaise: number }>;
}

/** Local-day range in UTC for a YYYY-MM-DD date at the given offset (minutes east of UTC). */
export function localDayRange(date: string, offsetMinutes: number): { from: string; to: string } {
  const [y, m, d] = date.split('-').map(Number);
  const startUtc = Date.UTC(y, m - 1, d) - offsetMinutes * 60_000;
  return { from: new Date(startUtc).toISOString(), to: new Date(startUtc + 86_400_000).toISOString() };
}

export function buildDailyReport(db: DatabaseService, shopId: string, date: string, offsetMinutes: number): DailyReport {
  const range = localDayRange(date, offsetMinutes);
  const orders = db.query<any>(
    `SELECT id, status, customer_name, customer_phone, total_amount_paise, created_at, collected_at
     FROM orders WHERE shop_id = ? AND created_at >= ? AND created_at < ?`,
    [shopId, range.from, range.to]
  );
  const placed = orders.filter((order) => order.status !== 'AWAITING_PAYMENT');
  const completed = orders.filter((order) => order.status === 'COLLECTED');
  const cancelled = orders.filter((order) => order.status === 'CANCELLED');
  const open = orders.filter((order) => !['COLLECTED', 'CANCELLED'].includes(order.status));

  const ledger = db.query<any>(
    `SELECT provider, amount_paise FROM ledger_entries
     WHERE shop_id = ? AND domain = 'CUSTOMER_PRINT_PAYMENT' AND created_at >= ? AND created_at < ?`,
    [shopId, range.from, range.to]
  );
  let cashPaise = 0, upiPaise = 0, onlinePaise = 0, refundsPaise = 0;
  for (const entry of ledger) {
    const amount = Number(entry.amount_paise) || 0;
    if (amount < 0) refundsPaise += -amount;
    else if (entry.provider === 'MANUAL_CASH') cashPaise += amount;
    else if (entry.provider === 'COUNTER_UPI') upiPaise += amount;
    else onlinePaise += amount;
  }

  const countedIds = orders.filter((order) => order.status !== 'CANCELLED' && order.status !== 'AWAITING_PAYMENT').map((order) => order.id);
  let bw = 0, color = 0;
  if (countedIds.length) {
    const files = db.query<any>(
      `SELECT page_count, print_options FROM order_files WHERE order_id IN (${placeholders(countedIds.length)})`,
      countedIds
    );
    for (const file of files) {
      let options: any = {};
      try { options = JSON.parse(file.print_options || '{}'); } catch { /* skip malformed */ }
      const sides = countPrintedSides(Number(file.page_count) || 0, options);
      bw += sides.bw;
      color += sides.color;
    }
  }

  // Walk-in counter sales: their print pages count towards the day's pages.
  const sales = db.query<any>(
    `SELECT items_json, total_paise FROM counter_sales WHERE shop_id = ? AND created_at >= ? AND created_at < ? AND voided_at IS NULL`,
    [shopId, range.from, range.to]
  );
  let counterTotalPaise = 0;
  for (const sale of sales) {
    counterTotalPaise += Number(sale.total_paise) || 0;
    let items: any[] = [];
    try { items = JSON.parse(sale.items_json || '[]'); } catch { /* skip malformed */ }
    for (const item of items) {
      if (item?.kind === 'bw_page') bw += Number(item.quantity) || 0;
      else if (item?.kind === 'color_page') color += Number(item.quantity) || 0;
    }
  }

  const turnarounds = completed
    .map((order) => (Date.parse(order.collected_at) - Date.parse(order.created_at)) / 60_000)
    .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);

  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }));
  for (const order of placed) {
    const localMs = Date.parse(order.created_at) + offsetMinutes * 60_000;
    if (Number.isFinite(localMs)) hourly[new Date(localMs).getUTCHours()].orders++;
  }

  const customers = new Map<string, { name: string; phone: string | null; orders: number; spentPaise: number }>();
  for (const order of orders) {
    if (order.status === 'CANCELLED') continue;
    const key = order.customer_phone || order.customer_name || '';
    if (!key) continue;
    const current = customers.get(key) || { name: order.customer_name || 'Customer', phone: order.customer_phone || null, orders: 0, spentPaise: 0 };
    current.orders++;
    current.spentPaise += Number(order.total_amount_paise) || 0;
    customers.set(key, current);
  }

  const lastSevenDays: DailyReport['lastSevenDays'] = [];
  const [y, m, d] = date.split('-').map(Number);
  for (let back = 6; back >= 0; back--) {
    const day = new Date(Date.UTC(y, m - 1, d - back)).toISOString().slice(0, 10);
    const dayRange = localDayRange(day, offsetMinutes);
    const dayOrders = Number(db.queryOne<any>(
      `SELECT COUNT(*) AS count FROM orders WHERE shop_id = ? AND created_at >= ? AND created_at < ? AND status NOT IN ('CANCELLED', 'AWAITING_PAYMENT')`,
      [shopId, dayRange.from, dayRange.to]
    )?.count || 0);
    const dayRevenue = Number(db.queryOne<any>(
      `SELECT COALESCE(SUM(amount_paise), 0) AS total FROM ledger_entries WHERE shop_id = ? AND domain = 'CUSTOMER_PRINT_PAYMENT' AND created_at >= ? AND created_at < ?`,
      [shopId, dayRange.from, dayRange.to]
    )?.total || 0);
    lastSevenDays.push({ date: day, orders: dayOrders, revenuePaise: dayRevenue });
  }

  const totalPaise = cashPaise + upiPaise + onlinePaise - refundsPaise;
  return {
    date,
    range,
    orders: { received: countedIds.length, completed: completed.length, cancelled: cancelled.length, open: open.length },
    revenue: { totalPaise, cashPaise, upiPaise, onlinePaise, refundsPaise },
    counterSales: { count: sales.length, totalPaise: counterTotalPaise },
    pages: { bw, color, total: bw + color },
    averageTurnaroundMinutes: turnarounds.length ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) : null,
    averageOrderPaise: countedIds.length ? Math.round(orders.filter((o) => countedIds.includes(o.id)).reduce((sum, o) => sum + (Number(o.total_amount_paise) || 0), 0) / countedIds.length) : null,
    hourly,
    lastSevenDays,
    topCustomers: [...customers.values()].sort((a, b) => b.spentPaise - a.spentPaise).slice(0, 5),
  };
}
