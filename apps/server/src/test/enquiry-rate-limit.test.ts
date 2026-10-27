import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { createEnquiryRateLimit, resetEnquiryRateLimitForTests } from '../middleware/enquiry-rate-limit';

describe('public enquiry rate limit', () => {
  beforeEach(() => resetEnquiryRateLimitForTests());

  it('limits repeated submissions by client address and returns a retry delay', () => {
    const middleware = createEnquiryRateLimit(2, 60_000);
    let passed = 0;
    const response = () => {
      const result: any = { headers: {}, statusCode: 200, body: undefined };
      result.setHeader = (name: string, value: string) => { result.headers[name] = value; };
      result.status = (code: number) => { result.statusCode = code; return result; };
      result.json = (body: unknown) => { result.body = body; return result; };
      return result;
    };
    const request: any = { ip: '203.0.113.4', socket: { remoteAddress: '127.0.0.1' } };
    for (let i = 0; i < 2; i += 1) middleware(request, response(), () => { passed += 1; });
    const blocked = response();
    middleware(request, blocked, () => { passed += 1; });
    assert.equal(passed, 2);
    assert.equal(blocked.statusCode, 429);
    assert.ok(Number(blocked.headers['Retry-After']) > 0);
  });
});
