import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { DatabaseService, OrderRepository, seedDatabase } from '@inklly/db';
import { purgeExpiredPrintFiles } from '../services/print-file-retention';

describe('private print-file retention', () => {
  it('blocks a new order from claiming a file after retention starts deleting it', async () => {
    const db = new DatabaseService(':memory:');
    seedDatabase(db);
    const shopId = 'shop-campus-1';
    const storageKey = `uploads/${shopId}/retention-race.pdf`;
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    db.execute(
      `INSERT INTO orders (id, shop_id, order_number, status, payment_status, payment_method, total_amount_paise, currency, quote_version, created_at, updated_at, collected_at)
       VALUES ('retention-race-completed', ?, 'INK-RETENTION-RACE-1', 'COLLECTED', 'PAID', 'CASH_ON_COLLECTION', 100, 'INR', 'v1', ?, ?, ?)`,
      [shopId, old, old, old]
    );
    db.execute(
      `INSERT INTO order_files (id, order_id, file_name, file_size_bytes, mime_type, storage_key, page_count, print_options, line_subtotal_paise, created_at)
       VALUES ('retention-race-file', 'retention-race-completed', 'race.pdf', 1234, 'application/pdf', ?, 1, '{}', 100, ?)`,
      [storageKey, old]
    );

    let signalDeleteStarted!: () => void;
    const deleteStarted = new Promise<void>((resolve) => { signalDeleteStarted = resolve; });
    let finishDelete!: () => void;
    const deleteGate = new Promise<void>((resolve) => { finishDelete = resolve; });
    const storage = {
      async remove(key: string) {
        assert.equal(key, storageKey);
        signalDeleteStarted();
        await deleteGate;
        return true;
      },
      async list() { return []; },
    } as any;

    const order = {
      id: 'retention-race-new-order', shopId, orderNumber: 'INK-RETENTION-RACE-2', tokenNumber: 'T-RACE0002',
      customerName: 'Race Test', channel: 'QR_PORTAL', status: 'AWAITING_REVIEW', paymentStatus: 'PENDING',
      paymentMethod: 'CASH_ON_COLLECTION', totalAmountPaise: 100, currency: 'INR', quoteVersion: 'v1',
      files: [{ id: 'retention-race-new-file', orderId: 'retention-race-new-order', fileName: 'race.pdf',
        fileSizeBytes: 1234, mimeType: 'application/pdf', storageKey, pageCount: 1,
        printOptions: { copies: 1 }, lineSubtotalPaise: 100 }],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as any;

    try {
      const purge = purgeExpiredPrintFiles(db, storage);
      await deleteStarted;
      const duplicateRemovals: string[] = [];
      const competingStorage = {
        async remove(key: string) { duplicateRemovals.push(key); return true; },
        async list() { return []; },
      } as any;
      const competingPass = await purgeExpiredPrintFiles(db, competingStorage);
      assert.equal(competingPass.expiredFilesDeleted, 0, 'an unexpired claim must not be stolen by another cleanup worker');
      assert.deepEqual(duplicateRemovals, []);
      assert.throws(
        () => new OrderRepository(db).createOrderIdempotently(order, 'retention-race-key-0001', 'race-hash'),
        (error: any) => error.code === 'PRINT_FILE_UNAVAILABLE'
      );
      assert.equal(db.queryOne<any>(`SELECT id FROM orders WHERE id = ?`, [order.id]), null,
        'a rejected submission must not leave a customer order referring to the deleting object');
      finishDelete();
      const summary = await purge;
      assert.equal(summary.expiredFilesDeleted, 1);
      assert.equal(db.queryOne<any>(`SELECT status FROM print_file_lifecycle WHERE storage_key = ?`, [storageKey]).status, 'DELETED');
    } finally {
      finishDelete();
      db.close();
    }
  });

  it('reclaims an expired purge lease after a worker stops mid-delete', async () => {
    const db = new DatabaseService(':memory:');
    seedDatabase(db);
    const shopId = 'shop-campus-1';
    const storageKey = `uploads/${shopId}/stale-claim.pdf`;
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    db.execute(
      `INSERT INTO orders (id, shop_id, order_number, status, payment_status, payment_method, total_amount_paise, currency, quote_version, created_at, updated_at, collected_at)
       VALUES ('stale-claim-order', ?, 'INK-STALE-CLAIM', 'COLLECTED', 'PAID', 'CASH_ON_COLLECTION', 100, 'INR', 'v1', ?, ?, ?)`,
      [shopId, old, old, old]
    );
    db.execute(
      `INSERT INTO order_files (id, order_id, file_name, file_size_bytes, mime_type, storage_key, page_count, print_options, line_subtotal_paise, created_at)
       VALUES ('stale-claim-file', 'stale-claim-order', 'stale.pdf', 1234, 'application/pdf', ?, 1, '{}', 100, ?)`,
      [storageKey, old]
    );
    db.execute(
      `INSERT INTO print_file_lifecycle (storage_key, status, claim_token, purging_until, updated_at)
       VALUES (?, 'PURGING', 'dead-worker-token', ?, ?)`,
      [storageKey, old, old]
    );
    const removed: string[] = [];
    const storage = {
      async remove(key: string) { removed.push(key); return true; },
      async list() { return []; },
    } as any;
    try {
      const summary = await purgeExpiredPrintFiles(db, storage);
      assert.equal(summary.expiredFilesDeleted, 1);
      assert.deepEqual(removed, [storageKey]);
      assert.equal(db.queryOne<any>(`SELECT status, claim_token, purging_until FROM print_file_lifecycle WHERE storage_key = ?`, [storageKey]).status, 'DELETED');
    } finally {
      db.close();
    }
  });

  it('removes eligible order files and paginates all stale orphan objects without skipping', async () => {
    const db = new DatabaseService(':memory:');
    seedDatabase(db);
    const shopId = 'shop-campus-1';
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    db.execute(
      `INSERT INTO orders (id, shop_id, order_number, status, payment_status, payment_method, total_amount_paise, currency, quote_version, created_at, updated_at, collected_at)
       VALUES ('retention-order', ?, 'INK-RETENTION-1', 'COLLECTED', 'PAID', 'CASH_ON_COLLECTION', 100, 'INR', 'v1', ?, ?, ?)`,
      [shopId, old, old, old]
    );
    db.execute(
      `INSERT INTO order_files (id, order_id, file_name, file_size_bytes, mime_type, storage_key, page_count, print_options, line_subtotal_paise, created_at)
       VALUES ('retention-file', 'retention-order', 'sample.pdf', 1234, 'application/pdf', ?, 1, '{}', 100, ?)`,
      [`uploads/${shopId}/sample.pdf`, old]
    );
    db.execute(
      `INSERT INTO orders (id, shop_id, order_number, status, payment_status, payment_method, total_amount_paise, currency, quote_version, created_at, updated_at)
       VALUES ('retention-open-order', ?, 'INK-RETENTION-2', 'IN_PROGRESS', 'PAID', 'CASH_ON_COLLECTION', 100, 'INR', 'v1', ?, ?)`,
      [shopId, old, old]
    );
    db.execute(
      `INSERT INTO order_files (id, order_id, file_name, file_size_bytes, mime_type, storage_key, page_count, print_options, line_subtotal_paise, created_at)
       VALUES ('retention-open-file', 'retention-open-order', 'sample.pdf', 1234, 'application/pdf', ?, 1, '{}', 100, ?)`,
      [`uploads/${shopId}/sample.pdf`, old]
    );
    db.execute(
      `INSERT INTO storage_documents (id, shop_id, file_name, mime_type, file_size_bytes, page_count, storage_key, created_at)
       VALUES ('vault-retention-document', ?, 'saved.pdf', 'application/pdf', 1234, 1, ?, ?)`,
      [shopId, `uploads/${shopId}/saved-vault-document.pdf`, old]
    );

    let orphanNames = [...Array.from({ length: 101 }, (_, index) => `orphan-${index}.pdf`), `${shopId}/saved-vault-document.pdf`];
    const removed: string[] = [];
    const storage = {
      async remove(key: string) {
        removed.push(key);
        if (key.startsWith('uploads/orphan-')) orphanNames = orphanNames.filter((name) => name !== key.slice('uploads/'.length));
        return true;
      },
      async list(prefix: string, limit: number, offset: number) {
        if (prefix) return [];
        return orphanNames.slice(offset, offset + limit).map((name) => ({
          name,
          id: name,
          created_at: old,
        }));
      },
    } as any;

    try {
      const [summary, sharedSummary] = await Promise.all([
        purgeExpiredPrintFiles(db, storage),
        purgeExpiredPrintFiles(db, storage),
      ]);
      assert.equal(summary, sharedSummary, 'simultaneous cleanup calls should share one in-process pass');
      assert.equal(summary.expiredFilesScanned, 1);
      assert.equal(summary.expiredFilesDeleted, 0, 'a file shared with an active order must be retained');
      assert.equal(summary.orphanFilesScanned, 101);
      assert.equal(summary.orphanFilesDeleted, 101);
      assert.deepEqual(orphanNames, [`${shopId}/saved-vault-document.pdf`], 'vault documents must not be purged as unreferenced order uploads');
      assert.equal(removed.includes(`uploads/${shopId}/sample.pdf`), false, 'shared order file must not be removed while another order is active');
      assert.equal(removed.includes(`uploads/${shopId}/saved-vault-document.pdf`), false);

      db.execute(`UPDATE orders SET status = 'COLLECTED', collected_at = ?, updated_at = ? WHERE id = 'retention-open-order'`, [old, old]);
      const finalSummary = await purgeExpiredPrintFiles(db, storage);
      assert.equal(finalSummary.expiredFilesScanned, 1);
      assert.equal(finalSummary.expiredFilesDeleted, 1, 'shared completed file should be deleted once no retained order references it');
      assert.equal(removed.filter((key) => key === `uploads/${shopId}/sample.pdf`).length, 1);
      const updatedFiles = db.query<any>(`SELECT id, storage_key FROM order_files WHERE id IN ('retention-file', 'retention-open-file')`);
      assert.equal(updatedFiles.length, 2);
      assert.ok(updatedFiles.every((file) => file.storage_key === `expired:${file.id}`));
    } finally {
      db.close();
    }
  });
});
