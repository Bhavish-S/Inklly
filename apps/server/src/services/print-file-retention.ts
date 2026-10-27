import { DatabaseService } from '@inklly/db';
import { PrivateFileStorage } from './private-file-storage';

const RETENTION_MS = 24 * 60 * 60 * 1000;
const ORPHAN_RETENTION_MS = 48 * 60 * 60 * 1000;

export async function purgeExpiredPrintFiles(db: DatabaseService, storage: PrivateFileStorage): Promise<void> {
  const retentionDate = new Date(Date.now() - RETENTION_MS).toISOString();
  const completed = db.query<any>(
    `SELECT of.id, of.storage_key FROM order_files of
     JOIN orders o ON o.id = of.order_id
     WHERE o.status IN ('COLLECTED', 'CANCELLED')
       AND COALESCE(o.collected_at, o.updated_at) <= ?
       AND of.storage_key NOT LIKE 'expired:%'`,
    [retentionDate]
  );

  for (const row of completed) {
    try {
      if (await storage.remove(row.storage_key)) {
      db.execute(`UPDATE order_files SET storage_key = ? WHERE id = ?`, [`expired:${row.id}`, row.id]);
      }
    } catch (error) {
      console.error('[File retention] Could not remove expired upload', error);
    }
  }

  // Remove abandoned uploads that were never attached to an order.
  const orphanDate = Date.now() - ORPHAN_RETENTION_MS;
  const walk = async (prefix: string): Promise<void> => {
    let offset = 0;
    while (true) {
      const entries = await storage.list(prefix, 100, offset);
      if (entries.length === 0) return;
      for (const entry of entries) {
        const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) {
          await walk(objectPath);
          continue;
        }
        const storageKey = `uploads/${objectPath}`;
        const referenced = db.queryOne<any>(`SELECT id FROM order_files WHERE storage_key = ? LIMIT 1`, [storageKey]);
        if (!referenced && entry.created_at && Date.parse(entry.created_at) <= orphanDate) {
          try { await storage.remove(storageKey); } catch (error) { console.error('[File retention] Could not remove abandoned upload', error); }
        }
      }
      if (entries.length < 100) return;
      offset += entries.length;
    }
  };
  try {
    await walk('');
  } catch (error) {
    console.error('[File retention] Orphan cleanup pass failed', error);
  }
}
