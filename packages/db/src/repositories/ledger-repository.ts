import { DatabaseService } from '../database';
import { LedgerEntry, MoneyDomain } from '@inklly/shared';

export class LedgerRepository {
  constructor(private db: DatabaseService) {}

  public appendEntry(entry: LedgerEntry): void {
    this.db.execute(
      `INSERT INTO ledger_entries (
        id, domain, organization_id, shop_id, order_id, amount_paise,
        currency, provider, provider_transaction_id, provider_event_id,
        description, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.domain,
        entry.organizationId || null,
        entry.shopId || null,
        entry.orderId || null,
        entry.amountPaise,
        entry.currency,
        entry.provider,
        entry.providerTransactionId || null,
        entry.providerEventId || null,
        entry.description,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.createdAt,
      ]
    );
  }

  public getEntriesByShop(shopId: string, domain?: MoneyDomain): LedgerEntry[] {
    let sql = `SELECT * FROM ledger_entries WHERE shop_id = ?`;
    const params: any[] = [shopId];

    if (domain) {
      sql += ` AND domain = ?`;
      params.push(domain);
    }
    sql += ` ORDER BY created_at DESC`;

    const rows = this.db.query<any>(sql, params);
    return rows.map(this.mapRow);
  }

  public getEntriesByOrg(orgId: string, domain?: MoneyDomain): LedgerEntry[] {
    let sql = `SELECT * FROM ledger_entries WHERE organization_id = ?`;
    const params: any[] = [orgId];

    if (domain) {
      sql += ` AND domain = ?`;
      params.push(domain);
    }
    sql += ` ORDER BY created_at DESC`;

    const rows = this.db.query<any>(sql, params);
    return rows.map(this.mapRow);
  }

  public calculateBalancePaise(shopId: string, domain: MoneyDomain, currency?: string): number {
    const row = currency
      ? this.db.queryOne<any>(
          `SELECT SUM(amount_paise) as balance FROM ledger_entries WHERE shop_id = ? AND domain = ? AND currency = ?`,
          [shopId, domain, currency]
        )
      : this.db.queryOne<any>(
          `SELECT SUM(amount_paise) as balance FROM ledger_entries WHERE shop_id = ? AND domain = ?`,
          [shopId, domain]
        );
    return row?.balance || 0;
  }

  private mapRow(r: any): LedgerEntry {
    return {
      id: r.id,
      domain: r.domain,
      organizationId: r.organization_id || undefined,
      shopId: r.shop_id || undefined,
      orderId: r.order_id || undefined,
      amountPaise: r.amount_paise,
      currency: r.currency,
      provider: r.provider,
      providerTransactionId: r.provider_transaction_id || undefined,
      providerEventId: r.provider_event_id || undefined,
      description: r.description,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      createdAt: r.created_at,
    };
  }
}
