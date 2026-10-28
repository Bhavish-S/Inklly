import { DatabaseService } from '@inklly/db';
import { PrivateFileStorage } from './private-file-storage';

const RETENTION_MS = 24 * 60 * 60 * 1000;
const ORPHAN_RETENTION_MS = 48 * 60 * 60 * 1000;

export interface RetentionPurgeSummary {
  startedAt: string;
  completedAt: string;
  expiredFilesScanned: number;
  expiredFilesDeleted: number;
  expiredFilesFailed: number;
  orphanFilesScanned: number;
  orphanFilesDeleted: number;
  orphanFilesFailed: number;
}

let inFlightPurge: { db: DatabaseService; storage: PrivateFileStorage; promise: Promise<RetentionPurgeSummary> } | null = null;

export function purgeExpiredPrintFiles(db: DatabaseService, storage: PrivateFileStorage): Promise<RetentionPurgeSummary> {
  // Scheduled and operator-triggered cleanup in this process share one pass.
  // Storage deletion is idempotent, so separate server instances remain safe.
  if (inFlightPurge?.db === db && inFlightPurge.storage === storage) return inFlightPurge.promise;
  const promise = performPurge(db, storage).finally(() => {
    if (inFlightPurge?.promise === promise) inFlightPurge = null;
  });
  inFlightPurge = { db, storage, promise };
  return promise;
}

async function performPurge(db: DatabaseService, storage: PrivateFileStorage): Promise<RetentionPurgeSummary> {
  const summary: RetentionPurgeSummary = {
    startedAt: new Date().toISOString(), completedAt: '',
    expiredFilesScanned: 0, expiredFilesDeleted: 0, expiredFilesFailed: 0,
    orphanFilesScanned: 0, orphanFilesDeleted: 0, orphanFilesFailed: 0,
  };
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
    summary.expiredFilesScanned++;
    try {
      if (await storage.remove(row.storage_key)) {
        db.execute(`UPDATE order_files SET storage_key = ? WHERE id = ? AND storage_key = ?`, [`expired:${row.id}`, row.id, row.storage_key]);
        summary.expiredFilesDeleted++;
      } else {
        summary.expiredFilesFailed++;
      }
    } catch (error) {
      summary.expiredFilesFailed++;
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
      let deletedOnPage = false;
      for (const entry of entries) {
        const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) {
          await walk(objectPath);
          continue;
        }
        const storageKey = `uploads/${objectPath}`;
        const referenced = db.queryOne<any>(
          `SELECT id FROM order_files WHERE storage_key = ?
           UNION ALL
           SELECT id FROM storage_documents WHERE storage_key = ?
           LIMIT 1`,
          [storageKey, storageKey]
        );
        if (!referenced && entry.created_at && Date.parse(entry.created_at) <= orphanDate) {
          summary.orphanFilesScanned++;
          try {
            if (await storage.remove(storageKey)) {
              summary.orphanFilesDeleted++;
              deletedOnPage = true;
            } else summary.orphanFilesFailed++;
          } catch (error) {
            summary.orphanFilesFailed++;
            console.error('[File retention] Could not remove abandoned upload', error);
          }
        }
      }
      if (entries.length < 100) return;
      // Deleting while paging shifts later entries toward offset zero. Re-read
      // the same page after any deletion so older orphan files are not skipped.
      if (!deletedOnPage) offset += entries.length;
    }
  };
  try {
    await walk('');
  } catch (error) {
    summary.orphanFilesFailed++;
    console.error('[File retention] Orphan cleanup pass failed', error);
  }
  summary.completedAt = new Date().toISOString();
  return summary;
}
