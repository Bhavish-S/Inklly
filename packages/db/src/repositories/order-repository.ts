import { DatabaseService } from '../database';
import { AgentRepository } from './agent-repository';
import { Order, OrderFile, OrderStatus, PaymentStatus, validateOrderTransition } from '@inklly/shared';
import { lockAvailablePrintFiles } from '../print-file-lifecycle';

export class OrderRepository {
  constructor(private db: DatabaseService) {}

  /** Tenant-scoped dashboard data without hydrating the shop's full order history. */
  public getDashboardSummaryByShop(shopId: string): { statusCounts: Record<string, number>; recentOrders: Order[] } {
    const counts = this.db.query<any>(
      `SELECT status, COUNT(*) AS count FROM orders WHERE shop_id = ? GROUP BY status`,
      [shopId]
    );
    const statusCounts: Record<string, number> = {};
    for (const row of counts) statusCounts[String(row.status)] = Number(row.count || 0);
    const recentRows = this.db.query<any>(
      `SELECT * FROM orders WHERE shop_id = ? ORDER BY created_at DESC, id DESC LIMIT 5`,
      [shopId]
    );
    return { statusCounts, recentOrders: this.hydrateOrders(recentRows) };
  }

  public getOrdersPageByShop(
    shopId: string,
    options: { status?: OrderStatus | 'ALL'; statuses?: OrderStatus[]; search?: string; page: number; pageSize: number; sortBy: 'createdAt' | 'totalAmountPaise' | 'status' | 'orderNumber'; sortOrder: 'asc' | 'desc' }
  ): { orders: Order[]; total: number; page: number; pageSize: number; totalPages: number; revenuePaise: number; pageCount: number } {
    const filters = ['shop_id = ?'];
    const params: Array<string | number | null> = [shopId];
    if (options.statuses?.length) {
      filters.push(`status IN (${options.statuses.map(() => '?').join(', ')})`);
      params.push(...options.statuses);
    } else if (options.status && options.status !== 'ALL') {
      filters.push('status = ?');
      params.push(options.status);
    }
    const search = options.search?.trim();
    if (search) {
      filters.push(`(LOWER(order_number) LIKE LOWER(?) OR LOWER(COALESCE(customer_name, '')) LIKE LOWER(?) OR LOWER(COALESCE(customer_phone, '')) LIKE LOWER(?) OR EXISTS (SELECT 1 FROM order_files f WHERE f.order_id = orders.id AND LOWER(f.file_name) LIKE LOWER(?)))`);
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }
    const where = filters.join(' AND ');
    const count = this.db.queryOne<{ total: number | string; revenue_paise: number | string; page_count: number | string }>(
      `SELECT COUNT(*) AS total, COALESCE(SUM(total_amount_paise), 0) AS revenue_paise,
       COALESCE(SUM((SELECT COALESCE(SUM(f.page_count), 0) FROM order_files f WHERE f.order_id = orders.id)), 0) AS page_count
       FROM orders WHERE ${where}`,
      params
    );
    const sortColumns = {
      createdAt: 'created_at',
      totalAmountPaise: 'total_amount_paise',
      status: 'status',
      orderNumber: 'order_number',
    } as const;
    const direction = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const rows = this.db.query<any>(
      `SELECT * FROM orders WHERE ${where} ORDER BY ${sortColumns[options.sortBy]} ${direction}, id DESC LIMIT ? OFFSET ?`,
      [...params, options.pageSize, (options.page - 1) * options.pageSize]
    );
    const total = Number(count?.total || 0);
    return {
      orders: this.hydrateOrders(rows),
      total,
      page: options.page,
      pageSize: options.pageSize,
      totalPages: Math.ceil(total / options.pageSize),
      revenuePaise: Number(count?.revenue_paise || 0),
      pageCount: Number(count?.page_count || 0),
    };
  }

  public createOrder(order: Order): void {
    this.db.transaction(() => {
      this.persistOrder(order);
    });
  }

  /** Creates a customer portal order once per shop/key and returns the original order on retry. */
  public findIdempotentOrder(shopId: string, idempotencyKey: string, requestHash: string): { orderId: string; replayed: boolean; conflict: boolean } | null {
    const existing = this.db.queryOne<any>(
      `SELECT request_hash, order_id FROM portal_order_idempotency WHERE shop_id = ? AND idempotency_key = ?`,
      [shopId, idempotencyKey]
    );
    if (!existing) return null;
    return existing.request_hash === requestHash
      ? { orderId: existing.order_id, replayed: true, conflict: false }
      : { orderId: existing.order_id, replayed: false, conflict: true };
  }

