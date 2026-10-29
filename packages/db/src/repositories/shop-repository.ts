import { DatabaseService } from '../database';
import { Organization, Shop } from '@inklly/shared';

export interface ShopPortalSettings {
  requiredFields: { name: boolean; phone: boolean };
  allowedOptions: { colorModes: Array<'bw' | 'color' | 'mixed'>; duplexModes: Array<'simplex' | 'duplex_auto'>; paperSizes: Array<'A4' | 'A3' | 'PHOTO_4X6' | 'PHOTO_5X7'>; pageSelection: boolean };
}

export const DEFAULT_SHOP_PORTAL_SETTINGS: ShopPortalSettings = {
  requiredFields: { name: true, phone: true },
  allowedOptions: { colorModes: ['bw', 'color', 'mixed'], duplexModes: ['simplex', 'duplex_auto'], paperSizes: ['A4', 'A3', 'PHOTO_4X6', 'PHOTO_5X7'], pageSelection: true },
};

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

  public getPortalSettings(shopId: string): ShopPortalSettings {
    const row = this.db.queryOne<any>(`SELECT settings_json FROM shop_portal_settings WHERE shop_id = ?`, [shopId]);
    if (!row) return structuredClone(DEFAULT_SHOP_PORTAL_SETTINGS);
    try {
      const value = JSON.parse(row.settings_json);
      return {
        requiredFields: { name: value.requiredFields?.name !== false, phone: value.requiredFields?.phone !== false },
        allowedOptions: {
          colorModes: (['bw', 'color', 'mixed'] as const).filter((key) => value.allowedOptions?.colorModes?.includes(key)),
          duplexModes: (['simplex', 'duplex_auto'] as const).filter((key) => value.allowedOptions?.duplexModes?.includes(key)),
          paperSizes: (['A4', 'A3', 'PHOTO_4X6', 'PHOTO_5X7'] as const).filter((key) => value.allowedOptions?.paperSizes?.includes(key)),
          pageSelection: value.allowedOptions?.pageSelection !== false,
        },
      };
    } catch { return structuredClone(DEFAULT_SHOP_PORTAL_SETTINGS); }
  }

  public updatePortalSettings(shopId: string, input: unknown): ShopPortalSettings {
    if (!this.getShopById(shopId)) throw new Error('Shop not found');
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Portal settings must be an object.');
    const value = input as any;
    const fields = value.requiredFields;
    const options = value.allowedOptions;
    if (!fields || typeof fields.name !== 'boolean' || typeof fields.phone !== 'boolean' || !options || typeof options.pageSelection !== 'boolean') {
      throw new Error('Portal settings are incomplete.');
    }
    const enumList = <T extends string>(candidate: unknown, allowed: readonly T[], label: string): T[] => {
      if (!Array.isArray(candidate) || candidate.some((item) => !allowed.includes(item))) throw new Error(`${label} contains an unsupported option.`);
      const result = [...new Set(candidate as T[])];
      if (!result.length) throw new Error(`At least one ${label.toLowerCase()} must remain available.`);
      return result;
    };
    const settings: ShopPortalSettings = {
      requiredFields: { name: fields.name, phone: fields.phone },
      allowedOptions: {
        colorModes: enumList(options.colorModes, ['bw', 'color', 'mixed'] as const, 'Color modes'),
        duplexModes: enumList(options.duplexModes, ['simplex', 'duplex_auto'] as const, 'Duplex modes'),
        paperSizes: enumList(options.paperSizes, ['A4', 'A3', 'PHOTO_4X6', 'PHOTO_5X7'] as const, 'Paper sizes'),
        pageSelection: options.pageSelection,
      },
    };
    if (settings.allowedOptions.colorModes.includes('mixed') &&
        (!settings.allowedOptions.colorModes.includes('bw') || !settings.allowedOptions.colorModes.includes('color'))) {
      throw new Error('Mixed color mode requires both Black & White and Color to be enabled.');
    }
    this.db.execute(`INSERT INTO shop_portal_settings (shop_id, settings_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(shop_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`, [shopId, JSON.stringify(settings), new Date().toISOString()]);
    return settings;
  }

  public updateShopSettings(
    shopId: string,
    updates: Partial<Pick<Shop, 'name' | 'tagline' | 'phone' | 'address' | 'city' | 'state' | 'pinCode' | 'paymentGateway' | 'acceptCashOnCollection' | 'autoPrintMode' | 'orderSeparator'>>
  ): void {
    const current = this.getShopById(shopId);
    if (!current) throw new Error('Shop not found');
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) throw new Error('Settings payload must be an object.');
    const allowedFields = new Set(['name', 'tagline', 'phone', 'address', 'city', 'state', 'pinCode', 'paymentGateway', 'acceptCashOnCollection', 'autoPrintMode', 'orderSeparator']);
    const keys = Object.keys(updates);
    if (!keys.length) throw new Error('At least one supported setting is required.');
    const unsupported = keys.find((key) => !allowedFields.has(key));
    if (unsupported) throw new Error(`Unsupported shop setting: ${unsupported}.`);

    const columns: Record<string, string> = {
      name: 'name', tagline: 'tagline', phone: 'phone', address: 'address', city: 'city', state: 'state', pinCode: 'pin_code',
      paymentGateway: 'payment_gateway', acceptCashOnCollection: 'accept_cash_on_collection',
      autoPrintMode: 'auto_print_mode', orderSeparator: 'order_separator',
    };
    const values: Array<string | number | null> = [];
    const assignments = keys.map((key) => {
      const value = (updates as any)[key];
      if (['name', 'phone', 'address', 'city', 'state', 'pinCode'].includes(key)) {
        if (typeof value !== 'string' || !value.trim() || value.trim().length > (key === 'address' ? 240 : 120)) throw new Error(`${key} must be a non-empty string of supported length.`);
        if (key === 'pinCode' && !/^\d{6}$/.test(value.trim())) throw new Error('pinCode must be a six-digit Indian PIN code.');
        values.push(value.trim());
      } else if (key === 'tagline') {
        if (typeof value !== 'string' || value.length > 180) throw new Error('tagline must be a string of at most 180 characters.');
        values.push(value.trim() || null);
      } else if (key === 'acceptCashOnCollection') {
        if (typeof value !== 'boolean') throw new Error('acceptCashOnCollection must be a boolean.');
        values.push(value ? 1 : 0);
      } else if (key === 'paymentGateway') {
        if (!['RAZORPAY', 'STRIPE', 'CASH_ONLY'].includes(value)) throw new Error('paymentGateway is not supported.');
        values.push(value);
      } else if (key === 'autoPrintMode') {
        if (!['AUTO_ALL', 'PRINT_AFTER_PAYMENT', 'MANUAL_OFF'].includes(value)) throw new Error('autoPrintMode is not supported.');
        values.push(value);
      } else if (key === 'orderSeparator') {
        if (!['NONE', 'BW_INVOICE', 'BLANK_PAGE'].includes(value)) throw new Error('orderSeparator is not supported.');
        values.push(value);
      }
      return `${columns[key]} = ?`;
    });
    values.push(new Date().toISOString(), shopId);
    this.db.execute(`UPDATE shops SET ${assignments.join(', ')}, updated_at = ? WHERE id = ?`, values);
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
