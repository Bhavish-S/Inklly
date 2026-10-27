import { DatabaseService } from '../database';

export interface PublicEnquiryInput {
  id: string;
  idempotencyKey: string | null;
  source: 'HOME' | 'CONTACT';
  name: string;
  phone: string;
  email: string | null;
  message: string;
  city: string | null;
  state: string | null;
  createdAt: string;
}

export interface PublicEnquiry extends Omit<PublicEnquiryInput, 'idempotencyKey'> {
  status: 'OPEN' | 'CLOSED';
}

export class EnquiryRepository {
  constructor(private db: DatabaseService) {
    // The SQLite schema is created by DatabaseService. PostgreSQL deployments
    // use this additive, idempotent schema step because the legacy worker does
    // not execute the SQLite schema file on connect.
    this.db.execute(`CREATE TABLE IF NOT EXISTS public_enquiries (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      message TEXT NOT NULL,
      city TEXT,
      state TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TEXT NOT NULL
    )`);
    this.db.execute('CREATE INDEX IF NOT EXISTS idx_public_enquiries_status_created ON public_enquiries(status, created_at)');
  }

  public create(input: PublicEnquiryInput): PublicEnquiry {
    if (input.idempotencyKey) {
      const previous = this.db.queryOne<any>('SELECT * FROM public_enquiries WHERE idempotency_key = ?', [input.idempotencyKey]);
      if (previous) return this.mapRow(previous);
    }

    try {
      this.db.execute(
        `INSERT INTO public_enquiries
          (id, idempotency_key, source, name, phone, email, message, city, state, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)`,
        [input.id, input.idempotencyKey, input.source, input.name, input.phone, input.email, input.message, input.city, input.state, input.createdAt],
      );
      return { ...input, status: 'OPEN' };
    } catch (error) {
      // Concurrent retries can race the initial lookup and the unique insert.
      if (input.idempotencyKey) {
        const previous = this.db.queryOne<any>('SELECT * FROM public_enquiries WHERE idempotency_key = ?', [input.idempotencyKey]);
        if (previous) return this.mapRow(previous);
      }
      throw error;
    }
  }

  public list(limit = 100, offset = 0): PublicEnquiry[] {
    const rows = this.db.query<any>(
      'SELECT * FROM public_enquiries ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset],
    );
    return rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: any): PublicEnquiry {
    return {
      id: row.id,
      source: row.source,
      name: row.name,
      phone: row.phone,
      email: row.email || null,
      message: row.message,
      city: row.city || null,
      state: row.state || null,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
