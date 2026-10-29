import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService, seedDatabase } from '@inklly/db';
import { purgePendingVaultDeletions } from '../services/merchant-vault-retention';

describe('merchant vault deletion retries', () => {
  it('keeps pending metadata after storage failure and removes it on a later retry', async () => {
    const db = new DatabaseService(':memory:');
    try {
      seedDatabase(db);
      db.execute(
        `INSERT INTO storage_documents (id, shop_id, file_name, mime_type, file_size_bytes, page_count, storage_key, deletion_requested_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['vault-retry', 'shop-campus-1', 'retry.pdf', 'application/pdf', 120, 1,
          'uploads/shop-campus-1/retry.pdf', '2026-10-29T00:00:00.000Z', '2026-10-28T00:00:00.000Z']
      );
      let failOnce = true;
      const storage = {
        remove: async () => {
          if (failOnce) { failOnce = false; return false; }
          return true;
        },
      } as any;

      assert.equal(await purgePendingVaultDeletions(db, storage), 0);
      assert.ok(db.queryOne(`SELECT id FROM storage_documents WHERE id = 'vault-retry'`), 'failed storage removal preserves the tombstone');
      assert.equal(await purgePendingVaultDeletions(db, storage), 1);
      assert.equal(db.queryOne(`SELECT id FROM storage_documents WHERE id = 'vault-retry'`), null);
    } finally {
      db.close();
    }
  });

  it('preserves an object that is still referenced by an order file', async () => {
    const db = new DatabaseService(':memory:');
    try {
      seedDatabase(db);
      const order = db.queryOne<any>(`SELECT id FROM orders WHERE shop_id = 'shop-campus-1' LIMIT 1`);
      assert.ok(order);
      const storageKey = 'uploads/shop-campus-1/shared.pdf';
      db.execute(
        `INSERT INTO storage_documents (id, shop_id, file_name, mime_type, file_size_bytes, page_count, storage_key, deletion_requested_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['vault-shared', 'shop-campus-1', 'shared.pdf', 'application/pdf', 120, 1,
          storageKey, '2026-10-29T00:00:00.000Z', '2026-10-28T00:00:00.000Z']
      );
      db.execute(
        `INSERT INTO order_files (id, order_id, file_name, mime_type, file_size_bytes, page_count, storage_key, print_options, line_subtotal_paise, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['order-file-shared', order.id, 'shared.pdf', 'application/pdf', 120, 1, storageKey, '{}', 100, '2026-10-28T00:00:00.000Z']
      );
      let removeCalled = false;
      const storage = { remove: async () => { removeCalled = true; return true; } } as any;

      assert.equal(await purgePendingVaultDeletions(db, storage), 1);
      assert.equal(removeCalled, false, 'order file reference prevents object removal');
      assert.equal(db.queryOne(`SELECT id FROM storage_documents WHERE id = 'vault-shared'`), null);
      assert.ok(db.queryOne(`SELECT id FROM order_files WHERE id = 'order-file-shared'`));
    } finally {
      db.close();
    }
  });
});
