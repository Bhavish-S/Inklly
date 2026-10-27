import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createPublicUploadConcurrencyGuard } from '../middleware/public-upload-guard';

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
