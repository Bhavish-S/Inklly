import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { DatabaseService, seedDatabase } from '@inklly/db';
import { purgeExpiredPrintFiles } from '../services/print-file-retention';

describe('private print-file retention', () => {
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

    let orphanNames = Array.from({ length: 101 }, (_, index) => `orphan-${index}.pdf`);
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
      assert.equal(summary.expiredFilesDeleted, 1);
      assert.equal(summary.orphanFilesScanned, 101);
      assert.equal(summary.orphanFilesDeleted, 101);
      assert.equal(orphanNames.length, 0);
      assert.equal(removed.filter((key) => key === `uploads/${shopId}/sample.pdf`).length, 1);
      const updatedFile = db.queryOne<any>(`SELECT storage_key FROM order_files WHERE id = 'retention-file'`);
      assert.equal(updatedFile.storage_key, 'expired:retention-file');
    } finally {
      db.close();
    }
  });
});
