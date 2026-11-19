import * as crypto from 'node:crypto';
import { DatabaseService, LedgerRepository, PricingRepository } from '@inklly/db';

export type AutoPrintMode = 'off' | 'paid' | 'all';
export type ServiceKind = 'bw_page' | 'color_page' | 'scan' | 'other';

export interface CounterSettings {
  autoPrint: AutoPrintMode;
  upiId: string | null;
  upiPayeeName: string | null;
}

export interface ShopService {
  id: string;
  name: string;
  unitLabel: string;
  unitPricePaise: number;
  kind: ServiceKind;
  sortOrder: number;
}

export interface CounterSaleItem {
  serviceId: string | null;
  name: string;
  kind: ServiceKind;
  unitLabel: string;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
}

export interface CounterSale {
  id: string;
  saleNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  items: CounterSaleItem[];
  totalPaise: number;
  paymentMethod: 'CASH' | 'UPI';
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}

export class CounterSaleError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

const UPI_ID = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$/;
const MAX_ITEMS = 50;
const MAX_QUANTITY = 10_000;
const MAX_UNIT_PAISE = 10_000_000; // ₹1,00,000 per unit
const KINDS: ServiceKind[] = ['bw_page', 'color_page', 'scan', 'other'];

export function getCounterSettings(db: DatabaseService, shopId: string): CounterSettings {
  const row = db.queryOne<any>(`SELECT auto_print, upi_id, upi_payee_name FROM shop_counter_settings WHERE shop_id = ?`, [shopId]);
  const mode = row?.auto_print;
  return {
    autoPrint: mode === 'paid' || mode === 'all' ? mode : 'off',
    upiId: row?.upi_id || null,
    upiPayeeName: row?.upi_payee_name || null,
  };
}

export function updateCounterSettings(db: DatabaseService, shopId: string, input: any): CounterSettings {
  const current = getCounterSettings(db, shopId);
  const autoPrint = input?.autoPrint === undefined ? current.autoPrint : input.autoPrint;
  if (!['off', 'paid', 'all'].includes(autoPrint)) throw new CounterSaleError('autoPrint must be off, paid or all.');
  let upiId = input?.upiId === undefined ? current.upiId : input.upiId;
  if (upiId !== null) {
    if (typeof upiId !== 'string') throw new CounterSaleError('UPI ID must be text like shopname@okaxis.');
    upiId = upiId.trim();
    if (!upiId) upiId = null;
    else if (!UPI_ID.test(upiId)) throw new CounterSaleError('Enter a valid UPI ID, for example shopname@okaxis.');
  }
  let upiPayeeName = input?.upiPayeeName === undefined ? current.upiPayeeName : input.upiPayeeName;
  if (upiPayeeName !== null) {
    if (typeof upiPayeeName !== 'string' || upiPayeeName.length > 80) throw new CounterSaleError('Payee name must be up to 80 characters.');
    upiPayeeName = upiPayeeName.trim() || null;
  }
  db.execute(
    `INSERT INTO shop_counter_settings (shop_id, auto_print, upi_id, upi_payee_name, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(shop_id) DO UPDATE SET auto_print = excluded.auto_print, upi_id = excluded.upi_id, upi_payee_name = excluded.upi_payee_name, updated_at = excluded.updated_at`,
    [shopId, autoPrint, upiId, upiPayeeName, new Date().toISOString()]
  );
  return { autoPrint, upiId, upiPayeeName };
}

const mapService = (row: any): ShopService => ({
  id: row.id,
  name: row.name,
  unitLabel: row.unit_label,
  unitPricePaise: Number(row.unit_price_paise),
  kind: KINDS.includes(row.kind) ? row.kind : 'other',
  sortOrder: Number(row.sort_order) || 0,
});

