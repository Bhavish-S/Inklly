import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { DatabaseService } from '@inklly/db';
import { createEnquiryRateLimit } from '../middleware/enquiry-rate-limit';

function makeResponse() {
  const response: any = { headers: {}, statusCode: 200, body: undefined };
  response.setHeader = (name: string, value: string) => { response.headers[name] = value; };
  response.status = (code: number) => { response.statusCode = code; return response; };
  response.json = (body: unknown) => { response.body = body; return response; };
  return response;
}

describe('public enquiry rate limit', () => {
  it('shares atomic per-IP windows across middleware instances and stores only HMAC keys', () => {
    const db = new DatabaseService(':memory:');
    try {
      let now = 123_456;
      const options = { limit: 2, windowMs: 60_000, key: 'test-enquiry-key', now: () => now };
      const instanceA = createEnquiryRateLimit(db, options);
      const instanceB = createEnquiryRateLimit(db, options);
      const request: any = { ip: '203.0.113.4', socket: { remoteAddress: '127.0.0.1' } };
      let passed = 0;
      instanceA(request, makeResponse(), () => { passed += 1; });
      instanceB(request, makeResponse(), () => { passed += 1; });
      const blocked = makeResponse();
      instanceA(request, blocked, () => { passed += 1; });
      assert.equal(passed, 2);
      assert.equal(blocked.statusCode, 429);
      assert.ok(Number(blocked.headers['Retry-After']) > 0);

      const stored = db.query<{ bucket_key: string; request_count: number }>(`SELECT bucket_key, request_count FROM public_upload_rate_limits`);
      assert.equal(stored.length, 1);
      assert.equal(stored[0].bucket_key, `e:${createHmac('sha256', 'test-enquiry-key').update(request.ip).digest('hex')}`);
      assert.equal(stored[0].request_count, 3);
      assert.ok(!stored[0].bucket_key.includes(request.ip), 'the source address must not be stored directly');

      now = 180_000;
      const nextWindow = makeResponse();
      instanceB(request, nextWindow, () => { passed += 1; });
      assert.equal(nextWindow.statusCode, 200);
      assert.equal(passed, 3);
    } finally {
      db.close();
    }
  });

  it('fails closed when the shared counter is unavailable', () => {
    const brokenDatabase = { queryOne: () => { throw new Error('database unavailable'); } } as any;
    const middleware = createEnquiryRateLimit(brokenDatabase, { limit: 2, windowMs: 60_000, key: 'test-key' });
    let passed = 0;
    const response = makeResponse();
    middleware({ ip: '203.0.113.8', socket: {} } as any, response, () => { passed += 1; });
    assert.equal(passed, 0);
    assert.equal(response.statusCode, 503);
    assert.match(response.body.error, /temporarily unavailable/i);
  });
});
