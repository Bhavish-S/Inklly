import { Request, Response } from 'express';
import * as crypto from 'node:crypto';
import { AgentRepository, DeveloperKeyRecord, WebhookSubscriptionRecord } from '@inklly/db';

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
    res.json({
      openapi: '3.0.3',
      info: {
        title: 'Inklly Public & Merchant API',
        version: '1.0.0',
        description:
          'Authoritative REST API specification for Inklly Print OS, customer ordering, edge agent dispatch, and automated ledgers.',
      },
      servers: [
        {
          url: 'http://localhost:4000/api/v1',
          description: 'Local Development Server',
        },
        {
          url: 'https://api.inklly.com/api/v1',
          description: 'Production Cloud Gateway',
        },
      ],
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
            requestBody: { required: true },
            responses: { 201: { description: 'Order created with tracking ID' } },
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
    const keys = this.agentRepo.getDeveloperKeysByOrg(orgId);
    res.json(keys);
  };

  public createKey = (req: Request, res: Response) => {
    const orgId = this.organizationId(req, res);
    if (!orgId) return;
    const { keyName, environment, scopes } = req.body;

    if (!keyName) {
      return res.status(400).json({ error: 'keyName is required' });
    }

    const env = environment === 'LIVE' ? 'LIVE' : 'TEST';
    const prefix = env === 'LIVE' ? 'ink_live_' : 'ink_test_';
    const secretRandom = crypto.randomBytes(16).toString('hex');
    const fullKey = `${prefix}${secretRandom}`;
    const secretHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    const keyRecord: DeveloperKeyRecord = {
      id: `key-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      organizationId: orgId,
      keyName,
      keyPrefix: prefix,
      secretHash,
      scopes: scopes || ['orders:read', 'orders:write', 'printers:read'],
      environment: env,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.agentRepo.createDeveloperKey(keyRecord);

    res.status(201).json({
      success: true,
      key: keyRecord,
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
    const orgId = req.user?.organizationId || 'org-campus-network';
    const { targetUrl, eventTypes } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: 'targetUrl is required' });
    }

    const sub: WebhookSubscriptionRecord = {
      id: `whk-${Date.now().toString(36)}`,
      organizationId: orgId,
      targetUrl,
      secret: `whsec_${crypto.randomBytes(16).toString('hex')}`,
      eventTypes: eventTypes || ['order.created', 'order.status_changed', 'print.completed'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.agentRepo.createWebhookSubscription(sub);
    const { secret: webhookSecret, ...subscription } = sub;
    res.status(201).json({ ...subscription, webhookSecret });
  };

  public testWebhook = (req: Request, res: Response) => {
    const { targetUrl } = req.body;

    // Simulate webhook dispatch payload
    const testPayload = {
      eventId: `evt_test_${Date.now()}`,
      eventType: 'order.status_changed',
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ord-test-sample',
        orderNumber: 'INK-20261025-0042',
        status: 'READY_FOR_COLLECTION',
        totalAmountPaise: 2500,
      },
    };

    res.json({
      success: true,
      simulatedTargetUrl: targetUrl || 'https://webhook.site/demo',
      dispatchedPayload: testPayload,
      statusCode: 200,
      message: 'Simulated webhook event dispatched successfully',
    });
  };
}
