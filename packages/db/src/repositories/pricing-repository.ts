import { DatabaseService } from '../database';
import { BulkDiscountRule, CopyDiscountRule, RateRule } from '@inklly/shared';

export class PricingRepository {
  constructor(private db: DatabaseService) {}

  public getRateRules(shopId: string, printerId?: string): RateRule[] {
    let sql = `SELECT * FROM rate_rules WHERE shop_id = ?`;
    const params: any[] = [shopId];

    if (printerId) {
      sql += ` AND (printer_id = ? OR printer_id IS NULL)`;
      params.push(printerId);
    } else {
      sql += ` AND printer_id IS NULL`;
    }

    const rows = this.db.query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      shopId: r.shop_id,
      printerId: r.printer_id || undefined,
      paperSize: r.paper_size,
      colorMode: r.color_mode,
      duplexMode: r.duplex_mode,
      pricePerPrintedSidePaise: r.price_per_printed_side_paise,
    }));
  }

  public setRateRule(rule: RateRule): void {
    const now = new Date().toISOString();
    const conflictTarget = rule.printerId
      ? `(shop_id, printer_id, paper_size, color_mode, duplex_mode) WHERE printer_id IS NOT NULL`
      : `(shop_id, paper_size, color_mode, duplex_mode) WHERE printer_id IS NULL`;
    this.db.execute(
      `INSERT INTO rate_rules (id, shop_id, printer_id, paper_size, color_mode, duplex_mode, price_per_printed_side_paise, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT ${conflictTarget} DO UPDATE SET price_per_printed_side_paise = excluded.price_per_printed_side_paise, updated_at = excluded.updated_at`,
      [rule.id, rule.shopId, rule.printerId || null, rule.paperSize, rule.colorMode, rule.duplexMode, rule.pricePerPrintedSidePaise, now, now]
    );
  }

  public getCopyDiscountRules(shopId: string): CopyDiscountRule[] {
    const rows = this.db.query<any>(`SELECT * FROM copy_discount_rules WHERE shop_id = ?`, [shopId]);
    return rows.map((r) => ({
      id: r.id,
      shopId: r.shop_id,
      paperSize: r.paper_size,
      colorMode: r.color_mode,
      duplexMode: r.duplex_mode,
      copyOnePricePaise: r.copy_one_price_paise,
      additionalCopyPricePaise: r.additional_copy_price_paise,
      isEnabled: Boolean(r.is_enabled),
    }));
  }

  public getBulkDiscountRule(shopId: string): BulkDiscountRule | null {
    const row = this.db.queryOne<any>(`SELECT * FROM bulk_discount_rules WHERE shop_id = ?`, [shopId]);
    if (!row) return null;
    return {
      id: row.id,
      shopId: row.shop_id,
      minOrderValuePaise: row.min_order_value_paise,
      discountPercentage: row.discount_percentage,
      isEnabled: Boolean(row.is_enabled),
    };
  }

  public setBulkDiscountRule(rule: BulkDiscountRule): void {
    const existing = this.getBulkDiscountRule(rule.shopId);
    if (existing) {
      this.db.execute(
        `UPDATE bulk_discount_rules SET min_order_value_paise = ?, discount_percentage = ?, is_enabled = ? WHERE shop_id = ?`,
        [rule.minOrderValuePaise, rule.discountPercentage, rule.isEnabled ? 1 : 0, rule.shopId]
      );
    } else {
      this.db.execute(
        `INSERT INTO bulk_discount_rules (id, shop_id, min_order_value_paise, discount_percentage, is_enabled)
         VALUES (?, ?, ?, ?, ?)`,
        [rule.id, rule.shopId, rule.minOrderValuePaise, rule.discountPercentage, rule.isEnabled ? 1 : 0]
      );
    }
  }
}
