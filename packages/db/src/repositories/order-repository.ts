import { DatabaseService } from '../database';
import { Order, OrderFile, OrderStatus, PaymentStatus, validateOrderTransition } from '@inklly/shared';

export class OrderRepository {
  constructor(private db: DatabaseService) {}

  public createOrder(order: Order): void {
    this.db.transaction(() => {
      const tokenNumber = order.tokenNumber || `T-${Math.floor(1000 + Math.random() * 9000)}`;
      this.db.execute(
        `INSERT INTO orders (
          id, shop_id, order_number, token_number, customer_name, customer_phone, customer_email,
          channel, status, payment_status, payment_method, total_amount_paise,
          currency, quote_version, notes, created_at, updated_at, collected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    });
  }

  public getOrderById(id: string): Order | null {
    const row = this.db.queryOne<any>(`SELECT * FROM orders WHERE id = ?`, [id]);
    if (!row) return null;
    return this.hydrateOrder(row);
  }

  public getOrderByNumber(orderNumber: string): Order | null {
    const row = this.db.queryOne<any>(`SELECT * FROM orders WHERE order_number = ?`, [orderNumber]);
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
    const current = this.getOrderById(orderId);
    if (!current) throw new Error(`Order ${orderId} not found`);

    // Enforce state machine transition validation
    validateOrderTransition(current.status, nextStatus);

    const now = new Date().toISOString();
    const collectedAt = nextStatus === 'COLLECTED' ? now : current.collectedAt || null;

    this.db.execute(
      `UPDATE orders SET status = ?, updated_at = ?, collected_at = ? WHERE id = ?`,
      [nextStatus, now, collectedAt, orderId]
    );
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
      files,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      collectedAt: row.collected_at,
    };
  }
}
