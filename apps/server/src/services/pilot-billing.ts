import * as crypto from 'node:crypto';
import { DatabaseService } from '@inklly/db';

export class PilotBillingError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); }
}

const MAX_PAISE = 1_000_000_000_000;
const safeInteger = (value: unknown, minimum: number): value is number =>
  Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= MAX_PAISE;

const tariffView = (r: any) => ({
  id: r.id, organizationId: r.organization_id, monthlyBasePaise: Number(r.monthly_base_paise),
  perSidePaise: Number(r.per_side_paise), includedSides: Number(r.included_sides),
  currency: r.currency, effectiveFrom: r.effective_from, createdBy: r.created_by, createdAt: r.created_at,
});

const invoiceView = (r: any) => ({
  id: r.id, organizationId: r.organization_id, periodStart: r.period_start, periodEnd: r.period_end,
  tariffId: r.tariff_id, currency: r.currency, monthlyBasePaise: Number(r.monthly_base_paise),
  includedSides: Number(r.included_sides), confirmedSides: Number(r.confirmed_sides),
  billableSides: Number(r.billable_sides), perSidePaise: Number(r.per_side_paise),
  usageFeePaise: Number(r.usage_fee_paise), totalPaise: Number(r.total_paise),
  lineItems: JSON.parse(r.line_items_json), status: 'ISSUED', collectionStatus: 'MANUAL_PENDING',
  paymentRecorded: false, taxTreatment: 'NOT_CONFIGURED', issuedBy: r.issued_by, issuedAt: r.issued_at,
});

export class PilotBillingService {
  constructor(private readonly db: DatabaseService) {}

  listTariffs(organizationId: string) {
    return this.db.query<any>(`SELECT * FROM subscription_billing_tariffs WHERE organization_id = ? ORDER BY effective_from DESC`, [organizationId]).map(tariffView);
  }

  addTariff(input: { organizationId: string; monthlyBasePaise: unknown; perSidePaise: unknown; includedSides: unknown; effectiveFrom: unknown; createdBy: string }) {
    if (!safeInteger(input.monthlyBasePaise, 0) || !safeInteger(input.perSidePaise, 0) || !safeInteger(input.includedSides, 0)) {
      throw new PilotBillingError(400, 'Monthly base, per-side rate, and included sides must be non-negative safe integers in supported ranges.');
    }
    const monthlyBasePaise = Number(input.monthlyBasePaise);
    const perSidePaise = Number(input.perSidePaise);
    const includedSides = Number(input.includedSides);
    if (typeof input.effectiveFrom !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(input.effectiveFrom)) {
      throw new PilotBillingError(400, 'effectiveFrom must be a UTC month start in YYYY-MM-01 format.');
    }
    const effectiveFrom = `${input.effectiveFrom}T00:00:00.000Z`;
    return this.db.transaction(() => {
      if (!this.db.queryOne(`SELECT id FROM organizations WHERE id = ?`, [input.organizationId])) {
        throw new PilotBillingError(404, 'Organization not found.');
      }
      const latest = this.db.queryOne<any>(`SELECT effective_from FROM subscription_billing_tariffs WHERE organization_id = ? ORDER BY effective_from DESC LIMIT 1`, [input.organizationId]);
      if (latest && effectiveFrom <= latest.effective_from) {
        throw new PilotBillingError(409, 'New tariff periods must start after the latest configured tariff period.');
      }
      const now = new Date().toISOString();
      const row = {
        id: crypto.randomUUID(), organization_id: input.organizationId,
        monthly_base_paise: monthlyBasePaise, per_side_paise: perSidePaise,
        included_sides: includedSides, currency: 'INR', effective_from: effectiveFrom,
        created_by: input.createdBy, created_at: now,
      };
      this.db.execute(`INSERT INTO subscription_billing_tariffs
        (id, organization_id, monthly_base_paise, per_side_paise, included_sides, currency, effective_from, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?)`,
      [row.id, row.organization_id, row.monthly_base_paise, row.per_side_paise, row.included_sides, row.effective_from, row.created_by, row.created_at]);
      return tariffView(row);
    });
  }

  listInvoices(organizationId?: string, limit = 100) {
    const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const rows = organizationId
      ? this.db.query<any>(`SELECT * FROM subscription_invoices WHERE organization_id = ? ORDER BY period_start DESC LIMIT ?`, [organizationId, boundedLimit])
      : this.db.query<any>(`SELECT * FROM subscription_invoices ORDER BY period_start DESC LIMIT ?`, [boundedLimit]);
    return rows.map(invoiceView);
  }

