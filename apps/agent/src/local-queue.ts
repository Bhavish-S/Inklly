import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrintCommandTicket } from '@inklly/shared';

export interface QueuedCommand {
  commandId: string;
  jobId: string;
  attemptId: string;
  printerId: string;
  documentUrl: string;
  fileName: string;
  options: any;
  status: 'PENDING' | 'DISPATCHED_TO_SPOOLER' | 'COMPLETED' | 'OUTPUT_UNCERTAIN' | 'FAILED';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export class LocalOfflineQueue {
  private db: DatabaseSync;

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS local_commands (
        command_id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        attempt_id TEXT NOT NULL,
        printer_id TEXT NOT NULL,
        document_url TEXT NOT NULL,
        file_name TEXT NOT NULL,
        options TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_local_status ON local_commands(status);
    `);
  }

  public enqueue(ticket: PrintCommandTicket): boolean {
    const existing = this.db.prepare(`SELECT command_id FROM local_commands WHERE command_id = ?`).get(ticket.commandId);
    if (existing) return false;

    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO local_commands (
        command_id, job_id, attempt_id, printer_id, document_url, file_name, options, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).run(
      ticket.commandId,
      ticket.jobId,
      ticket.attemptId,
      ticket.printerId,
      ticket.documentUrl,
      ticket.fileName,
      JSON.stringify(ticket.options),
      now,
      now
    );
    return true;
  }

  public getNextPending(): QueuedCommand | null {
    const row = this.db.prepare(`SELECT * FROM local_commands WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT 1`).get() as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public updateStatus(commandId: string, status: QueuedCommand['status'], error?: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE local_commands SET status = ?, error_message = ?, updated_at = ? WHERE command_id = ?
    `).run(status, error || null, now, commandId);
  }

  public getQueueDepth(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM local_commands WHERE status = 'PENDING'`).get() as any;
    return row?.count || 0;
  }

  public getRecent(limit: number = 20): QueuedCommand[] {
    const rows = this.db.prepare(`SELECT * FROM local_commands ORDER BY created_at DESC LIMIT ?`).all(limit) as any[];
    return rows.map(this.mapRow);
  }

  public close(): void {
    try {
      this.db.close();
    } catch {
      // Safe no-op if already closed
    }
  }

  private mapRow(r: any): QueuedCommand {
    return {
      commandId: r.command_id,
      jobId: r.job_id,
      attemptId: r.attempt_id,
      printerId: r.printer_id,
      documentUrl: r.document_url,
      fileName: r.file_name,
      options: JSON.parse(r.options),
      status: r.status,
      errorMessage: r.error_message || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
