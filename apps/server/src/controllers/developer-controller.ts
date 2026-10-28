import { Request, Response } from 'express';
import * as crypto from 'node:crypto';
import { isIP } from 'node:net';
import { AgentRepository, DeveloperKeyRecord, WebhookSubscriptionRecord } from '@inklly/db';
import { encryptWebhookSecret } from '../services/webhook-secrets';

const WEBHOOK_EVENT_TYPES = ['order.created', 'order.status_changed', 'payment.succeeded', 'print_job.jammed', 'spooler.offline'];

function normalizeWebhookUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || isIP(hostname) || !hostname.includes('.') ||
      hostname === 'localhost' || ['.localhost', '.local', '.internal', '.test', '.invalid'].some((suffix) => hostname.endsWith(suffix))) {
    return null;
  }
  return url.toString();
}

export class DeveloperController {
  constructor(private agentRepo: AgentRepository) {}

  private organizationId(req: Request, res: Response): string | null {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(403).json({ error: 'An organization membership is required.' });
      return null;
    }
    return orgId;
  }

  public getOpenApiSpec = (req: Request, res: Response) => {
    const configuredPublicBase = (process.env.API_PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
    const servers = configuredPublicBase
      ? [{ url: `${configuredPublicBase}/api/v1`, description: 'Configured Inklly API' }]
      : [{ url: 'http://localhost:4000/api/v1', description: 'Local Development API' }];
    res.json({
      openapi: '3.0.3',
      info: {
        title: 'Inklly Public & Merchant API',
        version: '1.0.0',
        description:
          'Authoritative REST API specification for Inklly Print OS, customer ordering, edge agent dispatch, and automated ledgers.',
      },
      servers,
      paths: {
        '/portal/shop/{shop_code}': {
          get: {
            summary: 'Get public shop metadata for QR customer portal',
            parameters: [{ name: 'shop_code', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { 200: { description: 'Shop profile and allowed print formats' } },
          },
        },
        '/portal/quote': {
          post: {
            summary: 'Deterministic quotation calculation in integer minor units (Paise)',
            requestBody: { required: true },
            responses: { 200: { description: 'Itemized quotation breakdown' } },
          },
        },
        '/portal/orders': {
          post: {
            summary: 'Submit customer print order',
            description: 'Send a stable Idempotency-Key to safely replay a submission after a timeout. Reusing a key with different order data returns 409. Older clients may omit it, but each such request is treated as new.',
            parameters: [{ name: 'Idempotency-Key', in: 'header', required: false, description: 'Stable client-generated key, 16–128 letters, numbers, underscores, or hyphens.', schema: { type: 'string', minLength: 16, maxLength: 128 } }],
            requestBody: { required: true },
            responses: {
              201: { description: 'Order created with tracking ID' },
              200: { description: 'Previously created order returned for an exact idempotent retry' },
              400: { description: 'Invalid idempotency key or request' },
              409: { description: 'Idempotency key reused for different order data or quote no longer current' },
            },
          },
        },
        '/agent/enroll': {
          post: {
            summary: 'Pair Desktop Print Agent with Shop ID and secret key',
            responses: { 201: { description: 'Agent enrolled and token issued' } },
          },
        },
        '/agent/heartbeat': {
          post: {
            summary: 'Edge agent 15-second heartbeat with queue depth & printer status',
            responses: { 200: { description: 'Heartbeat acknowledged' } },
          },
        },
        '/agent/poll-commands': {
          get: {
            summary: 'Poll queued print tickets for dispatch',
            responses: { 200: { description: 'Array of print tickets' } },
          },
        },
        '/merchant/orders': {
          get: {
            summary: 'Merchant orders queue filtered by status',
            responses: { 200: { description: 'Filtered orders list' } },
          },
        },
      },
    });
  };

  public getKeys = (req: Request, res: Response) => {
    const orgId = this.organizationId(req, res);
    if (!orgId) return;
    const keys = this.agentRepo.getDeveloperKeysByOrg(orgId).map(({ secretHash: _secretHash, ...key }) => key);
    res.json(keys);
  };

  public createKey = (req: Request, res: Response) => {
    const orgId = this.organizationId(req, res);
    if (!orgId) return;
    const { keyName, environment, scopes } = req.body;

    if (typeof keyName !== 'string' || !keyName.trim() || keyName.trim().length > 80) {
      return res.status(400).json({ error: 'keyName must be between 1 and 80 characters.' });
    }

    if (environment !== undefined && !['LIVE', 'TEST'].includes(environment)) {
      return res.status(400).json({ error: 'environment must be LIVE or TEST.' });
    }
    const allowedScopes = ['orders:read', 'orders:write', 'printers:read', 'printers:spool', 'ledger:read', 'webhooks:manage'];
    const requestedScopes = scopes === undefined ? ['orders:read', 'orders:write', 'printers:read'] : scopes;
    if (!Array.isArray(requestedScopes) || requestedScopes.length < 1 || requestedScopes.length > allowedScopes.length ||
        requestedScopes.some((scope: unknown) => typeof scope !== 'string' || !allowedScopes.includes(scope)) ||
        new Set(requestedScopes).size !== requestedScopes.length) {
      return res.status(400).json({ error: 'scopes must be a non-empty list of supported, unique permissions.' });
    }
    const env = environment === 'LIVE' ? 'LIVE' : 'TEST';
    const prefix = env === 'LIVE' ? 'ink_live_' : 'ink_test_';
    const secretRandom = crypto.randomBytes(16).toString('hex');
    const fullKey = `${prefix}${secretRandom}`;
    const secretHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    const keyRecord: DeveloperKeyRecord = {
      id: `key-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      organizationId: orgId,
      keyName: keyName.trim(),
      keyPrefix: prefix,
      secretHash,
      scopes: requestedScopes,
      environment: env,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.agentRepo.createDeveloperKey(keyRecord);

    const { secretHash: _secretHash, ...safeKey } = keyRecord;
    res.status(201).json({
      success: true,
      key: safeKey,
      apiKeySecret: fullKey, // Only shown once at creation
    });
  };

  public revokeKey = (req: Request, res: Response) => {
    const orgId = this.organizationId(req, res);
    if (!orgId) return;
    const id = String(req.params.id);

    this.agentRepo.revokeDeveloperKey(id, orgId);
    res.json({ success: true, message: `Key ${id} revoked` });
  };

  public getWebhooks = (req: Request, res: Response) => {
    const orgId = this.organizationId(req, res);
    if (!orgId) return;
    const webhooks = this.agentRepo.getWebhooksByOrg(orgId).map(({ secret: _secret, ...webhook }) => webhook);
    res.json(webhooks);
  };

  public createWebhook = (req: Request, res: Response) => {
    const orgId = this.organizationId(req, res);
    if (!orgId) return;
    const { targetUrl, eventTypes } = req.body;
    const normalizedUrl = normalizeWebhookUrl(targetUrl);
    const requestedEvents = eventTypes === undefined ? ['order.created', 'order.status_changed'] : eventTypes;
    if (!normalizedUrl) return res.status(400).json({ error: 'targetUrl must be a valid HTTPS URL on a non-local hostname.' });
    if (!Array.isArray(requestedEvents) || requestedEvents.length < 1 || requestedEvents.length > WEBHOOK_EVENT_TYPES.length ||
        requestedEvents.some((event: unknown) => typeof event !== 'string' || !WEBHOOK_EVENT_TYPES.includes(event)) ||
        new Set(requestedEvents).size !== requestedEvents.length) {
      return res.status(400).json({ error: 'eventTypes must contain supported, unique webhook events.' });
    }

    const webhookSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
    let encryptedSecret: string;
    try {
      encryptedSecret = encryptWebhookSecret(webhookSecret);
    } catch {
      return res.status(503).json({ error: 'Webhook secret encryption is not configured. Contact the platform administrator.' });
    }
    const sub: WebhookSubscriptionRecord = {
      id: `whk-${Date.now().toString(36)}`,
      organizationId: orgId,
      targetUrl: normalizedUrl,
      secret: encryptedSecret,
      eventTypes: requestedEvents,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.agentRepo.createWebhookSubscription(sub);
    const { secret: _encryptedSecret, ...subscription } = sub;
    res.status(201).json({ ...subscription, webhookSecret });
  };

  public testWebhook = (req: Request, res: Response) => {
    const supportedEvents = ['order.created', 'order.status_changed', 'payment.succeeded', 'print_job.jammed', 'spooler.offline'];
    const requestedEvent = String(req.body?.eventType || 'order.status_changed');
    const eventType = supportedEvents.includes(requestedEvent) ? requestedEvent : 'order.status_changed';
    const testPayload = {
      eventId: 'evt_preview_synthetic',
      eventType,
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ord_example',
        orderNumber: 'INK-EXAMPLE-0001',
        status: 'READY_FOR_COLLECTION',
      },
    };

    res.json({
      mode: 'PREVIEW_ONLY',
      delivered: false,
      payload: testPayload,
      message: 'Synthetic payload preview generated. No webhook request was sent or signed.',
    });
  };
}
