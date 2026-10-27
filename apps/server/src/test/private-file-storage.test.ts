import { after, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { PrivateFileStorage } from '../services/private-file-storage';

describe('Private file storage', { concurrency: false }, () => {
  const names = ['NODE_ENV', 'STORAGE_DRIVER', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET'] as const;
  const previousEnv = new Map(names.map((name) => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  after(() => {
    for (const name of names) {
      const value = previousEnv.get(name);
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    globalThis.fetch = originalFetch;
  });

  it('uses a private bucket API for upload, existence, download, listing, and deletion', async () => {
    process.env.NODE_ENV = 'test';
    process.env.STORAGE_DRIVER = 'supabase';
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-secret';
    process.env.SUPABASE_STORAGE_BUCKET = 'customer-print-files';
    const seen: Array<{ url: string; method: string; headers: Record<string, string> }> = [];
    globalThis.fetch = (async (input: any, init: any = {}) => {
      const url = String(input);
      const headers = new Headers(init.headers);
      seen.push({ url, method: init.method || 'GET', headers: Object.fromEntries(headers.entries()) });
      if (url.endsWith('/storage/v1/bucket/customer-print-files')) return new Response(JSON.stringify({ public: false }), { status: 200 });
      if (url.endsWith('/storage/v1/object/list/customer-print-files')) return new Response(JSON.stringify([{ name: 'sample.pdf', id: 'object-1', created_at: new Date().toISOString() }]), { status: 200 });
      if ((init.method || 'GET') === 'HEAD') return new Response(null, { status: 200 });
      if ((init.method || 'GET') === 'GET') return new Response(Buffer.from('%PDF-1.4'), { status: 200 });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    const storage = new PrivateFileStorage();
    await storage.verifyReady();
    const key = await storage.store('shop-1', 'sample.pdf', 'application/pdf', Buffer.from('%PDF-1.4'));
    assert.equal(key, 'uploads/shop-1/sample.pdf');
    assert.equal(await storage.exists(key, 'shop-1'), true);
    assert.equal((await storage.read(key, 'shop-1'))?.toString(), '%PDF-1.4');
    assert.equal((await storage.list('shop-1')).length, 1);
    assert.equal(await storage.remove(key), true);
    assert.ok(seen.some((call) => call.method === 'HEAD' && call.url.endsWith('/storage/v1/object/info/customer-print-files/shop-1/sample.pdf')));
    assert.ok(seen.every((call) => call.headers.apikey === 'server-only-secret'));
    assert.ok(!seen.some((call) => call.url.includes('/object/public/')));
    assert.equal(storage.isValidShopKey(key, 'another-shop'), false);
  });

  it('refuses a public customer document bucket', async () => {
    process.env.NODE_ENV = 'test';
    process.env.STORAGE_DRIVER = 'supabase';
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-secret';
    process.env.SUPABASE_STORAGE_BUCKET = 'customer-print-files';
    globalThis.fetch = (async () => new Response(JSON.stringify({ public: true }), { status: 200 })) as typeof fetch;
    await assert.rejects(() => new PrivateFileStorage().verifyReady(), /must exist and be private/);
  });

  it('treats missing object metadata as absent while preserving authorization failures', async () => {
    process.env.NODE_ENV = 'test';
    process.env.STORAGE_DRIVER = 'supabase';
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-secret';
    process.env.SUPABASE_STORAGE_BUCKET = 'customer-print-files';
    const storage = new PrivateFileStorage();
    globalThis.fetch = (async () => new Response(null, { status: 400 })) as typeof fetch;
    assert.equal(await storage.exists('uploads/shop-1/missing.pdf', 'shop-1'), false);
    globalThis.fetch = (async () => new Response(null, { status: 403 })) as typeof fetch;
    await assert.rejects(() => storage.exists('uploads/shop-1/missing.pdf', 'shop-1'), /HTTP 403/);
  });

  it('refuses local storage in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.STORAGE_DRIVER = 'local';
    assert.throws(() => new PrivateFileStorage(), /Production requires private Supabase Storage/);
  });
});
