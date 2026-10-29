import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createPublicUploadConcurrencyGuard } from '../middleware/public-upload-guard';
import { DatabaseService } from '@inklly/db';
import { createPublicUploadRateLimit } from '../middleware/public-upload-rate-limit';

function fakeResponse() {
  const response = new EventEmitter() as EventEmitter & {
    statusCode?: number;
    headers: Record<string, string>;
    body?: unknown;
    setHeader(name: string, value: string): void;
    status(status: number): typeof response;
    json(value: unknown): typeof response;
  };
  response.headers = {};
  response.setHeader = (name, value) => { response.headers[name] = value; };
  response.status = (status) => { response.statusCode = status; return response; };
  response.json = (value) => { response.body = value; return response; };
  return response;
}

describe('public upload concurrency guard', () => {
  it('rejects requests over capacity before parsing and releases capacity when a response closes', () => {
    const guard = createPublicUploadConcurrencyGuard(1);
    const firstResponse = fakeResponse();
    let firstPassed = false;
    guard({} as any, firstResponse as any, () => { firstPassed = true; });
    assert.equal(firstPassed, true);

    const rejectedResponse = fakeResponse();
    let rejectedPassed = false;
    guard({} as any, rejectedResponse as any, () => { rejectedPassed = true; });
    assert.equal(rejectedPassed, false);
    assert.equal(rejectedResponse.statusCode, 429);
    assert.equal(rejectedResponse.headers['Retry-After'], '2');

    firstResponse.emit('close');
    const nextResponse = fakeResponse();
    let nextPassed = false;
    guard({} as any, nextResponse as any, () => { nextPassed = true; });
    assert.equal(nextPassed, true);
    nextResponse.emit('finish');
  });

  it('clamps invalid and excessive limits to the supported range', () => {
    const invalidLimitGuard = createPublicUploadConcurrencyGuard(Number.NaN);
    const first = fakeResponse();
    invalidLimitGuard({} as any, first as any, () => undefined);
    const second = fakeResponse();
    invalidLimitGuard({} as any, second as any, () => undefined);
    const third = fakeResponse();
    invalidLimitGuard({} as any, third as any, () => undefined);
    assert.equal(third.statusCode, 429);
    first.emit('finish');
    second.emit('finish');

    const excessiveGuard = createPublicUploadConcurrencyGuard(100);
    const activeResponses = Array.from({ length: 8 }, () => fakeResponse());
    for (const response of activeResponses) excessiveGuard({} as any, response as any, () => undefined);
    const blockedResponse = fakeResponse();
    excessiveGuard({} as any, blockedResponse as any, () => undefined);
    assert.equal(blockedResponse.statusCode, 429);
    activeResponses.forEach((response) => response.emit('finish'));
  });
});

describe('shared public upload rate limit', () => {
  it('shares atomic minute/day counters across middleware instances and stores only HMAC keys', () => {
    const db = new DatabaseService(':memory:');
    let now = 1_800_000_000_000;
    const options = { perMinute: 2, perDay: 3, key: 'test-key', now: () => now };
    const instanceA = createPublicUploadRateLimit(db, options);
    const instanceB = createPublicUploadRateLimit(db, options);
    const request = { ip: '203.0.113.7', socket: { remoteAddress: '203.0.113.7' } } as any;
    const run = (middleware: ReturnType<typeof createPublicUploadRateLimit>) => {
      const response = fakeResponse();
      let nextCalled = false;
      middleware(request, response as any, () => { nextCalled = true; });
      return { response, nextCalled };
    };

    assert.equal(run(instanceA).nextCalled, true);
    assert.equal(run(instanceB).nextCalled, true);
    const minuteLimited = run(instanceA);
    assert.equal(minuteLimited.nextCalled, false);
    assert.equal(minuteLimited.response.statusCode, 429);
    assert.equal(minuteLimited.response.headers['Retry-After'], '60');
    now += 60_000;
    assert.equal(run(instanceB).nextCalled, true);
    const dayLimited = run(instanceA);
    assert.equal(dayLimited.nextCalled, false);
    assert.equal(dayLimited.response.statusCode, 429);
    assert.equal(dayLimited.response.body && (dayLimited.response.body as any).code, 'PUBLIC_UPLOAD_RATE_LIMIT');

    const buckets = db.query<any>(`SELECT bucket_key FROM public_upload_rate_limits`);
    assert.ok(buckets.length >= 2);
    assert.ok(buckets.every((bucket) => !bucket.bucket_key.includes('203.0.113.7')));
  });

  it('fails closed when shared rate-limit persistence is unavailable', () => {
    const brokenDb = { queryOne() { throw new Error('database unavailable'); } } as any;
    const middleware = createPublicUploadRateLimit(brokenDb, { key: 'test-key' });
    const response = fakeResponse();
    let nextCalled = false;
    middleware({ ip: '198.51.100.9' } as any, response as any, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(response.statusCode, 503);
    assert.equal((response.body as any).code, 'PUBLIC_UPLOAD_RATE_LIMIT_UNAVAILABLE');
  });
});