  public createOrderIdempotently(order: Order, idempotencyKey: string, requestHash: string): { orderId: string; replayed: boolean; conflict: boolean } {
    const existing = this.findIdempotentOrder(order.shopId, idempotencyKey, requestHash);
    if (existing) {
      return existing;
    }

    try {
      this.db.transaction(() => {
        this.persistOrder(order);
        this.db.execute(
          `INSERT INTO portal_order_idempotency (shop_id, idempotency_key, request_hash, order_id, created_at) VALUES (?, ?, ?, ?, ?)`,
          [order.shopId, idempotencyKey, requestHash, order.id, order.createdAt]
        );
        const shop = this.db.queryOne<{ organization_id: string }>(`SELECT organization_id FROM shops WHERE id = ?`, [order.shopId]);
        if (shop) {
          new AgentRepository(this.db).enqueueWebhookEvent(shop.organization_id, 'order.created', `order.created:${order.id}`, {
            orderId: order.id,
            orderNumber: order.orderNumber,
            shopId: order.shopId,
            status: order.status,
            totalAmountPaise: order.totalAmountPaise,
            currency: order.currency || 'INR',
            createdAt: order.createdAt,
          });
        }
      });
      return { orderId: order.id, replayed: false, conflict: false };
    } catch (error) {
      // A concurrent retry can pass the initial read. Once the winning transaction
      // commits, resolve that uniqueness race to the original order.
      const raced = this.findIdempotentOrder(order.shopId, idempotencyKey, requestHash);
      if (raced) {
        return raced;
      }
      throw error;
    }
  }

