import * as fs from 'node:fs';
import * as path from 'node:path';

export type StoredObject = { name: string; id: string | null; created_at?: string | null };

/** Private document storage shared by customer uploads, merchant previews, agents and retention. */
export class PrivateFileStorage {
  private readonly driver: 'local' | 'supabase';
  private readonly supabaseUrl: string;
  private readonly serviceKey: string;
  private readonly bucket: string;

  constructor() {
    const configuredDriver = (process.env.STORAGE_DRIVER || '').trim().toLowerCase();
    this.driver = (configuredDriver || (process.env.NODE_ENV === 'production' ? 'supabase' : 'local')) as 'local' | 'supabase';
    if (!['local', 'supabase'].includes(this.driver)) throw new Error('STORAGE_DRIVER must be local or supabase');
    if (process.env.NODE_ENV === 'production' && this.driver !== 'supabase') {
      throw new Error('Production requires private Supabase Storage; local upload storage is not durable.');
    }

    this.supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || 'customer-print-files';
    if (this.driver === 'supabase' && (!/^https:\/\//i.test(this.supabaseUrl) || !this.serviceKey || !/^[a-z0-9][a-z0-9_-]{0,62}$/.test(this.bucket))) {
      throw new Error('Supabase file storage requires HTTPS SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and a valid SUPABASE_STORAGE_BUCKET');
    }
  }

  private parseKey(storageKey: string, shopId?: string): string | null {
    if (typeof storageKey !== 'string' || !storageKey.startsWith('uploads/')) return null;
    const objectPath = storageKey.slice('uploads/'.length);
    const parts = objectPath.split('/');
    if (parts.length !== 2 || parts.some((part) => !part || part === '.' || part === '..' || !/^[A-Za-z0-9_.-]+$/.test(part))) return null;
    if (shopId && parts[0] !== shopId.replace(/[^a-zA-Z0-9_-]/g, '_')) return null;
    return objectPath;
  }

  isValidShopKey(storageKey: string, shopId: string): boolean {
    return this.parseKey(storageKey, shopId) !== null;
  }

  private localPath(storageKey: string): string | null {
    if (!this.parseKey(storageKey)) return null;
    const root = path.resolve(process.cwd(), 'uploads');
    const fullPath = path.resolve(process.cwd(), storageKey);
    return fullPath.startsWith(`${root}${path.sep}`) ? fullPath : null;
  }

  private apiUrl(action: 'object' | 'authenticated' | 'info' | 'list' | 'remove', objectPath?: string): string {
    const bucket = encodeURIComponent(this.bucket);
    const encodedPath = objectPath?.split('/').map(encodeURIComponent).join('/');
    if (action === 'authenticated') return `${this.supabaseUrl}/storage/v1/object/authenticated/${bucket}/${encodedPath}`;
    if (action === 'info') return `${this.supabaseUrl}/storage/v1/object/info/${bucket}/${encodedPath}`;
    if (action === 'list') return `${this.supabaseUrl}/storage/v1/object/list/${bucket}`;
    if (action === 'remove') return `${this.supabaseUrl}/storage/v1/object/${bucket}`;
    return `${this.supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, ...extra };
  }

  async verifyReady(): Promise<void> {
    if (this.driver === 'local') return;
    const response = await fetch(`${this.supabaseUrl}/storage/v1/bucket/${encodeURIComponent(this.bucket)}`, { headers: this.headers() });
    await this.requireSuccess(response, 'bucket verification');
    const bucket = await response.json() as { public?: boolean };
    if (bucket.public !== false) throw new Error('Customer print storage bucket must exist and be private (public=false).');
  }

  private async requireSuccess(response: Response, operation: string): Promise<void> {
    if (!response.ok) throw new Error(`Private storage ${operation} failed (HTTP ${response.status})`);
  }

  async store(shopId: string, fileName: string, mimeType: string, body: Buffer): Promise<string> {
    const safeShopId = shopId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storageKey = `uploads/${safeShopId}/${fileName}`;
    const objectPath = this.parseKey(storageKey, safeShopId);
    if (!objectPath) throw new Error('Invalid private storage path');
    if (this.driver === 'local') {
      const fullPath = this.localPath(storageKey)!;
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, body, { flag: 'wx' });
      return storageKey;
    }
    const response = await fetch(this.apiUrl('object', objectPath), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': mimeType || 'application/octet-stream', 'x-upsert': 'false', 'cache-control': '0' }),
      body,
    });
    await this.requireSuccess(response, 'upload');
    return storageKey;
  }

  async exists(storageKey: string, shopId?: string): Promise<boolean> {
    const objectPath = this.parseKey(storageKey, shopId);
    if (!objectPath) return false;
    if (this.driver === 'local') {
      const fullPath = this.localPath(storageKey)!;
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
    }
    // Supabase documents HEAD on /object/info for object metadata. The authenticated
    // download route is GET-only; using HEAD there is not a portable existence check.
    const response = await fetch(this.apiUrl('info', objectPath), { method: 'HEAD', headers: this.headers() });
    // Storage API versions have returned both 400 and 404 for a missing HEAD target.
    // A valid parsed key makes either response an absent object; auth/provider errors
    // (401/403/5xx) remain failures and are never treated as a successful absence.
    if (response.status === 400 || response.status === 404) return false;
    await this.requireSuccess(response, 'existence check');
    return true;
  }

  async read(storageKey: string, shopId?: string): Promise<Buffer | null> {
    const objectPath = this.parseKey(storageKey, shopId);
    if (!objectPath) return null;
    if (this.driver === 'local') {
      const fullPath = this.localPath(storageKey)!;
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return null;
      return fs.readFileSync(fullPath);
    }
    const response = await fetch(this.apiUrl('authenticated', objectPath), { headers: this.headers() });
    if (response.status === 404) return null;
    await this.requireSuccess(response, 'download');
    return Buffer.from(await response.arrayBuffer());
  }

  async remove(storageKey: string): Promise<boolean> {
    const objectPath = this.parseKey(storageKey);
    if (!objectPath) return false;
    if (this.driver === 'local') {
      const fullPath = this.localPath(storageKey)!;
      try {
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) fs.unlinkSync(fullPath);
        return true;
      } catch (error) {
        console.error('[File retention] Could not remove expired upload', error);
        return false;
      }
    }
    const response = await fetch(this.apiUrl('remove'), {
      method: 'DELETE',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: [objectPath] }),
    });
    await this.requireSuccess(response, 'deletion');
    return true;
  }

  async list(prefix: string, limit = 100, offset = 0): Promise<StoredObject[]> {
    if (this.driver === 'local') {
      const localPrefix = prefix ? `uploads/${prefix}` : 'uploads';
      const directory = path.resolve(process.cwd(), localPrefix);
      const root = path.resolve(process.cwd(), 'uploads');
      if (!directory.startsWith(root) || !fs.existsSync(directory)) return [];
      return fs.readdirSync(directory, { withFileTypes: true }).slice(offset, offset + limit).map((entry) => ({
        name: entry.name,
        id: entry.isDirectory() ? null : entry.name,
        created_at: entry.isDirectory() ? null : fs.statSync(path.join(directory, entry.name)).birthtime.toISOString(),
      }));
    }
    const response = await fetch(this.apiUrl('list'), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix, limit, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    await this.requireSuccess(response, 'listing');
    const entries = await response.json() as StoredObject[];
    return Array.isArray(entries) ? entries : [];
  }
}