/** The shop's counter price list; created from the shop's print rates on first use. */
export function listServices(db: DatabaseService, shopId: string): ShopService[] {
  let rows = db.query<any>(`SELECT * FROM shop_services WHERE shop_id = ? AND is_active = 1 ORDER BY sort_order, created_at`, [shopId]);
  const everCreated = db.queryOne<any>(`SELECT 1 AS found FROM shop_services WHERE shop_id = ? LIMIT 1`, [shopId]);
  if (!rows.length && !everCreated) {
    const rates = new PricingRepository(db).getRateRules(shopId);
    const rate = (mode: 'bw' | 'color', fallback: number) =>
      rates.find((r) => r.paperSize === 'A4' && r.colorMode === mode && r.duplexMode === 'simplex')?.pricePerPrintedSidePaise ?? fallback;
    const defaults: Array<[string, string, number, ServiceKind]> = [
      ['B&W print / xerox (A4)', 'page', rate('bw', 200), 'bw_page'],
      ['Colour print (A4)', 'page', rate('color', 1000), 'color_page'],
      ['Scanning', 'page', 500, 'scan'],
      ['Lamination (A4)', 'sheet', 3000, 'other'],
      ['Spiral binding', 'book', 5000, 'other'],
      ['Passport photos (set of 8)', 'set', 8000, 'other'],
    ];
    const now = new Date().toISOString();
    db.transaction(() => {
      defaults.forEach(([name, unit, price, kind], index) => {
        db.execute(
          `INSERT INTO shop_services (id, shop_id, name, unit_label, unit_price_paise, kind, sort_order, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [`svc-${crypto.randomUUID()}`, shopId, name, unit, price, kind, index, now]
        );
      });
    });
    rows = db.query<any>(`SELECT * FROM shop_services WHERE shop_id = ? AND is_active = 1 ORDER BY sort_order, created_at`, [shopId]);
  }
  return rows.map(mapService);
}

/** Replaces the active price list. Removed services are deactivated, not deleted, so old sales stay readable. */
export function replaceServices(db: DatabaseService, shopId: string, input: unknown): ShopService[] {
  if (!Array.isArray(input) || input.length > 60) throw new CounterSaleError('Send up to 60 services.');
  const clean = input.map((raw: any, index) => {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    const unitLabel = typeof raw?.unitLabel === 'string' && raw.unitLabel.trim() ? raw.unitLabel.trim().slice(0, 20) : 'item';
    const price = raw?.unitPricePaise;
    const kind = KINDS.includes(raw?.kind) ? raw.kind as ServiceKind : 'other';
    if (!name || name.length > 60) throw new CounterSaleError(`Service ${index + 1} needs a name up to 60 characters.`);
    if (!Number.isSafeInteger(price) || price < 0 || price > MAX_UNIT_PAISE) throw new CounterSaleError(`“${name}” needs a price in whole paise.`);
    return { id: typeof raw?.id === 'string' && raw.id.startsWith('svc-') ? raw.id : null, name, unitLabel, price, kind, sortOrder: index };
  });
  const now = new Date().toISOString();
  db.transaction(() => {
    const keep = new Set<string>();
    for (const item of clean) {
      const existing = item.id ? db.queryOne<any>(`SELECT id FROM shop_services WHERE id = ? AND shop_id = ?`, [item.id, shopId]) : null;
      if (existing) {
        db.execute(
          `UPDATE shop_services SET name = ?, unit_label = ?, unit_price_paise = ?, kind = ?, sort_order = ?, is_active = 1 WHERE id = ? AND shop_id = ?`,
          [item.name, item.unitLabel, item.price, item.kind, item.sortOrder, item.id, shopId]
        );
        keep.add(item.id!);
      } else {
        const id = `svc-${crypto.randomUUID()}`;
        db.execute(
          `INSERT INTO shop_services (id, shop_id, name, unit_label, unit_price_paise, kind, sort_order, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [id, shopId, item.name, item.unitLabel, item.price, item.kind, item.sortOrder, now]
        );
        keep.add(id);
      }
    }
    for (const row of db.query<any>(`SELECT id FROM shop_services WHERE shop_id = ? AND is_active = 1`, [shopId])) {
      if (!keep.has(row.id)) db.execute(`UPDATE shop_services SET is_active = 0 WHERE id = ? AND shop_id = ?`, [row.id, shopId]);
    }
  });
  return listServices(db, shopId);
}

const mapSale = (row: any): CounterSale => {
  let items: CounterSaleItem[] = [];
  try { items = JSON.parse(row.items_json); } catch { /* keep empty */ }
  return {
    id: row.id,
    saleNumber: row.sale_number,
    customerName: row.customer_name || null,
    customerPhone: row.customer_phone || null,
    items,
    totalPaise: Number(row.total_paise),
    paymentMethod: row.payment_method === 'UPI' ? 'UPI' : 'CASH',
    createdAt: row.created_at,
    voidedAt: row.voided_at || null,
    voidReason: row.void_reason || null,
  };
};

/**
 * Bills a walk-in customer. Catalogue prices come from the server, so the
 * till cannot be undercharged by editing the request; custom lines are
 * allowed for one-off work. The sale and its ledger entry commit together.
 */
export function createCounterSale(
  db: DatabaseService,
  shop: { id: string; organizationId: string },
  userId: string | null,
  input: any,
): CounterSale {
  const paymentMethod = input?.paymentMethod;
  if (paymentMethod !== 'CASH' && paymentMethod !== 'UPI') throw new CounterSaleError('Choose cash or UPI.');
  const rawItems = input?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > MAX_ITEMS) throw new CounterSaleError(`Add between 1 and ${MAX_ITEMS} items.`);
  const services = new Map(listServices(db, shop.id).map((service) => [service.id, service]));
  const items: CounterSaleItem[] = rawItems.map((raw: any, index: number) => {
    const quantity = raw?.quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new CounterSaleError(`Item ${index + 1} needs a quantity from 1 to ${MAX_QUANTITY}.`);
    if (typeof raw?.serviceId === 'string') {
      const service = services.get(raw.serviceId);
      if (!service) throw new CounterSaleError(`Item ${index + 1} is not on this shop's price list.`);
      return { serviceId: service.id, name: service.name, kind: service.kind, unitLabel: service.unitLabel, unitPricePaise: service.unitPricePaise, quantity, lineTotalPaise: service.unitPricePaise * quantity };
    }
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    const price = raw?.unitPricePaise;
    if (!name || name.length > 60) throw new CounterSaleError(`Custom item ${index + 1} needs a name up to 60 characters.`);
    if (!Number.isSafeInteger(price) || price < 0 || price > MAX_UNIT_PAISE) throw new CounterSaleError(`“${name}” needs a price in whole paise.`);
    return { serviceId: null, name, kind: 'other' as ServiceKind, unitLabel: 'item', unitPricePaise: price, quantity, lineTotalPaise: price * quantity };
  });
  const totalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  if (!Number.isSafeInteger(totalPaise) || totalPaise < 1 || totalPaise > 1_000_000_000) throw new CounterSaleError('The sale total must be more than ₹0.');

  const customerName = typeof input?.customerName === 'string' && input.customerName.trim() ? input.customerName.trim().slice(0, 80) : null;
  const phoneDigits = typeof input?.customerPhone === 'string' ? input.customerPhone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '') : '';
  if (phoneDigits && !/^\d{10}$/.test(phoneDigits)) throw new CounterSaleError('Enter a 10-digit mobile number or leave it blank.');

  const id = `sale-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  return db.transaction(() => {
    const todays = Number(db.queryOne<any>(
      `SELECT COUNT(*) AS count FROM counter_sales WHERE shop_id = ? AND created_at >= ?`,
      [shop.id, `${now.slice(0, 10)}T00:00:00.000Z`]
    )?.count || 0);
    const saleNumber = `W-${now.slice(2, 10).replace(/-/g, '')}-${String(todays + 1).padStart(3, '0')}`;
    db.execute(
      `INSERT INTO counter_sales (id, shop_id, sale_number, customer_name, customer_phone, items_json, total_paise, payment_method, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, shop.id, saleNumber, customerName, phoneDigits || null, JSON.stringify(items), totalPaise, paymentMethod, userId, now]
    );
    new LedgerRepository(db).appendEntry({
      id: `led-counter-${crypto.randomUUID()}`,
      domain: 'CUSTOMER_PRINT_PAYMENT',
      organizationId: shop.organizationId,
      shopId: shop.id,
      amountPaise: totalPaise,
      currency: 'INR',
      provider: paymentMethod === 'UPI' ? 'COUNTER_UPI' : 'MANUAL_CASH',
      providerTransactionId: `counter-${id}`,
      description: `Counter sale ${saleNumber}`,
      metadata: { counterSaleId: id, items: items.length },
      createdAt: now,
    });
    return mapSale(db.queryOne<any>(`SELECT * FROM counter_sales WHERE id = ?`, [id]));
  });
}

