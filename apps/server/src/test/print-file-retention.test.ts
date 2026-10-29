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
