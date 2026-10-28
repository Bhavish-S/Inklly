import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SCHEMA_SQL } from './schema';

export class DatabaseService {
  private db: DatabaseSync | null = null;
  private pgWorker: Worker | null = null;
  private sharedBuffer: SharedArrayBuffer | null = null;
  private signalArray: Int32Array | null = null;
  private dataBytes: Uint8Array | null = null;
  private isPostgres: boolean = false;
  private static instance: DatabaseService | null = null;

  constructor(dbTarget: string = ':memory:') {
    const isPg = dbTarget.startsWith('postgres://') || dbTarget.startsWith('postgresql://');
    if (isPg) {
      this.isPostgres = true;
      this.initPostgres(dbTarget);
    } else {
      if (dbTarget !== ':memory:') {
        const dir = path.dirname(dbTarget);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
      this.db = new DatabaseSync(dbTarget);
      this.initSchema();
      this.ensureSqliteDispatchMigration();
    }
  }

  public static getInstance(dbTarget?: string): DatabaseService {
    if (!DatabaseService.instance) {
      const target = dbTarget || process.env.DATABASE_URL || ':memory:';
      DatabaseService.instance = new DatabaseService(target);
    }
    return DatabaseService.instance;
  }

  public getRawDb(): DatabaseSync {
    if (!this.db) {
      throw new Error('Raw DatabaseSync only available in SQLite mode');
    }
    return this.db;
  }

  private initSchema(): void {
    if (this.db) {
      this.db.exec(SCHEMA_SQL);
    }
  }

  private initPostgres(connectionString: string): void {
    this.sharedBuffer = new SharedArrayBuffer(16 * 1024 * 1024); // 16MB shared buffer
    this.signalArray = new Int32Array(this.sharedBuffer, 0, 4);
    this.dataBytes = new Uint8Array(this.sharedBuffer, 16);

    const possibleWorkerPaths = [
      path.join(__dirname, 'pg-worker.js'),
      path.join(__dirname, 'pg-worker.ts'),
      path.join(process.cwd(), 'packages', 'db', 'dist', 'pg-worker.js'),
      path.join('D:', 'Inkly', 'Source Code', 'packages', 'db', 'dist', 'pg-worker.js'),
    ];
    const workerFile = possibleWorkerPaths.find((p) => fs.existsSync(p)) || path.join(__dirname, 'pg-worker.js');

    this.pgWorker = new Worker(workerFile, {
      workerData: {
        sharedBuffer: this.sharedBuffer,
        connectionString,
      },
    });

    // Wait synchronously for PostgreSQL worker connection
    Atomics.wait(this.signalArray, 0, 0);
    const status = Atomics.load(this.signalArray, 0);

    if (status === 98) {
      const len = this.signalArray[1];
      const errStr = Buffer.from(this.dataBytes.buffer, 16, len).toString('utf-8');
      throw new Error(`[Inklly DB] Failed to connect to PostgreSQL: ${errStr}`);
    }

    if (status !== 99) {
      throw new Error('[Inklly DB] Unexpected worker initialization state');
    }

    // Reset status to 0 (IDLE)
    Atomics.store(this.signalArray, 0, 0);

    // Install the idempotent baseline schema on a fresh PostgreSQL database.
    // SQLite runs this from initSchema(); without this step a successful PG
    // connection still leaves every repository table missing.
    this.ensurePostgresSchema();
    console.log('[Inklly DB] Connected to Supabase PostgreSQL successfully!');
  }

  private ensurePostgresSchema(): void {
    this.queryPostgres(
      `CREATE TABLE IF NOT EXISTS inklly_schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`
    );
    const applied = this.queryPostgres<{ version: number }>(
      `SELECT version FROM inklly_schema_migrations WHERE version = ?`,
      [1]
    );
    if (applied.length === 0) {
      this.queryPostgres('BEGIN');
      try {
        for (const rawStatement of SCHEMA_SQL.split(';')) {
          const statement = rawStatement.replace(/^(?:\s*--[^\n]*(?:\n|$))+/, '').trim();
          if (!statement || /^PRAGMA\b/i.test(statement)) continue;
          this.queryPostgres(statement);
        }
        this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [1, new Date().toISOString()]);
        this.queryPostgres('COMMIT');
      } catch (error) {
        try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original migration error */ }
        throw new Error(`[Inklly DB] PostgreSQL schema installation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    this.ensurePostgresDispatchMigration();
  }

  private ensureSqliteDispatchMigration(): void {
    const versions = this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 2`).all();
    if (versions.length > 0) return;
    this.db!.exec('BEGIN');
    try {
      const columns = this.db!.prepare(`PRAGMA table_info(print_attempts)`).all() as Array<{ name: string }>;
      if (!columns.some((column) => column.name === 'dispatch_acknowledged_at')) {
        this.db!.exec(`ALTER TABLE print_attempts ADD COLUMN dispatch_acknowledged_at TEXT`);
      }
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_print_attempts_dispatch_ack ON print_attempts(status, dispatch_acknowledged_at, created_at)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (2, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original migration error */ }
      throw error;
    }
  }

  private ensurePostgresDispatchMigration(): void {
    const applied = this.queryPostgres<{ version: number }>(
      `SELECT version FROM inklly_schema_migrations WHERE version = ?`, [2]
    );
    if (applied.length > 0) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`ALTER TABLE print_attempts ADD COLUMN IF NOT EXISTS dispatch_acknowledged_at TEXT`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_print_attempts_dispatch_ack ON print_attempts(status, dispatch_acknowledged_at, created_at)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [2, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original migration error */ }
      throw new Error(`[Inklly DB] PostgreSQL dispatch migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  public execute(sql: string, params: (string | number | null)[] = []): void {
    if (this.isPostgres) {
      this.queryPostgres(sql, params);
      return;
    }
    const stmt = this.db!.prepare(sql);
    stmt.run(...params);
  }

  public query<T = unknown>(sql: string, params: (string | number | null)[] = []): T[] {
    if (this.isPostgres) {
      return this.queryPostgres<T>(sql, params);
    }
    const stmt = this.db!.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public queryOne<T = unknown>(sql: string, params: (string | number | null)[] = []): T | null {
    if (this.isPostgres) {
      const rows = this.queryPostgres<T>(sql, params);
      return rows.length > 0 ? rows[0] : null;
    }
    const stmt = this.db!.prepare(sql);
    const result = stmt.get(...params);
    return (result as T) || null;
  }

  public transaction<T>(callback: () => T): T {
    this.execute('BEGIN;');
    try {
      const result = callback();
      this.execute('COMMIT;');
      return result;
    } catch (err) {
      this.execute('ROLLBACK;');
      throw err;
    }
  }

  private queryPostgres<T = unknown>(sql: string, params: (string | number | null)[] = []): T[] {
    if (!this.pgWorker || !this.signalArray || !this.dataBytes) {
      throw new Error('PostgreSQL worker bridge is not initialized');
    }

    const payload = JSON.stringify({ sql, params });
    const encoded = Buffer.from(payload, 'utf-8');
    if (encoded.length > this.dataBytes.length) {
      throw new Error('Query payload exceeds maximum 16MB buffer size');
    }

    this.signalArray[1] = encoded.length;
    this.dataBytes.set(encoded, 0);

    // Signal worker: status = 1 (BUSY)
    Atomics.store(this.signalArray, 0, 1);
    this.pgWorker.postMessage('EXECUTE');

    // Wait synchronously for worker to complete
    Atomics.wait(this.signalArray, 0, 1);

    const status = Atomics.load(this.signalArray, 0);
    const len = this.signalArray[1];
    const resString = Buffer.from(this.dataBytes.buffer, 16, len).toString('utf-8');

    // Reset status to 0 (IDLE)
    Atomics.store(this.signalArray, 0, 0);

    if (status === 3) {
      throw new Error(`[Supabase PostgreSQL Query Error] ${resString}`);
    }

    try {
      return JSON.parse(resString) as T[];
    } catch {
      return [] as T[];
    }
  }

  public close(): void {
    if (this.db) {
      this.db.close();
    }
    if (this.pgWorker) {
      this.pgWorker.terminate();
    }
  }
}
