import * as crypto from 'node:crypto';
import * as dns from 'node:dns/promises';
import { isIP } from 'node:net';
import * as https from 'node:https';
import { AgentRepository } from '@inklly/db';
import { decryptWebhookSecret } from './webhook-secrets';

const MAX_ATTEMPTS = 8;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 4_096;
const MAX_PAYLOAD_BYTES = 64 * 1024;

export type ClaimedWebhookDelivery = {
  deliveryId: string;
  eventId: string;
  subscriptionId: string;
  targetUrl: string;
  encryptedSecret: string;
  eventType: string;
  eventCreatedAt: string;
  payloadJson: string;
  attemptCount: number;
};

export function isPublicWebhookAddress(address: string): boolean {
  const family = isIP(address);
  if (!family) return false;
  const octets = address.split('.').map(Number);
  if (family === 4 && octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b, c] = octets;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || b === 168) ) return false;
    if (a === 192 && b === 88 && c === 99) return false;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
    if (a === 203 && b === 0 && (c === 113 || c === 0)) return false;
    if (a === 192 && b === 0 && c === 2) return false;
    return true;
  }

  if (!address.includes(':')) return false;
  const ip = address.toLowerCase().split('%')[0];
  if (ip.startsWith('::ffff:') || ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb') || ip.startsWith('ff')) return false;
  const firstHextet = Number.parseInt(ip.split(':').find(Boolean) || '0', 16);
  // Permit only global-unicast space (2000::/3); deny documentation, transition,
  // and special-use prefixes that can route into non-public networks.
  if (firstHextet < 0x2000 || firstHextet > 0x3fff) return false;
  if (/^2001:(?:0|10|20|db8):/i.test(ip) || /^2002:/i.test(ip) || /^3fff:/i.test(ip)) return false;
  return true;
}

async function resolvePublicTarget(hostname: string): Promise<{ address: string; family: number }> {
  let timer: NodeJS.Timeout | undefined;
  const records = await Promise.race([
    dns.lookup(hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('dns_timeout')), 3_000); }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
  if (!records.length || records.some((record) => !isPublicWebhookAddress(record.address))) {
    throw new Error('destination_dns_not_public');
  }
  return records[0];
}

function requestPinnedHttps(url: URL, address: string, family: number, body: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: 'https:',
      hostname: url.hostname,
      servername: url.hostname,
      port: url.port ? Number(url.port) : 443,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers,
      agent: false,
      timeout: REQUEST_TIMEOUT_MS,
      lookup: ((_hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => callback(null, address, family)) as any,
    });
    req.on('timeout', () => req.destroy(new Error('request_timeout')));
    req.on('error', reject);
    req.on('response', (response) => {
      let received = 0;
      response.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_RESPONSE_BYTES) response.destroy(new Error('response_too_large'));
      });
      response.on('error', reject);
      response.on('end', () => resolve(response.statusCode || 0));
    });
    req.end(body);
  });
}

export async function sendSignedWebhook(delivery: ClaimedWebhookDelivery): Promise<{ statusCode: number }> {
  const url = new URL(delivery.targetUrl);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.hash || url.hostname.length > 253) {
    throw new Error('destination_url_rejected');
  }
  const pinned = await resolvePublicTarget(url.hostname);
  const secret = decryptWebhookSecret(delivery.encryptedSecret);
  const signed = buildSignedWebhookRequest(delivery, secret);
  const statusCode = await requestPinnedHttps(url, pinned.address, pinned.family, signed.body, signed.headers);
  return { statusCode };
}

export function buildSignedWebhookRequest(
  delivery: Pick<ClaimedWebhookDelivery, 'eventId' | 'eventType' | 'eventCreatedAt' | 'payloadJson'>,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000).toString(),
): { body: string; headers: Record<string, string> } {
  const body = JSON.stringify({
    eventId: delivery.eventId,
    eventType: delivery.eventType,
    timestamp: delivery.eventCreatedAt,
    data: JSON.parse(delivery.payloadJson),
  });
  if (Buffer.byteLength(body) > MAX_PAYLOAD_BYTES) throw new Error('payload_too_large');
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return {
    body,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(body)),
      'User-Agent': 'Inklly-Webhooks/1.0',
      'X-Inklly-Event': delivery.eventType,
      'X-Inklly-Delivery': delivery.eventId,
      'X-Inklly-Signature': `t=${timestamp},v1=${signature}`,
    },
  };
}

function retryAt(attemptCount: number): string | null {
  if (attemptCount >= MAX_ATTEMPTS) return null;
  const delayMs = Math.min(6 * 60 * 60_000, 30_000 * (2 ** Math.max(0, attemptCount - 1)));
  return new Date(Date.now() + delayMs).toISOString();
}

export class WebhookDeliveryWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private repository: AgentRepository,
    private sender: (delivery: ClaimedWebhookDelivery) => Promise<{ statusCode: number }> = sendSignedWebhook,
  ) {}

  public start(intervalMs = 5_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.pump(); }, intervalMs);
    this.timer.unref();
    void this.pump();
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  public async pump(): Promise<void> {
    if (this.running || process.env.ENABLE_EXTERNAL_API_ACCESS !== 'true') return;
    this.running = true;
    try {
      const deliveries = this.repository.claimDueWebhookDeliveries(20, REQUEST_TIMEOUT_MS + 5_000) as ClaimedWebhookDelivery[];
      await Promise.all(deliveries.map(async (delivery) => {
        try {
          const { statusCode } = await this.sender(delivery);
          const success = statusCode >= 200 && statusCode < 300;
          this.repository.recordWebhookDeliveryResult(
            delivery.deliveryId,
            success,
            statusCode,
            success ? null : `destination_http_${statusCode}`,
            success ? null : retryAt(delivery.attemptCount),
            !success && delivery.attemptCount >= MAX_ATTEMPTS,
          );
        } catch (error) {
          const reason = error instanceof Error && /^[a-z0-9_]{1,64}$/i.test(error.message) ? error.message : 'delivery_failed';
          this.repository.recordWebhookDeliveryResult(
            delivery.deliveryId,
            false,
            null,
            reason,
            retryAt(delivery.attemptCount),
            delivery.attemptCount >= MAX_ATTEMPTS,
          );
        }
      }));
    } catch (error) {
      console.error('[Webhook delivery] Queue pass failed', error instanceof Error ? error.message : 'unknown_error');
    } finally {
      this.running = false;
    }
  }
}