  private persistOrder(order: Order): void {
      lockAvailablePrintFiles(this.db, order.files.map((file) => file.storageKey || ''));
      const tokenNumber = order.tokenNumber || `T-${Math.floor(1000 + Math.random() * 9000)}`;
      this.db.execute(
        `INSERT INTO orders (
          id, shop_id, order_number, token_number, customer_name, customer_phone, customer_email,
          channel, status, payment_status, payment_method, total_amount_paise,
          currency, quote_version, pricing_snapshot, notes, created_at, updated_at, collected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          order.shopId,
          order.orderNumber,
          tokenNumber,
          order.customerName || null,
          order.customerPhone || null,
          order.customerEmail || null,
          order.channel,
          order.status,
          order.paymentStatus,
          order.paymentMethod,
          order.totalAmountPaise,
          order.currency || 'INR',
          order.quoteVersion || 'v1.0',
          order.pricingSnapshot ? JSON.stringify(order.pricingSnapshot) : null,
          order.notes || null,
          order.createdAt,
          order.updatedAt,
          order.collectedAt || null,
        ]
      );

      for (const file of order.files) {
        this.db.execute(
          `INSERT INTO order_files (
            id, order_id, file_name, file_size_bytes, mime_type, storage_key,
            page_count, print_options, line_subtotal_paise, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            file.id,
            order.id,
            file.fileName,
            file.fileSizeBytes || 1024,
            file.mimeType || 'application/pdf',
            file.storageKey || '',
            file.pageCount || 1,
            JSON.stringify(file.printOptions || {}),
            file.lineSubtotalPaise || 200,
            order.createdAt,
          ]
        );

        // Create associated print job
        this.db.execute(
          `INSERT INTO print_jobs (id, order_id, order_file_id, status, created_at, updated_at)
           VALUES (?, ?, ?, 'RECEIVED', ?, ?)`,
          [
            `job-${file.id}`,
            order.id,
            file.id,
            order.createdAt,
            order.createdAt,
          ]
        );
      }
  }

  public getOrderById(id: string): Order | null {
    const row = this.db.queryOne<any>(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!row) return null;
    return this.hydrateOrder(row);
  }

  public getOrderByIdForShop(id: string, shopId: string): Order | null {
    const row = this.db.queryOne<any>(`SELECT * FROM orders WHERE id = ? AND shop_id = ?`, [id, shopId]);
    if (!row) return null;
    return this.hydrateOrder(row);
  }

  public getOrderByNumber(orderNumber: string): Order | null {
    const row = this.db.queryOne<any>(`SELECT * FROM orders WHERE order_number = ?`, [orderNumber]);
    if (!row) return null;
    return this.hydrateOrder(row);
  }

  public getOrderByNumberForShop(orderNumber: string, shopId: string): Order | null {
    const row = this.db.queryOne<any>(`SELECT * FROM orders WHERE order_number = ? AND shop_id = ?`, [orderNumber, shopId]);
    if (!row) return null;
    return this.hydrateOrder(row);
  }

  public getOrdersByShop(shopId: string, statusFilter?: OrderStatus | 'ALL'): Order[] {
    let sql = `SELECT * FROM orders WHERE shop_id = ?`;
    const params: any[] = [shopId];

    if (statusFilter && statusFilter !== 'ALL') {
      sql += ` AND status = ?`;
      params.push(statusFilter);
    }

    sql += ` ORDER BY created_at DESC`;

    const rows = this.db.query<any>(sql, params);
    return rows.map((r) => this.hydrateOrder(r));
  }

  public updateOrderStatus(orderId: string, nextStatus: OrderStatus): void {
    this.db.transaction(() => {
      // Acquire the order row before reading its current state. This prevents
      // two concurrent requests from validating against the same stale status.
      const locked = this.db.queryOne<any>(
        `UPDATE orders SET updated_at = updated_at WHERE id = ? RETURNING id`,
        [orderId]
      );
      if (!locked) throw new Error(`Order ${orderId} not found`);

      const current = this.getOrderById(orderId);
      if (!current) throw new Error(`Order ${orderId} not found`);
      validateOrderTransition(current.status, nextStatus);

      const now = new Date().toISOString();
      const collectedAt = nextStatus === 'COLLECTED' ? now : current.collectedAt || null;
      const updated = this.db.queryOne<any>(
        `UPDATE orders SET status = ?, updated_at = ?, collected_at = ? WHERE id = ? AND status = ? RETURNING id`,
        [nextStatus, now, collectedAt, orderId, current.status]
      );
      if (!updated) throw new Error(`Order ${orderId} changed while its status was being updated`);
      const shop = this.db.queryOne<{ organization_id: string }>(`SELECT organization_id FROM shops WHERE id = ?`, [current.shopId]);
      if (shop) {
        new AgentRepository(this.db).enqueueWebhookEvent(shop.organization_id, 'order.status_changed', `order.status_changed:${orderId}:${now}`, {
          orderId,
          orderNumber: current.orderNumber,
          shopId: current.shopId,
          previousStatus: current.status,
          status: nextStatus,
          updatedAt: now,
        });
      }
    });
  }

  public updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus): void {
    const now = new Date().toISOString();
    this.db.execute(
      `UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?`,
      [paymentStatus, now, orderId]
    );
  }

  private hydrateOrder(row: any): Order {
    const fileRows = this.db.query<any>(
      `SELECT * FROM order_files WHERE order_id = ?`,
      [row.id]
    );

    return this.hydrateOrderWithFiles(row, fileRows);
  }

  /** Hydrate a bounded result page with one file query instead of one query per order. */
  private hydrateOrders(rows: any[]): Order[] {
    if (!rows.length) return [];
    const files = this.db.query<any>(
      `SELECT * FROM order_files WHERE order_id IN (${rows.map(() => '?').join(', ')}) ORDER BY order_id, id`,
      rows.map((row) => row.id)
    );
    const filesByOrder = new Map<string, any[]>();
    for (const file of files) {
      const group = filesByOrder.get(file.order_id) || [];
      group.push(file);
      filesByOrder.set(file.order_id, group);
    }
    return rows.map((row) => this.hydrateOrderWithFiles(row, filesByOrder.get(row.id) || []));
  }

  private hydrateOrderWithFiles(row: any, fileRows: any[]): Order {

    const files: OrderFile[] = fileRows.map((f) => ({
      id: f.id,
      orderId: f.order_id,
      fileName: f.file_name,
      fileSizeBytes: f.file_size_bytes,
      mimeType: f.mime_type,
      storageKey: f.storage_key,
      pageCount: f.page_count,
      printOptions: JSON.parse(f.print_options),
      lineSubtotalPaise: f.line_subtotal_paise,
    }));

    return {
      id: row.id,
      shopId: row.shop_id,
      orderNumber: row.order_number,
      tokenNumber: row.token_number || '',
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email,
      channel: row.channel,
      status: row.status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      totalAmountPaise: row.total_amount_paise,
      currency: row.currency,
      quoteVersion: row.quote_version,
      pricingSnapshot: row.pricing_snapshot ? JSON.parse(row.pricing_snapshot) : undefined,
      files,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      collectedAt: row.collected_at,
    };
  }
}
