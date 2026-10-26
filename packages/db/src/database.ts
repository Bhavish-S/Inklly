import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import { SCHEMA_SQL } from './schema';

export class DatabaseService {
  private db: DatabaseSync;
  private static instance: DatabaseService | null = null;

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

  public static getInstance(dbPath?: string): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(dbPath || ':memory:');
    }
    return DatabaseService.instance;
  }

  public getRawDb(): DatabaseSync {
    return this.db;
  }

  private initSchema(): void {
    this.db.exec(SCHEMA_SQL);
  }

  public execute(sql: string, params: (string | number | null)[] = []): void {
    const stmt = this.db.prepare(sql);
    stmt.run(...params);
  }

  public query<T = unknown>(sql: string, params: (string | number | null)[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public queryOne<T = unknown>(sql: string, params: (string | number | null)[] = []): T | null {
    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return (result as T) || null;
  }

  public transaction<T>(callback: () => T): T {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      const result = callback();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public close(): void {
    this.db.close();
  }
}
