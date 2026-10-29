import { DatabaseService } from '@inklly/db';
import { PrivateFileStorage } from './private-file-storage';

const MAX_BATCH_SIZE = 100;

/** Retry tombstoned merchant-vault objects in bounded batches. */
export async function purgePendingVaultDeletions(
  db: DatabaseService,
  fileStorage: PrivateFileStorage,
  batchSize = 50
): Promise<number> {
  const limit = Number.isInteger(batchSize) ? Math.max(1, Math.min(MAX_BATCH_SIZE, batchSize)) : 50;
  const rows = db.query<{ id: string; shop_id: string; storage_key: string }>(
    `SELECT id, shop_id, storage_key FROM storage_documents
     WHERE deletion_requested_at IS NOT NULL ORDER BY deletion_requested_at, id LIMIT ?`, [limit]
  );
  let completed = 0;
  for (const row of rows) {
    try {
      const referencedByOrder = db.queryOne<{ id: string }>(
        `SELECT id FROM order_files WHERE storage_key = ? LIMIT 1`, [row.storage_key]
      );
      if (!referencedByOrder && !row.storage_key.startsWith('expired:') && !await fileStorage.remove(row.storage_key)) continue;
      db.execute(
        `DELETE FROM storage_documents WHERE id = ? AND shop_id = ? AND deletion_requested_at IS NOT NULL`,
        [row.id, row.shop_id]
      );
      completed += 1;
    } catch (error) {
      // Keep the tombstone so the next bounded pass can safely retry it.
      console.error(`[Vault deletion] Cleanup failed for document ${row.id}:`, error);
    }
  }
  return completed;
}
