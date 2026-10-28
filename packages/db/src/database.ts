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
      this.ensureSqliteMerchantVaultMigration();
      this.ensureSqliteAgentPrinterMigration();
      this.ensureSqliteAccountInvitationMigration();
      this.ensureSqliteLegacyInvitationRename();
      this.ensureSqlitePortalOrderIdempotencyMigration();
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

  public getEngineName(): string {
    return this.isPostgres ? 'PostgreSQL' : 'SQLite';
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
    this.ensurePostgresMerchantVaultMigration();
    this.ensurePostgresAgentPrinterMigration();
    this.ensurePostgresAccountInvitationMigration();
    this.ensurePostgresLegacyInvitationRename();
    this.ensurePostgresPortalOrderIdempotencyMigration();
  }

  private ensureSqlitePortalOrderIdempotencyMigration(): void {
    const applied = this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 7`).get();
    if (applied) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TABLE IF NOT EXISTS portal_order_idempotency (
        shop_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL,
        order_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
        PRIMARY KEY (shop_id, idempotency_key),
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_portal_order_idempotency_created ON portal_order_idempotency(created_at)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (7, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original migration error */ }
      throw error;
    }
  }

  private ensurePostgresPortalOrderIdempotencyMigration(): void {
    const applied = this.queryPostgres<{ version: number }>(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [7]);
    if (applied.length > 0) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS portal_order_idempotency (
        shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL,
        order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL, PRIMARY KEY (shop_id, idempotency_key)
      )`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_portal_order_idempotency_created ON portal_order_idempotency(created_at)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [7, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original migration error */ }
      throw new Error(`[Inklly DB] Portal order idempotency migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
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

  private ensureSqliteMerchantVaultMigration(): void {
    const applied = this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 3`).get();
    if (applied) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(MERCHANT_VAULT_SCHEMA_SQL);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (3, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original migration error */ }
      throw error;
    }
  }

  private ensurePostgresMerchantVaultMigration(): void {
    const applied = this.queryPostgres<{ version: number }>(
      `SELECT version FROM inklly_schema_migrations WHERE version = ?`, [3]
    );
    if (applied.length > 0) return;
    this.queryPostgres('BEGIN');
    try {
      for (const statement of MERCHANT_VAULT_SCHEMA_SQL.split(';').map((sql) => sql.trim()).filter(Boolean)) {
        this.queryPostgres(statement);
      }
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [3, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original migration error */ }
      throw new Error(`[Inklly DB] PostgreSQL merchant vault migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteAgentPrinterMigration(): void {
    const applied = this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 4`).get();
    if (applied) return;
    this.db!.exec('BEGIN');
    try {
      const columns = this.db!.prepare(`PRAGMA table_info(printers)`).all() as Array<{ name: string }>;
      if (!columns.some((column) => column.name === 'agent_id')) this.db!.exec(`ALTER TABLE printers ADD COLUMN agent_id TEXT`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_printers_agent ON printers(agent_id, shop_id, is_online)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (4, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original migration error */ }
      throw error;
    }
  }

  private ensurePostgresAgentPrinterMigration(): void {
    const applied = this.queryPostgres<{ version: number }>(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [4]);
    if (applied.length > 0) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`ALTER TABLE printers ADD COLUMN IF NOT EXISTS agent_id TEXT`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_printers_agent ON printers(agent_id, shop_id, is_online)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [4, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original migration error */ }
      throw new Error(`[Inklly DB] PostgreSQL agent printer migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteAccountInvitationMigration(): void {
    const applied = this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 5`).get();
    if (applied) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TABLE IF NOT EXISTS account_invitations (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        shop_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        accepted_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
      )`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_account_invitations_expiry ON account_invitations(expires_at, accepted_at)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (5, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original migration error */ }
      throw error;
    }
  }

  private ensurePostgresAccountInvitationMigration(): void {
    const applied = this.queryPostgres<{ version: number }>(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [5]);
    if (applied.length > 0) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS account_invitations (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        accepted_at TEXT,
        created_at TEXT NOT NULL
      )`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_account_invitations_expiry ON account_invitations(expires_at, accepted_at)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [5, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original migration error */ }
      throw new Error(`[Inklly DB] PostgreSQL platform invitation migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  // Version 5 was not released, but local databases may have applied the
  // earlier platform_invitations name. Preserve those invitations while
  // converging every driver on the semantically correct shared table name.
  private ensureSqliteLegacyInvitationRename(): void {
    const applied = this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 6`).get();
    if (applied) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TABLE IF NOT EXISTS account_invitations (
        id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL, shop_id TEXT NOT NULL, expires_at TEXT NOT NULL,
        accepted_at TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
      )`);
      const legacy = this.db!.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'platform_invitations'`).get();
      if (legacy) {
        this.db!.exec(`INSERT INTO account_invitations (id, token_hash, user_id, organization_id, shop_id, expires_at, accepted_at, created_at)
          SELECT id, token_hash, user_id, organization_id, shop_id, expires_at, accepted_at, created_at FROM platform_invitations WHERE 1
          ON CONFLICT DO NOTHING`);
        this.db!.exec(`DROP TABLE platform_invitations`);
      }
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_account_invitations_expiry ON account_invitations(expires_at, accepted_at)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (6, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original migration error */ }
      throw error;
    }
  }

  private ensurePostgresLegacyInvitationRename(): void {
    const applied = this.queryPostgres<{ version: number }>(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [6]);
    if (applied.length > 0) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS account_invitations (
        id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE, expires_at TEXT NOT NULL,
        accepted_at TEXT, created_at TEXT NOT NULL
      )`);
      const legacy = this.queryPostgres<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'platform_invitations'`
      );
      if (legacy.length > 0) {
        this.queryPostgres(`INSERT INTO account_invitations (id, token_hash, user_id, organization_id, shop_id, expires_at, accepted_at, created_at)
          SELECT id, token_hash, user_id, organization_id, shop_id, expires_at, accepted_at, created_at FROM platform_invitations
          ON CONFLICT DO NOTHING`);
        this.queryPostgres(`DROP TABLE platform_invitations`);
      }
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_account_invitations_expiry ON account_invitations(expires_at, accepted_at)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [6, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original migration error */ }
      throw new Error(`[Inklly DB] PostgreSQL invitation table rename migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
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

const MERCHANT_VAULT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS storage_categories (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  document_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (shop_id, id),
  UNIQUE (shop_id, name),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_storage_categories_shop ON storage_categories(shop_id, created_at);
CREATE TABLE IF NOT EXISTS storage_documents (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  category_id TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 1,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id, category_id) REFERENCES storage_categories(shop_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_storage_documents_shop_created ON storage_documents(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_storage_documents_category ON storage_documents(category_id);
`;
