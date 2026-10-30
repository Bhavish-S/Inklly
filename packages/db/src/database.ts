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
  private transactionDepth = 0;
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
      this.ensureSqliteDeveloperKeyScopeMigration();
      this.ensureSqliteLedgerAppendOnlyMigration();
      this.ensureSqliteLedgerIdempotencyMigration();
      this.ensureSqliteSubscriptionUsageMigration();
      this.ensureSqliteRateRuleUniquenessMigration();
      this.ensureSqliteOrderPricingSnapshotMigration();
      this.ensureSqliteWebhookOutboxMigration();
      this.ensureSqlitePilotBillingMigration();
      this.ensureSqlitePlatformAdminPermissionsMigration();
      this.ensureSqlitePrintFileLifecycleMigration();
      this.ensureSqliteShopPortalSettingsMigration();
      this.ensureSqliteMembershipLifecycleMigration();
      this.ensureSqlitePublicUploadRateLimitMigration();
      this.ensureSqlitePlatformIncidentMigration();
      this.ensureSqlitePlatformSubscriptionBillingMigration();
      this.ensureSqliteCopyDiscountUniquenessMigration();
      this.ensureSqliteAgentPrintReadinessMigration();
      this.ensureSqliteMerchantVaultDeletionMigration();
      this.ensureSqliteAgentFleetIndexesMigration();
      this.ensureSqliteOrganizationDirectoryMigration();
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
    this.ensurePostgresDeveloperKeyScopeMigration();
    this.ensurePostgresLedgerAppendOnlyMigration();
    this.ensurePostgresLedgerIdempotencyMigration();
    this.ensurePostgresSubscriptionUsageMigration();
    this.ensurePostgresRateRuleUniquenessMigration();
    this.ensurePostgresOrderPricingSnapshotMigration();
    this.ensurePostgresWebhookOutboxMigration();
    this.ensurePostgresPilotBillingMigration();
    this.ensurePostgresPlatformAdminPermissionsMigration();
    this.ensurePostgresPrintFileLifecycleMigration();
    this.ensurePostgresShopPortalSettingsMigration();
    this.ensurePostgresMembershipLifecycleMigration();
    this.ensurePostgresPublicUploadRateLimitMigration();
    this.ensurePostgresPlatformIncidentMigration();
    this.ensurePostgresPlatformSubscriptionBillingMigration();
    this.ensurePostgresCopyDiscountUniquenessMigration();
    this.ensurePostgresAgentPrintReadinessMigration();
    this.ensurePostgresMerchantVaultDeletionMigration();
    this.ensurePostgresAgentFleetIndexesMigration();
    this.ensurePostgresOrganizationDirectoryMigration();
  }

  private ensureSqliteOrganizationDirectoryMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 27`).get()) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_organizations_created ON organizations(created_at DESC, id DESC)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (27, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] Organization directory migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensurePostgresOrganizationDirectoryMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [27]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_organizations_created ON organizations(created_at DESC, id DESC)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [27, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] PostgreSQL organization directory migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteAgentFleetIndexesMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 26`).get()) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_printers_agent_online ON printers(agent_id, is_online)`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_print_attempts_agent_status ON print_attempts(agent_id, status)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (26, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] Agent fleet index migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensurePostgresAgentFleetIndexesMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [26]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_printers_agent_online ON printers(agent_id, is_online)`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_print_attempts_agent_status ON print_attempts(agent_id, status)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [26, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] PostgreSQL agent fleet index migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteAgentPrintReadinessMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 24`).get()) return;
    this.db!.exec('BEGIN');
    try {
      const columns = this.db!.prepare(`PRAGMA table_info(agent_registrations)`).all() as Array<{ name: string }>;
      if (!columns.some((column) => column.name === 'physical_printing_enabled')) {
        this.db!.exec(`ALTER TABLE agent_registrations ADD COLUMN physical_printing_enabled INTEGER NOT NULL DEFAULT 0`);
      }
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (24, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] Agent print-readiness migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensurePostgresAgentPrintReadinessMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [24]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`ALTER TABLE agent_registrations ADD COLUMN IF NOT EXISTS physical_printing_enabled INTEGER NOT NULL DEFAULT 0`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [24, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] PostgreSQL agent print-readiness migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteMerchantVaultDeletionMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 25`).get()) return;
    this.db!.exec('BEGIN');
    try {
      const columns = this.db!.prepare(`PRAGMA table_info(storage_documents)`).all() as Array<{ name: string }>;
      if (!columns.some((column) => column.name === 'deletion_requested_at')) {
        this.db!.exec(`ALTER TABLE storage_documents ADD COLUMN deletion_requested_at TEXT`);
      }
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (25, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] Merchant vault deletion migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensurePostgresMerchantVaultDeletionMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [25]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`ALTER TABLE storage_documents ADD COLUMN IF NOT EXISTS deletion_requested_at TEXT`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [25, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] PostgreSQL merchant vault deletion migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteCopyDiscountUniquenessMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 23`).get()) return;
    const duplicate = this.db!.prepare(`SELECT shop_id, paper_size, color_mode, duplex_mode FROM copy_discount_rules
      GROUP BY shop_id, paper_size, color_mode, duplex_mode HAVING COUNT(*) > 1 LIMIT 1`).get();
    if (duplicate) throw new Error('[Inklly DB] Duplicate copy-discount keys exist; reconcile conflicting prices before enabling unique copy-discount rules.');
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_copy_discount_rules_unique
        ON copy_discount_rules(shop_id, paper_size, color_mode, duplex_mode)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (23, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] Copy-discount uniqueness migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensurePostgresCopyDiscountUniquenessMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [23]).length) return;
    const duplicate = this.queryPostgres(`SELECT shop_id, paper_size, color_mode, duplex_mode FROM copy_discount_rules
      GROUP BY shop_id, paper_size, color_mode, duplex_mode HAVING COUNT(*) > 1 LIMIT 1`);
    if (duplicate.length) throw new Error('[Inklly DB] Duplicate copy-discount keys exist; reconcile conflicting prices before enabling unique copy-discount rules.');
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE UNIQUE INDEX IF NOT EXISTS idx_copy_discount_rules_unique
        ON copy_discount_rules(shop_id, paper_size, color_mode, duplex_mode)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [23, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] PostgreSQL copy-discount uniqueness migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqlitePlatformSubscriptionBillingMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 22`).get()) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TABLE IF NOT EXISTS platform_subscription_payment_attempts (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        idempotency_key TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        plan_tier TEXT NOT NULL,
        tariff_id TEXT NOT NULL REFERENCES subscription_billing_tariffs(id) ON DELETE RESTRICT,
        amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
        currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'RAZORPAY' CHECK (provider = 'RAZORPAY'),
        provider_order_id TEXT UNIQUE,
        provider_payment_id TEXT UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('CREATING', 'PENDING', 'VERIFIED', 'FAILED', 'CREATE_UNCERTAIN', 'RECONCILIATION_REQUIRED')),
        failure_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        captured_at TEXT,
        UNIQUE (organization_id, idempotency_key),
        CHECK (period_end > period_start)
      )`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_platform_subscription_attempt_org ON platform_subscription_payment_attempts(organization_id, created_at DESC)`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_platform_subscription_attempt_status ON platform_subscription_payment_attempts(status, updated_at)`);
      this.db!.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_billing_one_open_attempt_per_org
        ON platform_subscription_payment_attempts(organization_id)
        WHERE status IN ('CREATING', 'PENDING', 'CREATE_UNCERTAIN', 'RECONCILIATION_REQUIRED')`);
      this.db!.exec(`CREATE TABLE IF NOT EXISTS platform_subscription_payment_events (
        id TEXT PRIMARY KEY,
        provider_event_id TEXT NOT NULL UNIQUE,
        billing_attempt_id TEXT REFERENCES platform_subscription_payment_attempts(id) ON DELETE RESTRICT,
        event_type TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('APPLIED', 'DUPLICATE_PAYMENT', 'IGNORED', 'REJECTED')),
        provider_order_id TEXT,
        provider_payment_id TEXT,
        amount_paise INTEGER,
        currency TEXT,
        payload_sha256 TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_platform_subscription_events_attempt ON platform_subscription_payment_events(billing_attempt_id, created_at)`);
      this.db!.exec(`CREATE TRIGGER IF NOT EXISTS platform_subscription_payment_events_prevent_update BEFORE UPDATE ON platform_subscription_payment_events BEGIN SELECT RAISE(ABORT, 'platform_subscription_payment_events are append-only'); END`);
      this.db!.exec(`CREATE TRIGGER IF NOT EXISTS platform_subscription_payment_events_prevent_delete BEFORE DELETE ON platform_subscription_payment_events BEGIN SELECT RAISE(ABORT, 'platform_subscription_payment_events are append-only'); END`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (22, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] Platform subscription billing migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensurePostgresPlatformSubscriptionBillingMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [22]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS platform_subscription_payment_attempts (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        idempotency_key TEXT NOT NULL,
        request_fingerprint TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        plan_tier TEXT NOT NULL,
        tariff_id TEXT NOT NULL REFERENCES subscription_billing_tariffs(id) ON DELETE RESTRICT,
        amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
        currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'RAZORPAY' CHECK (provider = 'RAZORPAY'),
        provider_order_id TEXT UNIQUE,
        provider_payment_id TEXT UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('CREATING', 'PENDING', 'VERIFIED', 'FAILED', 'CREATE_UNCERTAIN', 'RECONCILIATION_REQUIRED')),
        failure_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        captured_at TEXT,
        UNIQUE (organization_id, idempotency_key),
        CHECK (period_end > period_start)
      )`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_platform_subscription_attempt_org ON platform_subscription_payment_attempts(organization_id, created_at DESC)`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_platform_subscription_attempt_status ON platform_subscription_payment_attempts(status, updated_at)`);
      this.queryPostgres(`CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_billing_one_open_attempt_per_org
        ON platform_subscription_payment_attempts(organization_id)
        WHERE status IN ('CREATING', 'PENDING', 'CREATE_UNCERTAIN', 'RECONCILIATION_REQUIRED')`);
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS platform_subscription_payment_events (
        id TEXT PRIMARY KEY,
        provider_event_id TEXT NOT NULL UNIQUE,
        billing_attempt_id TEXT REFERENCES platform_subscription_payment_attempts(id) ON DELETE RESTRICT,
        event_type TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('APPLIED', 'DUPLICATE_PAYMENT', 'IGNORED', 'REJECTED')),
        provider_order_id TEXT,
        provider_payment_id TEXT,
        amount_paise BIGINT,
        currency TEXT,
        payload_sha256 TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_platform_subscription_events_attempt ON platform_subscription_payment_events(billing_attempt_id, created_at)`);
      this.queryPostgres(`CREATE OR REPLACE FUNCTION prevent_platform_subscription_payment_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'platform_subscription_payment_events are append-only'; END; $$`);
      this.queryPostgres(`DROP TRIGGER IF EXISTS platform_subscription_payment_events_immutable ON platform_subscription_payment_events`);
      this.queryPostgres(`CREATE TRIGGER platform_subscription_payment_events_immutable BEFORE UPDATE OR DELETE ON platform_subscription_payment_events FOR EACH ROW EXECUTE FUNCTION prevent_platform_subscription_payment_event_mutation()`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [22, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] PostgreSQL platform subscription billing migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqlitePlatformIncidentMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 21`).get()) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TABLE IF NOT EXISTS platform_incidents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED')),
        organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
        shop_id TEXT REFERENCES shops(id) ON DELETE SET NULL,
        order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
        agent_id TEXT REFERENCES agent_registrations(id) ON DELETE SET NULL,
        assigned_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        resolution_notes TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TEXT,
        closed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_platform_incidents_created ON platform_incidents(created_at DESC, id DESC)`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_platform_incidents_status ON platform_incidents(status, created_at DESC, id DESC)`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_platform_incidents_org ON platform_incidents(organization_id, created_at DESC, id DESC)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (21, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] Platform incident migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensurePostgresPlatformIncidentMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [21]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS platform_incidents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED')),
        organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
        shop_id TEXT REFERENCES shops(id) ON DELETE SET NULL,
        order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
        agent_id TEXT REFERENCES agent_registrations(id) ON DELETE SET NULL,
        assigned_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        resolution_notes TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TEXT,
        closed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_platform_incidents_created ON platform_incidents(created_at DESC, id DESC)`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_platform_incidents_status ON platform_incidents(status, created_at DESC, id DESC)`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_platform_incidents_org ON platform_incidents(organization_id, created_at DESC, id DESC)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [21, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original error */ }
      throw new Error(`[Inklly DB] Platform incident migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteMembershipLifecycleMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 19`).get()) return;
    this.db!.exec('BEGIN');
    try {
      const columns = this.db!.prepare(`PRAGMA table_info(memberships)`).all() as Array<{ name: string }>;
      if (!columns.some((column) => column.name === 'is_active')) {
        this.db!.exec(`ALTER TABLE memberships ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`);
      }
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (19, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve original error */ }
      throw error;
    }
  }

  private ensurePostgresMembershipLifecycleMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [19]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [19, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original error */ }
      throw new Error(`[Inklly DB] Staff membership lifecycle migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqlitePublicUploadRateLimitMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 20`).get()) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TABLE IF NOT EXISTS public_upload_rate_limits (
        bucket_key TEXT NOT NULL,
        window_start_ms INTEGER NOT NULL,
        request_count INTEGER NOT NULL,
        expires_at_ms INTEGER NOT NULL,
        PRIMARY KEY (bucket_key, window_start_ms)
      )`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_public_upload_rate_limits_expiry ON public_upload_rate_limits(expires_at_ms)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (20, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw error;
    }
  }

  private ensurePostgresPublicUploadRateLimitMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [20]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS public_upload_rate_limits (
        bucket_key TEXT NOT NULL,
        window_start_ms BIGINT NOT NULL,
        request_count INTEGER NOT NULL,
        expires_at_ms BIGINT NOT NULL,
        PRIMARY KEY (bucket_key, window_start_ms)
      )`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_public_upload_rate_limits_expiry ON public_upload_rate_limits(expires_at_ms)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [20, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve the original error */ }
      throw new Error(`[Inklly DB] Public upload rate-limit migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteShopPortalSettingsMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 18`).get()) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TABLE IF NOT EXISTS shop_portal_settings (shop_id TEXT PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE, settings_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (18, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve original error */ }
      throw error;
    }
  }

  private ensurePostgresShopPortalSettingsMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [18]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS shop_portal_settings (shop_id TEXT PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE, settings_json TEXT NOT NULL, updated_at TEXT NOT NULL)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [18, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original error */ }
      throw new Error(`[Inklly DB] Shop portal settings migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqlitePrintFileLifecycleMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 17`).get()) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TABLE IF NOT EXISTS print_file_lifecycle (
        storage_key TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'PURGING', 'DELETED')),
        claim_token TEXT,
        purging_until TEXT,
        updated_at TEXT NOT NULL
      )`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (17, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve original error */ }
      throw error;
    }
  }

  private ensurePostgresPrintFileLifecycleMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [17]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS print_file_lifecycle (
        storage_key TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'PURGING', 'DELETED')),
        claim_token TEXT,
        purging_until TEXT,
        updated_at TEXT NOT NULL
      )`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [17, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original error */ }
      throw new Error(`[Inklly DB] Print file lifecycle migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteSubscriptionUsageMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 11`).get()) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TABLE IF NOT EXISTS subscription_usage_events (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, shop_id TEXT NOT NULL,
        order_id TEXT NOT NULL UNIQUE, confirmed_sides INTEGER NOT NULL CHECK (confirmed_sides > 0),
        confirmation_source TEXT NOT NULL DEFAULT 'OPERATOR_PHYSICAL_INSPECTION', created_at TEXT NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_subscription_usage_org_created ON subscription_usage_events(organization_id, created_at)`);
      this.db!.exec(`CREATE TRIGGER IF NOT EXISTS subscription_usage_prevent_update BEFORE UPDATE ON subscription_usage_events BEGIN SELECT RAISE(ABORT, 'subscription_usage_events are append-only'); END`);
      this.db!.exec(`CREATE TRIGGER IF NOT EXISTS subscription_usage_prevent_delete BEFORE DELETE ON subscription_usage_events BEGIN SELECT RAISE(ABORT, 'subscription_usage_events are append-only'); END`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (11, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve original error */ }
      throw error;
    }
  }

  private ensurePostgresSubscriptionUsageMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [11]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS subscription_usage_events (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
        confirmed_sides INTEGER NOT NULL CHECK (confirmed_sides > 0),
        confirmation_source TEXT NOT NULL DEFAULT 'OPERATOR_PHYSICAL_INSPECTION', created_at TEXT NOT NULL
      )`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_subscription_usage_org_created ON subscription_usage_events(organization_id, created_at)`);
      this.queryPostgres(`CREATE OR REPLACE FUNCTION prevent_subscription_usage_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'subscription_usage_events are append-only'; END; $$`);
      this.queryPostgres(`DROP TRIGGER IF EXISTS subscription_usage_prevent_mutation ON subscription_usage_events`);
      this.queryPostgres(`CREATE TRIGGER subscription_usage_prevent_mutation BEFORE UPDATE OR DELETE ON subscription_usage_events FOR EACH ROW EXECUTE FUNCTION prevent_subscription_usage_event_mutation()`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [11, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original error */ }
      throw new Error(`[Inklly DB] Subscription usage migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteRateRuleUniquenessMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 12`).get()) return;
    this.db!.exec('BEGIN');
    try {
      const duplicate = this.db!.prepare(`SELECT shop_id FROM rate_rules WHERE printer_id IS NULL
        GROUP BY shop_id, paper_size, color_mode, duplex_mode HAVING COUNT(*) > 1 LIMIT 1`).get()
        || this.db!.prepare(`SELECT shop_id FROM rate_rules WHERE printer_id IS NOT NULL
          GROUP BY shop_id, printer_id, paper_size, color_mode, duplex_mode HAVING COUNT(*) > 1 LIMIT 1`).get();
      if (duplicate) throw new Error('Duplicate rate-rule keys exist; reconcile conflicting prices before enabling unique rate keys.');
      this.db!.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_rules_default_unique
        ON rate_rules(shop_id, paper_size, color_mode, duplex_mode) WHERE printer_id IS NULL`);
      this.db!.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_rules_printer_unique
        ON rate_rules(shop_id, printer_id, paper_size, color_mode, duplex_mode) WHERE printer_id IS NOT NULL`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (12, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve original error */ }
      throw error;
    }
  }

  private ensurePostgresRateRuleUniquenessMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [12]).length) return;
    this.queryPostgres('BEGIN');
    try {
      const duplicate = this.queryPostgres<any>(`SELECT shop_id FROM rate_rules WHERE printer_id IS NULL
        GROUP BY shop_id, paper_size, color_mode, duplex_mode HAVING COUNT(*) > 1 LIMIT 1`)[0]
        || this.queryPostgres<any>(`SELECT shop_id FROM rate_rules WHERE printer_id IS NOT NULL
          GROUP BY shop_id, printer_id, paper_size, color_mode, duplex_mode HAVING COUNT(*) > 1 LIMIT 1`)[0];
      if (duplicate) throw new Error('Duplicate rate-rule keys exist; reconcile conflicting prices before enabling unique rate keys.');
      this.queryPostgres(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_rules_default_unique
        ON rate_rules(shop_id, paper_size, color_mode, duplex_mode) WHERE printer_id IS NULL`);
      this.queryPostgres(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_rules_printer_unique
        ON rate_rules(shop_id, printer_id, paper_size, color_mode, duplex_mode) WHERE printer_id IS NOT NULL`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [12, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original error */ }
      throw new Error(`[Inklly DB] Rate-rule uniqueness migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteOrderPricingSnapshotMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 13`).get()) return;
    this.db!.exec('BEGIN');
    try {
      const columns = this.db!.prepare(`PRAGMA table_info(orders)`).all() as Array<{ name: string }>;
      if (!columns.some((column) => column.name === 'pricing_snapshot')) this.db!.exec(`ALTER TABLE orders ADD COLUMN pricing_snapshot TEXT`);
      this.db!.exec(`CREATE TRIGGER IF NOT EXISTS orders_pricing_snapshot_immutable
        BEFORE UPDATE OF pricing_snapshot ON orders
        WHEN OLD.pricing_snapshot IS NOT NULL AND NEW.pricing_snapshot IS NOT OLD.pricing_snapshot
        BEGIN SELECT RAISE(ABORT, 'accepted order pricing snapshots are immutable'); END`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (13, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve original error */ }
      throw error;
    }
  }

  private ensurePostgresOrderPricingSnapshotMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [13]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pricing_snapshot TEXT`);
      this.queryPostgres(`CREATE OR REPLACE FUNCTION prevent_order_pricing_snapshot_mutation() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF OLD.pricing_snapshot IS NOT NULL AND NEW.pricing_snapshot IS DISTINCT FROM OLD.pricing_snapshot THEN
            RAISE EXCEPTION 'accepted order pricing snapshots are immutable';
          END IF;
          RETURN NEW;
        END; $$`);
      this.queryPostgres(`DROP TRIGGER IF EXISTS orders_pricing_snapshot_immutable ON orders`);
      this.queryPostgres(`CREATE TRIGGER orders_pricing_snapshot_immutable BEFORE UPDATE OF pricing_snapshot ON orders
        FOR EACH ROW EXECUTE FUNCTION prevent_order_pricing_snapshot_mutation()`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [13, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original error */ }
      throw new Error(`[Inklly DB] Order pricing snapshot migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteWebhookOutboxMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 14`).get()) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, event_type TEXT NOT NULL,
        idempotency_key TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        UNIQUE (organization_id, idempotency_key)
      )`);
      this.db!.exec(`CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, subscription_id TEXT NOT NULL,
        event_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', attempt_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT NOT NULL, lease_until TEXT, last_status_code INTEGER, last_error TEXT,
        delivered_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (subscription_id) REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
        FOREIGN KEY (event_id) REFERENCES webhook_events(id) ON DELETE CASCADE,
        UNIQUE (subscription_id, event_id)
      )`);
      this.db!.exec(`CREATE TABLE IF NOT EXISTS webhook_delivery_attempts (
        id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL, attempt_number INTEGER NOT NULL,
        status_code INTEGER, error TEXT, started_at TEXT NOT NULL, completed_at TEXT,
        FOREIGN KEY (delivery_id) REFERENCES webhook_deliveries(id) ON DELETE CASCADE,
        UNIQUE (delivery_id, attempt_number)
      )`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due ON webhook_deliveries(status, next_attempt_at, lease_until)`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org_created ON webhook_deliveries(organization_id, created_at)`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_delivery_attempts_delivery ON webhook_delivery_attempts(delivery_id, attempt_number)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (14, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve original error */ }
      throw error;
    }
  }

  private ensurePostgresWebhookOutboxMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [14]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL, idempotency_key TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE (organization_id, idempotency_key)
      )`);
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        subscription_id TEXT NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'PENDING', attempt_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT NOT NULL, lease_until TEXT, last_status_code INTEGER, last_error TEXT,
        delivered_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE (subscription_id, event_id)
      )`);
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS webhook_delivery_attempts (
        id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL REFERENCES webhook_deliveries(id) ON DELETE CASCADE,
        attempt_number INTEGER NOT NULL, status_code INTEGER, error TEXT,
        started_at TEXT NOT NULL, completed_at TEXT, UNIQUE (delivery_id, attempt_number)
      )`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due ON webhook_deliveries(status, next_attempt_at, lease_until)`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org_created ON webhook_deliveries(organization_id, created_at)`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_webhook_delivery_attempts_delivery ON webhook_delivery_attempts(delivery_id, attempt_number)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [14, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original error */ }
      throw new Error(`[Inklly DB] Webhook outbox migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqlitePilotBillingMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 15`).get()) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TABLE IF NOT EXISTS subscription_billing_tariffs (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL,
        monthly_base_paise INTEGER NOT NULL CHECK (monthly_base_paise >= 0),
        per_side_paise INTEGER NOT NULL CHECK (per_side_paise >= 0),
        included_sides INTEGER NOT NULL DEFAULT 0 CHECK (included_sides >= 0),
        currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
        effective_from TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE (organization_id, effective_from),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
      )`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_billing_tariffs_org_effective ON subscription_billing_tariffs(organization_id, effective_from DESC)`);
      this.db!.exec(`CREATE TABLE IF NOT EXISTS subscription_invoices (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL,
        tariff_id TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
        monthly_base_paise INTEGER NOT NULL CHECK (monthly_base_paise >= 0), included_sides INTEGER NOT NULL CHECK (included_sides >= 0),
        confirmed_sides INTEGER NOT NULL CHECK (confirmed_sides >= 0), billable_sides INTEGER NOT NULL CHECK (billable_sides >= 0),
        per_side_paise INTEGER NOT NULL CHECK (per_side_paise >= 0), usage_fee_paise INTEGER NOT NULL CHECK (usage_fee_paise >= 0),
        total_paise INTEGER NOT NULL CHECK (total_paise >= 0), line_items_json TEXT NOT NULL, issued_by TEXT NOT NULL, issued_at TEXT NOT NULL,
        UNIQUE (organization_id, period_start, period_end),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (tariff_id) REFERENCES subscription_billing_tariffs(id)
      )`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_subscription_invoices_org_period ON subscription_invoices(organization_id, period_start DESC)`);
      this.db!.exec(`CREATE TRIGGER IF NOT EXISTS subscription_billing_tariffs_prevent_update BEFORE UPDATE ON subscription_billing_tariffs BEGIN SELECT RAISE(ABORT, 'subscription_billing_tariffs are append-only'); END`);
      this.db!.exec(`CREATE TRIGGER IF NOT EXISTS subscription_billing_tariffs_prevent_delete BEFORE DELETE ON subscription_billing_tariffs BEGIN SELECT RAISE(ABORT, 'subscription_billing_tariffs are append-only'); END`);
      this.db!.exec(`CREATE TRIGGER IF NOT EXISTS subscription_invoices_prevent_update BEFORE UPDATE ON subscription_invoices BEGIN SELECT RAISE(ABORT, 'subscription_invoices are append-only'); END`);
      this.db!.exec(`CREATE TRIGGER IF NOT EXISTS subscription_invoices_prevent_delete BEFORE DELETE ON subscription_invoices BEGIN SELECT RAISE(ABORT, 'subscription_invoices are append-only'); END`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (15, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve original error */ }
      throw error;
    }
  }

  private ensurePostgresPilotBillingMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [15]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS subscription_billing_tariffs (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        monthly_base_paise INTEGER NOT NULL CHECK (monthly_base_paise >= 0), per_side_paise INTEGER NOT NULL CHECK (per_side_paise >= 0),
        included_sides INTEGER NOT NULL DEFAULT 0 CHECK (included_sides >= 0), currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
        effective_from TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE (organization_id, effective_from)
      )`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_billing_tariffs_org_effective ON subscription_billing_tariffs(organization_id, effective_from DESC)`);
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS subscription_invoices (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        period_start TEXT NOT NULL, period_end TEXT NOT NULL, tariff_id TEXT NOT NULL REFERENCES subscription_billing_tariffs(id),
        currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'), monthly_base_paise INTEGER NOT NULL CHECK (monthly_base_paise >= 0),
        included_sides INTEGER NOT NULL CHECK (included_sides >= 0), confirmed_sides INTEGER NOT NULL CHECK (confirmed_sides >= 0),
        billable_sides INTEGER NOT NULL CHECK (billable_sides >= 0), per_side_paise INTEGER NOT NULL CHECK (per_side_paise >= 0),
        usage_fee_paise INTEGER NOT NULL CHECK (usage_fee_paise >= 0), total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
        line_items_json TEXT NOT NULL, issued_by TEXT NOT NULL, issued_at TEXT NOT NULL,
        UNIQUE (organization_id, period_start, period_end)
      )`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_subscription_invoices_org_period ON subscription_invoices(organization_id, period_start DESC)`);
      this.queryPostgres(`CREATE OR REPLACE FUNCTION prevent_pilot_billing_record_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'pilot billing records are append-only'; END; $$`);
      this.queryPostgres(`DROP TRIGGER IF EXISTS subscription_billing_tariffs_immutable ON subscription_billing_tariffs`);
      this.queryPostgres(`CREATE TRIGGER subscription_billing_tariffs_immutable BEFORE UPDATE OR DELETE ON subscription_billing_tariffs FOR EACH ROW EXECUTE FUNCTION prevent_pilot_billing_record_mutation()`);
      this.queryPostgres(`DROP TRIGGER IF EXISTS subscription_invoices_immutable ON subscription_invoices`);
      this.queryPostgres(`CREATE TRIGGER subscription_invoices_immutable BEFORE UPDATE OR DELETE ON subscription_invoices FOR EACH ROW EXECUTE FUNCTION prevent_pilot_billing_record_mutation()`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [15, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original error */ }
      throw new Error(`[Inklly DB] Pilot billing migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqlitePlatformAdminPermissionsMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 16`).get()) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TABLE IF NOT EXISTS platform_admin_permissions (
        user_id TEXT NOT NULL, permission TEXT NOT NULL, granted_by_user_id TEXT NOT NULL, granted_at TEXT NOT NULL,
        PRIMARY KEY (user_id, permission),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
      )`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_platform_admin_permissions_user ON platform_admin_permissions(user_id)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (16, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve original error */ }
      throw error;
    }
  }

  private ensurePostgresPlatformAdminPermissionsMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [16]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE TABLE IF NOT EXISTS platform_admin_permissions (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission TEXT NOT NULL,
        granted_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        granted_at TEXT NOT NULL,
        PRIMARY KEY (user_id, permission)
      )`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_platform_admin_permissions_user ON platform_admin_permissions(user_id)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [16, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original error */ }
      throw new Error(`[Inklly DB] Platform permission migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteLedgerIdempotencyMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 10`).get()) return;
    this.db!.exec('BEGIN');
    try {
      const duplicate = this.db!.prepare(`SELECT provider FROM ledger_entries
        WHERE provider_transaction_id IS NOT NULL
        GROUP BY provider, provider_transaction_id HAVING COUNT(*) > 1 LIMIT 1`).get();
      if (duplicate) throw new Error('Duplicate provider transaction IDs exist; reconcile ledger history before enabling uniqueness.');
      this.db!.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_provider_transaction_unique
        ON ledger_entries(provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (10, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve original migration error */ }
      throw error;
    }
  }

  private ensurePostgresLedgerIdempotencyMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [10]).length) return;
    this.queryPostgres('BEGIN');
    try {
      const duplicate = this.queryPostgres<any>(`SELECT provider FROM ledger_entries
        WHERE provider_transaction_id IS NOT NULL
        GROUP BY provider, provider_transaction_id HAVING COUNT(*) > 1 LIMIT 1`)[0];
      if (duplicate) throw new Error('Duplicate provider transaction IDs exist; reconcile ledger history before enabling uniqueness.');
      this.queryPostgres(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_provider_transaction_unique
        ON ledger_entries(provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [10, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original migration error */ }
      throw new Error(`[Inklly DB] PostgreSQL ledger idempotency migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteLedgerAppendOnlyMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 9`).get()) return;
    this.db!.exec('BEGIN');
    try {
      this.db!.exec(`CREATE TRIGGER IF NOT EXISTS ledger_entries_prevent_update
        BEFORE UPDATE ON ledger_entries
        BEGIN
          SELECT RAISE(ABORT, 'ledger_entries are append-only');
        END`);
      this.db!.exec(`CREATE TRIGGER IF NOT EXISTS ledger_entries_prevent_delete
        BEFORE DELETE ON ledger_entries
        BEGIN
          SELECT RAISE(ABORT, 'ledger_entries are append-only');
        END`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (9, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve original migration error */ }
      throw error;
    }
  }

  private ensurePostgresLedgerAppendOnlyMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [9]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`CREATE OR REPLACE FUNCTION prevent_ledger_entry_mutation() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'ledger_entries are append-only';
        END;
        $$`);
      this.queryPostgres(`DROP TRIGGER IF EXISTS ledger_entries_prevent_mutation ON ledger_entries`);
      this.queryPostgres(`CREATE TRIGGER ledger_entries_prevent_mutation
        BEFORE UPDATE OR DELETE ON ledger_entries
        FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_mutation()`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [9, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original migration error */ }
      throw new Error(`[Inklly DB] PostgreSQL ledger append-only migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private ensureSqliteDeveloperKeyScopeMigration(): void {
    if (this.db!.prepare(`SELECT version FROM inklly_schema_migrations WHERE version = 8`).get()) return;
    this.db!.exec('BEGIN');
    try {
      const columns = this.db!.prepare(`PRAGMA table_info(developer_keys)`).all() as Array<{ name: string }>;
      if (!columns.some((column) => column.name === 'shop_id')) this.db!.exec(`ALTER TABLE developer_keys ADD COLUMN shop_id TEXT`);
      if (!columns.some((column) => column.name === 'created_by_user_id')) this.db!.exec(`ALTER TABLE developer_keys ADD COLUMN created_by_user_id TEXT`);
      this.db!.exec(`CREATE INDEX IF NOT EXISTS idx_developer_keys_shop ON developer_keys(shop_id, is_active, expires_at)`);
      this.db!.prepare(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (8, ?)`).run(new Date().toISOString());
      this.db!.exec('COMMIT');
    } catch (error) {
      try { this.db!.exec('ROLLBACK'); } catch { /* preserve original migration error */ }
      throw error;
    }
  }

  private ensurePostgresDeveloperKeyScopeMigration(): void {
    if (this.queryPostgres(`SELECT version FROM inklly_schema_migrations WHERE version = ?`, [8]).length) return;
    this.queryPostgres('BEGIN');
    try {
      this.queryPostgres(`ALTER TABLE developer_keys ADD COLUMN IF NOT EXISTS shop_id TEXT`);
      this.queryPostgres(`ALTER TABLE developer_keys ADD COLUMN IF NOT EXISTS created_by_user_id TEXT`);
      this.queryPostgres(`CREATE INDEX IF NOT EXISTS idx_developer_keys_shop ON developer_keys(shop_id, is_active, expires_at)`);
      this.queryPostgres(`INSERT INTO inklly_schema_migrations (version, applied_at) VALUES (?, ?)`, [8, new Date().toISOString()]);
      this.queryPostgres('COMMIT');
    } catch (error) {
      try { this.queryPostgres('ROLLBACK'); } catch { /* preserve original migration error */ }
      throw new Error(`[Inklly DB] PostgreSQL developer key migration failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
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
    const depth = this.transactionDepth;
    const savepoint = `inklly_nested_${depth}`;
    this.execute(depth === 0 ? 'BEGIN;' : `SAVEPOINT ${savepoint};`);
    this.transactionDepth += 1;
    try {
      const result = callback();
      this.execute(depth === 0 ? 'COMMIT;' : `RELEASE SAVEPOINT ${savepoint};`);
      this.transactionDepth = depth;
      return result;
    } catch (err) {
      this.transactionDepth = depth;
      if (depth === 0) this.execute('ROLLBACK;');
      else {
        this.execute(`ROLLBACK TO SAVEPOINT ${savepoint};`);
        this.execute(`RELEASE SAVEPOINT ${savepoint};`);
      }
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
  deletion_requested_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id, category_id) REFERENCES storage_categories(shop_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_storage_documents_shop_created ON storage_documents(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_storage_documents_category ON storage_documents(category_id);
`;
