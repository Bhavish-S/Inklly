import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { WebhookDeliveryWorker, buildSignedWebhookRequest, ClaimedWebhookDelivery, isPublicWebhookAddress } from '../services/webhook-delivery';

const delivery: ClaimedWebhookDelivery = {
  deliveryId: 'whd-test',
  eventId: 'evt-test',
  subscriptionId: 'whk-test',
  targetUrl: 'https://hooks.example.com/events',
  encryptedSecret: 'unused-by-injected-sender',
  eventType: 'order.created',
  eventCreatedAt: '2026-10-29T00:00:00.000Z',
  payloadJson: JSON.stringify({ orderId: 'ord-test' }),
  attemptCount: 1,
};

describe('developer webhook delivery safety', () => {
  it('signs the exact transmitted JSON body with timestamped HMAC SHA-256', () => {
    const signed = buildSignedWebhookRequest(delivery, 'whsec_test', '1793260000');
    const expected = crypto.createHmac('sha256', 'whsec_test').update(`1793260000.${signed.body}`).digest('hex');
    const payload = JSON.parse(signed.body);
    assert.equal(payload.eventId, delivery.eventId);
    assert.equal(payload.eventType, delivery.eventType);
    assert.equal(payload.timestamp, delivery.eventCreatedAt);
    assert.equal(payload.data.orderId, 'ord-test');
    assert.equal(signed.headers['X-Inklly-Signature'], `t=1793260000,v1=${expected}`);
    assert.equal(signed.headers['X-Inklly-Event'], 'order.created');
    assert.equal(signed.headers['X-Inklly-Delivery'], 'evt-test');
    assert.equal(Number(signed.headers['Content-Length']), Buffer.byteLength(signed.body));
  });

  it('allows public DNS results while rejecting reserved and private targets', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888']) assert.equal(isPublicWebhookAddress(ip), true, ip);
    for (const ip of ['127.0.0.1', '10.1.2.3', '100.64.0.1', '169.254.1.1', '172.20.1.1', '192.168.1.1', '198.18.0.1', '203.0.113.2', '::1', 'fc00::1', 'fe80::1', '2001:db8::1', '::ffff:127.0.0.1', 'not::an-ip']) {
      assert.equal(isPublicWebhookAddress(ip), false, ip);
    }
  });

  it('records retry metadata after a destination rejects a delivery', async () => {
    const originalFlag = process.env.ENABLE_EXTERNAL_API_ACCESS;
    process.env.ENABLE_EXTERNAL_API_ACCESS = 'true';
    let recorded: any;
    const repository = {
      claimDueWebhookDeliveries: () => [{ ...delivery }],
      recordWebhookDeliveryResult: (...args: any[]) => { recorded = args; },
    };
    try {
      const worker = new WebhookDeliveryWorker(repository as any, async () => ({ statusCode: 503 }));
      await worker.pump();
      assert.equal(recorded[0], delivery.deliveryId);
      assert.equal(recorded[1], false);
      assert.equal(recorded[2], 503);
      assert.equal(recorded[3], 'destination_http_503');
      assert.ok(Date.parse(recorded[4]) > Date.now());
      assert.equal(recorded[5], false);
    } finally {
      if (originalFlag === undefined) delete process.env.ENABLE_EXTERNAL_API_ACCESS;
      else process.env.ENABLE_EXTERNAL_API_ACCESS = originalFlag;
    }
  });

  it('stops retrying after the bounded attempt budget', async () => {
    const originalFlag = process.env.ENABLE_EXTERNAL_API_ACCESS;
    process.env.ENABLE_EXTERNAL_API_ACCESS = 'true';
    let recorded: any;
    const repository = {
      claimDueWebhookDeliveries: () => [{ ...delivery, attemptCount: 8 }],
      recordWebhookDeliveryResult: (...args: any[]) => { recorded = args; },
    };
    try {
      const worker = new WebhookDeliveryWorker(repository as any, async () => ({ statusCode: 500 }));
      await worker.pump();
      assert.equal(recorded[4], null);
      assert.equal(recorded[5], true);
    } finally {
      if (originalFlag === undefined) delete process.env.ENABLE_EXTERNAL_API_ACCESS;
      else process.env.ENABLE_EXTERNAL_API_ACCESS = originalFlag;
    }
  });
});