export function listCounterSales(db: DatabaseService, shopId: string, from: string, to: string): CounterSale[] {
  return db.query<any>(
    `SELECT * FROM counter_sales WHERE shop_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT 500`,
    [shopId, from, to]
  ).map(mapSale);
}

/** Cancels a sale by appending a reversing ledger entry; nothing is deleted. */
export function voidCounterSale(db: DatabaseService, shop: { id: string; organizationId: string }, saleId: string, reason: unknown): CounterSale {
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 200) throw new CounterSaleError('Give a reason (3–200 characters).');
  return db.transaction(() => {
    const row = db.queryOne<any>(`SELECT * FROM counter_sales WHERE id = ? AND shop_id = ?`, [saleId, shop.id]);
    if (!row) throw new CounterSaleError('Sale not found.', 404);
    if (row.voided_at) throw new CounterSaleError('This sale was already cancelled.', 409);
    const now = new Date().toISOString();
    const updated = db.queryOne<any>(`UPDATE counter_sales SET voided_at = ?, void_reason = ? WHERE id = ? AND voided_at IS NULL RETURNING id`, [now, reason.trim(), saleId]);
    if (!updated) throw new CounterSaleError('This sale was already cancelled.', 409);
    new LedgerRepository(db).appendEntry({
      id: `led-counter-void-${crypto.randomUUID()}`,
      domain: 'CUSTOMER_PRINT_PAYMENT',
      organizationId: shop.organizationId,
      shopId: shop.id,
      amountPaise: -Number(row.total_paise),
      currency: 'INR',
      provider: row.payment_method === 'UPI' ? 'COUNTER_UPI' : 'MANUAL_CASH',
      providerTransactionId: `counter-void-${saleId}`,
      description: `Cancelled counter sale ${row.sale_number}: ${reason.trim()}`,
      metadata: { counterSaleId: saleId },
      createdAt: now,
    });
    return mapSale(db.queryOne<any>(`SELECT * FROM counter_sales WHERE id = ?`, [saleId]));
  });
}

/** Builds the standard UPI deep link a phone's UPI app understands. */
export function upiPaymentLink(settings: CounterSettings, shopName: string, amountPaise: number, note: string): string | null {
  if (!settings.upiId) return null;
  const params = new URLSearchParams({
    pa: settings.upiId,
    pn: (settings.upiPayeeName || shopName).slice(0, 50),
    am: (amountPaise / 100).toFixed(2),
    cu: 'INR',
    tn: note.slice(0, 50),
  });
  return `upi://pay?${params.toString()}`;
}
