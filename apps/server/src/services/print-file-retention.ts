import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabaseService } from '@inklly/db';

const RETENTION_MS = 24 * 60 * 60 * 1000;
const ORPHAN_RETENTION_MS = 48 * 60 * 60 * 1000;

function removeUpload(root: string, storageKey: string): boolean {
  if (!storageKey.startsWith('uploads/')) return false;
  const filePath = path.resolve(process.cwd(), storageKey);
  if (!filePath.startsWith(`${root}${path.sep}`)) return false;
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error('[File retention] Could not remove expired upload', error);
    return false;
  }
}

export function purgeExpiredPrintFiles(db: DatabaseService): void {
  const root = path.resolve(process.cwd(), 'uploads');
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
    if (removeUpload(root, row.storage_key)) {
      db.execute(`UPDATE order_files SET storage_key = ? WHERE id = ?`, [`expired:${row.id}`, row.id]);
    }
  }

  // Remove abandoned uploads that were never attached to an order.
  const orphanDate = Date.now() - ORPHAN_RETENTION_MS;
  const walk = (directory: string) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const storageKey = path.relative(process.cwd(), entryPath).split(path.sep).join('/');
      const referenced = db.queryOne<any>(`SELECT id FROM order_files WHERE storage_key = ? LIMIT 1`, [storageKey]);
      if (!referenced && fs.statSync(entryPath).mtimeMs <= orphanDate) {
        try { fs.unlinkSync(entryPath); } catch (error) { console.error('[File retention] Could not remove abandoned upload', error); }
      }
    }
  };
  walk(root);
}
