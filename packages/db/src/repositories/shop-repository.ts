import { DatabaseService } from '../database';
import { Organization, Shop } from '@inklly/shared';

export class ShopRepository {
  constructor(private db: DatabaseService) {}

  public createOrganization(org: Organization): void {
    this.db.execute(
      `INSERT INTO organizations (id, name, owner_user_id, plan_tier, plan_status, billing_currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        org.id,
        org.name,
        org.ownerUserId,
        org.planTier,
        org.planStatus,
        org.billingCurrency,
        org.createdAt,
        org.updatedAt,
      ]
    );
  }

  public getOrganizationById(id: string): Organization | null {
    const row = this.db.queryOne<any>(`SELECT * FROM organizations WHERE id = ?`, [id]);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      ownerUserId: row.owner_user_id,
      planTier: row.plan_tier,
      planStatus: row.plan_status,
      billingCurrency: row.billing_currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public createShop(shop: Shop): void {
    this.db.execute(
      `INSERT INTO shops (
        id, organization_id, shop_code, name, tagline, phone, email,
        address, city, state, pin_code, gstin, currency,
        payment_gateway, accept_cash_on_collection, auto_print_mode,
        order_separator, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shop.id,
        shop.organizationId,
        shop.shopCode,
        shop.name,
        shop.tagline || null,
        shop.phone,
        shop.email,
        shop.address,
        shop.city,
        shop.state,
        shop.pinCode,
        shop.gstin || null,
        shop.currency,
        shop.paymentGateway,
        shop.acceptCashOnCollection ? 1 : 0,
        shop.autoPrintMode,
        shop.orderSeparator,
        shop.isActive ? 1 : 0,
        shop.createdAt,
        shop.updatedAt,
      ]
    );
  }

  public getShopByCode(code: string): Shop | null {
    const row = this.db.queryOne<any>(`SELECT * FROM shops WHERE shop_code = ?`, [code]);
    if (!row) return null;
    return this.mapShopRow(row);
  }

  public getShopById(id: string): Shop | null {
    const row = this.db.queryOne<any>(`SELECT * FROM shops WHERE id = ?`, [id]);
    if (!row) return null;
    return this.mapShopRow(row);
  }

  public getShopsByOrg(orgId: string): Shop[] {
    const rows = this.db.query<any>(`SELECT * FROM shops WHERE organization_id = ?`, [orgId]);
    return rows.map(this.mapShopRow);
  }

  public updateShopSettings(
    shopId: string,
    updates: Partial<Pick<Shop, 'paymentGateway' | 'acceptCashOnCollection' | 'autoPrintMode' | 'orderSeparator'>>
  ): void {
    const current = this.getShopById(shopId);
    if (!current) throw new Error('Shop not found');

    this.db.execute(
      `UPDATE shops SET
        payment_gateway = COALESCE(?, payment_gateway),
        accept_cash_on_collection = COALESCE(?, accept_cash_on_collection),
        auto_print_mode = COALESCE(?, auto_print_mode),
        order_separator = COALESCE(?, order_separator),
        updated_at = ?
       WHERE id = ?`,
      [
        updates.paymentGateway || null,
        updates.acceptCashOnCollection !== undefined ? (updates.acceptCashOnCollection ? 1 : 0) : null,
        updates.autoPrintMode || null,
        updates.orderSeparator || null,
        new Date().toISOString(),
        shopId,
      ]
    );
  }

  private mapShopRow(row: any): Shop {
    return {
      id: row.id,
      organizationId: row.organization_id,
      shopCode: row.shop_code,
      name: row.name,
      tagline: row.tagline,
      phone: row.phone,
      email: row.email,
      address: row.address,
      city: row.city,
      state: row.state,
      pinCode: row.pin_code,
      gstin: row.gstin,
      currency: row.currency,
      paymentGateway: row.payment_gateway,
      acceptCashOnCollection: Boolean(row.accept_cash_on_collection),
      autoPrintMode: row.auto_print_mode,
      orderSeparator: row.order_separator,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