  issueMonthlyInvoice(organizationId: string, period: unknown, issuedBy: string) {
    if (typeof period !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new PilotBillingError(400, 'period must be a calendar month in YYYY-MM format.');
    }
    const [year, month] = period.split('-').map(Number);
    const periodStart = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const periodEnd = new Date(Date.UTC(year, month, 1)).toISOString();
    if (Date.parse(periodEnd) > Date.now()) throw new PilotBillingError(409, 'Invoices can only be issued for completed calendar months.');

    return this.db.transaction(() => {
      const existing = this.db.queryOne<any>(`SELECT * FROM subscription_invoices WHERE organization_id = ? AND period_start = ? AND period_end = ?`, [organizationId, periodStart, periodEnd]);
      if (existing) return { created: false, invoice: invoiceView(existing) };
      const organization = this.db.queryOne<any>(`SELECT plan_status FROM organizations WHERE id = ?`, [organizationId]);
      if (!organization) throw new PilotBillingError(404, 'Organization not found.');
      if (organization.plan_status !== 'ACTIVE') throw new PilotBillingError(409, 'Only active pilot organizations can be invoiced.');
      const tariff = this.db.queryOne<any>(`SELECT * FROM subscription_billing_tariffs
        WHERE organization_id = ? AND effective_from <= ? ORDER BY effective_from DESC LIMIT 1`, [organizationId, periodStart]);
      if (!tariff) throw new PilotBillingError(409, 'No billing tariff was configured for this period.');
      const midPeriodTariff = this.db.queryOne<any>(`SELECT id FROM subscription_billing_tariffs
        WHERE organization_id = ? AND effective_from > ? AND effective_from < ? LIMIT 1`, [organizationId, periodStart, periodEnd]);
      if (midPeriodTariff) throw new PilotBillingError(409, 'This period crosses tariff schedules; split-period billing is not supported.');

      const totals = this.db.queryOne<any>(`SELECT COALESCE(SUM(confirmed_sides), 0) AS confirmed_sides
        FROM subscription_usage_events WHERE organization_id = ? AND created_at >= ? AND created_at < ?`, [organizationId, periodStart, periodEnd]);
      const confirmedSides = Number(totals?.confirmed_sides || 0);
      if (!Number.isSafeInteger(confirmedSides) || confirmedSides < 0) {
        throw new PilotBillingError(409, 'Confirmed usage exceeds the supported invoice range.');
      }
      const includedSides = Number(tariff.included_sides);
      const billableSides = Math.max(0, confirmedSides - includedSides);
      const usageFeePaise = billableSides * Number(tariff.per_side_paise);
      const baseCoveredBySubscription = Boolean(this.db.queryOne<any>(`SELECT id FROM platform_subscription_payment_attempts
        WHERE organization_id = ? AND status = 'VERIFIED' AND period_start < ? AND period_end > ? LIMIT 1`,
      [organizationId, periodEnd, periodStart]));
      const monthlyBaseDuePaise = baseCoveredBySubscription ? 0 : Number(tariff.monthly_base_paise);
      const totalPaise = monthlyBaseDuePaise + usageFeePaise;
      if (!Number.isSafeInteger(usageFeePaise) || !Number.isSafeInteger(totalPaise)) {
        throw new PilotBillingError(409, 'Calculated invoice exceeds the supported integer Paise range.');
      }
      const lines = [
        { type: baseCoveredBySubscription ? 'MONTHLY_BASE_COVERED' : 'MONTHLY_BASE', description: baseCoveredBySubscription ? 'Monthly base covered by a confirmed subscription payment' : 'Monthly platform subscription', quantity: 1, unitAmountPaise: Number(tariff.monthly_base_paise), amountPaise: monthlyBaseDuePaise },
        { type: 'PRINTED_SIDE_USAGE', description: 'Operator-confirmed printed sides above included allowance', quantity: billableSides, unitAmountPaise: Number(tariff.per_side_paise), amountPaise: usageFeePaise },
      ];
      const invoice = {
        id: crypto.randomUUID(), organization_id: organizationId, period_start: periodStart, period_end: periodEnd,
        tariff_id: tariff.id, currency: 'INR', monthly_base_paise: monthlyBaseDuePaise,
        included_sides: includedSides, confirmed_sides: confirmedSides, billable_sides: billableSides,
        per_side_paise: Number(tariff.per_side_paise), usage_fee_paise: usageFeePaise, total_paise: totalPaise,
        line_items_json: JSON.stringify(lines), issued_by: issuedBy, issued_at: new Date().toISOString(),
      };
      const inserted = this.db.queryOne<any>(`INSERT INTO subscription_invoices
        (id, organization_id, period_start, period_end, tariff_id, currency, monthly_base_paise, included_sides, confirmed_sides, billable_sides, per_side_paise, usage_fee_paise, total_paise, line_items_json, issued_by, issued_at)
        VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (organization_id, period_start, period_end) DO NOTHING RETURNING id`,
      [invoice.id, invoice.organization_id, invoice.period_start, invoice.period_end, invoice.tariff_id, invoice.monthly_base_paise, invoice.included_sides, invoice.confirmed_sides, invoice.billable_sides, invoice.per_side_paise, invoice.usage_fee_paise, invoice.total_paise, invoice.line_items_json, invoice.issued_by, invoice.issued_at]);
      const saved = this.db.queryOne<any>(`SELECT * FROM subscription_invoices WHERE organization_id = ? AND period_start = ? AND period_end = ?`, [organizationId, periodStart, periodEnd]);
      return { created: Boolean(inserted), invoice: invoiceView(saved) };
    });
  }
}
