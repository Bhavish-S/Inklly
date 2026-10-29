import { DatabaseService } from './database';
import * as crypto from 'node:crypto';

const PURGE_CLAIM_MS = 5 * 60 * 1000;

export class PrintFileUnavailableError extends Error {
  readonly code = 'PRINT_FILE_UNAVAILABLE';

  constructor() {
    super('A print file is being deleted or has expired. Upload it again before placing this order.');
    this.name = 'PrintFileUnavailableError';
  }
}

/** Must be called inside a transaction; the update locks the same row used by retention. */
export function lockAvailablePrintFiles(db: DatabaseService, storageKeys: string[], now = new Date().toISOString()): void {
  for (const storageKey of [...new Set(storageKeys.filter(Boolean))].sort()) {
    db.execute(
      `INSERT INTO print_file_lifecycle (storage_key, status, updated_at) VALUES (?, 'AVAILABLE', ?)
       ON CONFLICT (storage_key) DO NOTHING`,
      [storageKey, now]
    );
    // A no-op update obtains a row lock in PostgreSQL and a write lock in SQLite.
    db.execute(`UPDATE print_file_lifecycle SET updated_at = updated_at WHERE storage_key = ?`, [storageKey]);
    const lifecycle = db.queryOne<{ status: string }>(`SELECT status FROM print_file_lifecycle WHERE storage_key = ?`, [storageKey]);
    if (!lifecycle || lifecycle.status !== 'AVAILABLE') throw new PrintFileUnavailableError();
  }
}

/** Claims a key before asynchronous object-store deletion. */
export function claimPrintFileForPurge(db: DatabaseService, storageKey: string, stillReferenced: () => boolean): string | null {
  return db.transaction(() => {
    db.execute(
      `INSERT INTO print_file_lifecycle (storage_key, status, updated_at) VALUES (?, 'AVAILABLE', ?)
       ON CONFLICT (storage_key) DO NOTHING`,
      [storageKey, new Date().toISOString()]
    );
    db.execute(`UPDATE print_file_lifecycle SET updated_at = updated_at WHERE storage_key = ?`, [storageKey]);
    const lifecycle = db.queryOne<{ status: string; purging_until: string | null }>(`SELECT status, purging_until FROM print_file_lifecycle WHERE storage_key = ?`, [storageKey]);
    const now = new Date();
    if (!lifecycle) return null;
    const staleClaim = lifecycle.status === 'PURGING' && lifecycle.purging_until !== null && Date.parse(lifecycle.purging_until) <= now.getTime();
    if ((lifecycle.status !== 'AVAILABLE' && !staleClaim) || stillReferenced()) return null;
    const claimToken = crypto.randomUUID();
    db.execute(
      `UPDATE print_file_lifecycle SET status = 'PURGING', claim_token = ?, purging_until = ?, updated_at = ? WHERE storage_key = ?`,
      [claimToken, new Date(now.getTime() + PURGE_CLAIM_MS).toISOString(), now.toISOString(), storageKey]
    );
    return claimToken;
  });
}

export function finishPrintFilePurge(db: DatabaseService, storageKey: string, claimToken: string, deleted: boolean): void {
  db.execute(
    `UPDATE print_file_lifecycle SET status = ?, claim_token = NULL, purging_until = NULL, updated_at = ?
     WHERE storage_key = ? AND status = 'PURGING' AND claim_token = ?`,
    [deleted ? 'DELETED' : 'AVAILABLE', new Date().toISOString(), storageKey, claimToken]
  );
}
