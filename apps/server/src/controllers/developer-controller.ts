import { Request, Response } from 'express';
import * as crypto from 'node:crypto';
import { isIP } from 'node:net';
import { AgentRepository, DeveloperKeyRecord, WebhookSubscriptionRecord } from '@inklly/db';
import { encryptWebhookSecret } from '../services/webhook-secrets';

const WEBHOOK_EVENT_TYPES = ['order.created', 'order.status_changed', 'payment.succeeded'];

const MERCHANT_ROUTE_DOCUMENTATION: Array<{ path: string; method: string; summary: string; access: string }> = [
  { path: '/merchant/dashboard', method: 'get', summary: 'Get merchant dashboard data', access: 'Requires orders:view.' },
  { path: '/merchant/orders', method: 'get', summary: 'List merchant orders', access: 'Requires orders:view.' },
  { path: '/merchant/orders/{id}', method: 'get', summary: 'Get a merchant order', access: 'Requires orders:view.' },
  { path: '/merchant/orders/{id}/files/{fileId}', method: 'get', summary: 'Download a private order file', access: 'Requires orders:view and order/file ownership.' },
  { path: '/merchant/orders/{id}/status', method: 'patch', summary: 'Update merchant order status', access: 'Requires orders:process.' },
  { path: '/merchant/orders/{id}/reconcile-output', method: 'post', summary: 'Confirm physically inspected print output', access: 'Requires orders:process and an audited operator confirmation.' },
  { path: '/merchant/orders/{id}/print', method: 'post', summary: 'Release a merchant order to printing', access: 'Requires live_print:manage.' },
  { path: '/merchant/agents/pairing-code', method: 'post', summary: 'Create a desktop-agent pairing code', access: 'Restricted to MERCHANT_OWNER.' },
  { path: '/merchant/agents/{id}', method: 'delete', summary: 'Revoke a registered desktop agent', access: 'Restricted to MERCHANT_OWNER.' },
  { path: '/merchant/rates', method: 'get', summary: 'Get shop rate rules', access: 'Requires settings:view.' },
  { path: '/merchant/rates', method: 'put', summary: 'Update a shop rate rule', access: 'Requires settings:manage.' },
  { path: '/merchant/discounts/bulk', method: 'put', summary: 'Update the shop bulk discount', access: 'Requires settings:manage.' },
  { path: '/merchant/printers', method: 'get', summary: 'List shop printers', access: 'Requires printers:view.' },
  { path: '/merchant/printers', method: 'post', summary: 'Add a shop printer', access: 'Requires printers:manage.' },
  { path: '/merchant/printers/{id}/default', method: 'put', summary: 'Set the default shop printer', access: 'Requires printers:manage.' },
  { path: '/merchant/settings', method: 'get', summary: 'Get shop settings', access: 'Requires settings:view.' },
  { path: '/merchant/settings', method: 'put', summary: 'Update shop settings', access: 'Requires settings:manage; merchant owners receive this permission implicitly.' },
  { path: '/merchant/settings/razorpay', method: 'get', summary: 'Get Razorpay credential configuration status', access: 'Restricted to MERCHANT_OWNER.' },
  { path: '/merchant/settings/razorpay', method: 'put', summary: 'Save Razorpay credentials', access: 'Restricted to MERCHANT_OWNER.' },
  { path: '/merchant/settings/razorpay/test', method: 'post', summary: 'Test configured Razorpay credentials', access: 'Restricted to MERCHANT_OWNER.' },
  { path: '/merchant/settings/razorpay', method: 'delete', summary: 'Remove Razorpay credentials', access: 'Restricted to MERCHANT_OWNER.' },
  { path: '/merchant/staff', method: 'get', summary: 'List shop staff', access: 'Restricted to MERCHANT_OWNER or SHOP_MANAGER.' },
  { path: '/merchant/staff', method: 'post', summary: 'Invite shop staff', access: 'Restricted to MERCHANT_OWNER.' },
  { path: '/merchant/staff/{userId}', method: 'put', summary: 'Update or revoke shop staff access', access: 'Owner-only; tenant-scoped, allowlisted permissions, and audited. Changes apply on the next request.' },
  { path: '/merchant/bot-templates', method: 'get', summary: 'List shop message templates', access: 'Requires bot:train.' },
  { path: '/merchant/bot-templates', method: 'put', summary: 'Update a shop message template', access: 'Requires bot:train.' },
  { path: '/merchant/credits/balance', method: 'get', summary: 'Get shop conversion-credit balance', access: 'Requires credits:view.' },
  { path: '/merchant/credits/purchase', method: 'post', summary: 'Request a conversion-credit purchase', access: 'Requires credits:manage.' },
  { path: '/merchant/payouts', method: 'get', summary: 'List shop payout requests', access: 'Requires finance:view.' },
  { path: '/merchant/payouts', method: 'post', summary: 'Request a shop payout', access: 'Requires finance:manage.' },
  { path: '/merchant/storage/categories', method: 'get', summary: 'List storage categories', access: 'Requires storage:view.' },
  { path: '/merchant/storage/categories', method: 'post', summary: 'Create a storage category', access: 'Requires storage:manage.' },
  { path: '/merchant/storage/categories/{id}', method: 'delete', summary: 'Delete a storage category', access: 'Requires storage:manage.' },
  { path: '/merchant/storage/documents', method: 'post', summary: 'Upload a private shop storage document', access: 'Requires storage:manage.' },
  { path: '/merchant/storage/documents', method: 'get', summary: 'List stored documents', access: 'Requires storage:view.' },
  { path: '/merchant/storage/documents/{id}/download', method: 'get', summary: 'Download a stored document', access: 'Requires storage:view and document ownership.' },
  { path: '/merchant/storage/documents/{id}', method: 'delete', summary: 'Delete a stored document', access: 'Requires storage:manage.' },
  { path: '/merchant/whatsapp/setup', method: 'get', summary: 'Get WhatsApp setup availability', access: 'Restricted to MERCHANT_OWNER or SHOP_MANAGER.' },
  { path: '/merchant/whatsapp/setup', method: 'post', summary: 'Save WhatsApp setup', access: 'Restricted to MERCHANT_OWNER or SHOP_MANAGER; currently returns unavailable until Meta onboarding is configured.' },
  { path: '/merchant/whatsapp/qr-pairing', method: 'post', summary: 'Start WhatsApp QR pairing', access: 'Restricted to MERCHANT_OWNER or SHOP_MANAGER; currently unavailable.' },
  { path: '/merchant/whatsapp/qr-pairing/refresh', method: 'post', summary: 'Refresh WhatsApp QR pairing', access: 'Restricted to MERCHANT_OWNER or SHOP_MANAGER; currently unavailable.' },
  { path: '/merchant/whatsapp/account/{id}', method: 'delete', summary: 'Remove a WhatsApp account', access: 'Restricted to MERCHANT_OWNER.' },
  { path: '/merchant/whatsapp/events', method: 'get', summary: 'List WhatsApp setup events', access: 'Restricted to MERCHANT_OWNER or SHOP_MANAGER.' },
];

function buildMerchantOpenApiPaths(): Record<string, Record<string, unknown>> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of MERCHANT_ROUTE_DOCUMENTATION) {
    const operation: Record<string, unknown> = {
      summary: route.summary,
      description: `Requires an authenticated tenant session, tenant isolation, and an active subscription. ${route.access}`,
      security: [{ bearerAuth: [] }],
      responses: { default: { description: 'Response status and body are defined by the route handler.' } },
    };
    const pathParameters = [...route.path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    if (pathParameters.length) operation.parameters = pathParameters;
    paths[route.path] ??= {};
    paths[route.path][route.method] = operation;
  }
  return paths;
}

function buildSubscriptionOpenApiPaths(): Record<string, Record<string, unknown>> {
  return {
    '/subscriptions/plans': {
      get: {
        summary: 'List planned subscription tiers',
        description: 'Public catalog only. Returned tiers are not purchasable and contain no active pilot prices.',
        responses: { 200: { description: 'Planned tiers; no active pricing is returned.' } },
      },
    },
    '/subscriptions/usage': {
      get: {
        summary: 'Read operator-confirmed print-side usage for the current period',
        description: 'Requires an authenticated MERCHANT_OWNER session. Reports selected document pages multiplied by copies after operator confirmation. This is metering only and does not create a charge.',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Organization-scoped usage totals.' }, 401: { description: 'Authentication required.' }, 403: { description: 'Merchant owner role and organization membership required.' } },
      },
    },
    '/subscriptions/checkout': {
      post: {
        summary: 'Create a subscription checkout',
        description: 'Requires an authenticated MERCHANT_OWNER session and Idempotency-Key. Amount and organization come from the effective organization tariff and session; Razorpay orders are created with platform credentials. Subscription activation happens only after Razorpay confirms capture.',
        parameters: [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 16, maxLength: 128 } }],
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['planId'], properties: { planId: { type: 'string', enum: ['plan-starter', 'plan-growth', 'plan-pro', 'plan-scale'] } } } } } },
        responses: { 201: { description: 'Razorpay subscription order and durable pending attempt created.' }, 200: { description: 'Existing order returned for idempotent retry.' }, 400: { description: 'Invalid plan or idempotency key.' }, 409: { description: 'An active subscription or unresolved billing attempt prevents another checkout.' }, 503: { description: 'Platform billing is not configured or order creation outcome is uncertain.' } },
      },
    },
    '/subscriptions/verify': {
      post: {
        summary: 'Verify a subscription payment',
        description: 'Requires an authenticated MERCHANT_OWNER session. Validates the Razorpay checkout HMAC and fetches payment status from Razorpay; activates the subscription only for a matching captured payment.',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'], properties: { razorpay_order_id: { type: 'string' }, razorpay_payment_id: { type: 'string' }, razorpay_signature: { type: 'string' } } } } } },
        responses: { 200: { description: 'Captured payment applied or idempotent confirmation returned.' }, 401: { description: 'Checkout signature is invalid.' }, 409: { description: 'Payment is not captured or does not match the order.' }, 503: { description: 'Razorpay could not be queried safely.' } },
      },
    },
    '/subscriptions/billing/readiness': {
      get: { summary: 'Read tenant-scoped billing readiness', description: 'Merchant-owner only. Reports platform Razorpay configuration readiness and this organization tariff; does not expose credentials.', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Readiness, tariff, subscription state, and manual usage statement status.' }, 403: { description: 'Merchant owner membership required.' } } },
    },
    '/subscriptions/billing/attempts': {
      get: { summary: 'List this organization subscription payment attempts', description: 'Merchant-owner only; organization scope is derived from the session.', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Recent attempts without secrets or raw webhook payloads.' } } },
    },
    '/subscriptions/webhook/razorpay': {
      post: { summary: 'Receive platform Razorpay webhook events', description: 'Public Razorpay endpoint. Verifies X-Razorpay-Signature against the exact raw request body and deduplicates X-Razorpay-Event-Id. Handles payment.captured and order.paid; only captured payments matching an Inklly order can activate a subscription.', parameters: [{ name: 'X-Razorpay-Signature', in: 'header', required: true, schema: { type: 'string' } }, { name: 'X-Razorpay-Event-Id', in: 'header', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Event accepted, ignored, or identified as duplicate.' }, 400: { description: 'Malformed body or missing event id.' }, 401: { description: 'Invalid webhook signature.' }, 503: { description: 'Platform webhook secret is not configured.' } } },
    },
    '/platform/billing/attempts': {
      get: { summary: 'List platform subscription payment attempts', description: 'Requires billing:view. Optional organizationId filters results.', security: [{ bearerAuth: [] }], parameters: [{ name: 'organizationId', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Recent attempts; no credentials or raw payloads are returned.' }, 403: { description: 'Platform billing:view permission required.' } } },
    },
    '/platform/billing/attempts/{id}/reconcile': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: { summary: 'Reconcile an uncertain platform checkout', description: 'Requires billing:manage. For CREATE_UNCERTAIN, provide the order ID and the server confirms its receipt, amount, and currency directly with Razorpay before associating it. Optionally provide a payment ID; the server fetches it and applies only a matching captured payment. Pending or uncertain payments never activate a subscription.', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { providerOrderId: { type: 'string' }, providerPaymentId: { type: 'string' } } } } } }, responses: { 200: { description: 'Attempt remains pending capture or a captured payment was safely applied.' }, 400: { description: 'Required provider order ID is missing.' }, 409: { description: 'Provider records do not match this attempt.' }, 503: { description: 'Razorpay is unavailable or platform credentials are missing.' } } },
    },
  };
}

function normalizeWebhookUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password || url.hash || isIP(hostname) || !hostname.includes('.') ||
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
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Signed Inklly user session token. Merchant API calls are tenant-scoped to the session membership.',
          },
        },
      },
      servers,
      paths: {
        '/auth/me': {
          get: { summary: 'Read the authenticated account profile', security: [{ bearerAuth: [] }], responses: { 200: { description: 'User, active tenant, and subscription details; password hashes are never returned.' }, 401: { description: 'Authentication required.' } } },
          put: {
            summary: 'Update the authenticated account name and phone number',
            description: 'Email changes require a separate verification flow and cannot be made through this operation. Profile changes are audited.',
            security: [{ bearerAuth: [] }],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: false, required: ['fullName', 'phone'], properties: { fullName: { type: 'string', minLength: 1, maxLength: 120 }, phone: { type: 'string', nullable: true, maxLength: 24 } } } } } },
            responses: { 200: { description: 'Updated profile, excluding secret fields.' }, 400: { description: 'Invalid fields or values.' }, 401: { description: 'Authentication required.' } },
          },
        },
        '/auth/password': {
          put: {
            summary: 'Change the authenticated account password',
            description: 'Requires the current password. The new password must be at least 12 characters with upper and lower case letters, a number, and a symbol. All other active sessions are revoked; the current session remains active.',
            security: [{ bearerAuth: [] }],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: false, required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string', minLength: 1, maxLength: 1024 }, newPassword: { type: 'string', minLength: 12, maxLength: 1024 } } } } } },
            responses: { 200: { description: 'Password updated and other active sessions revoked.' }, 400: { description: 'Password policy not met.' }, 401: { description: 'Current password is incorrect or session is invalid.' } },
          },
        },
        '/developer/webhooks': {
          get: { summary: 'List active organization webhook subscriptions', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Tenant-scoped subscriptions; secrets are omitted.' } } },
          post: { summary: 'Create a signed webhook subscription', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Subscription and one-time webhook secret.' }, 400: { description: 'Invalid HTTPS destination or event type.' } } },
        },
        '/developer/webhooks/{id}': {
          delete: { summary: 'Revoke an organization webhook destination', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Destination revoked and pending deliveries cancelled.' }, 404: { description: 'Subscription not found.' } } },
        },
        '/developer/webhooks/{id}/rotate-secret': {
          post: { summary: 'Rotate a webhook signing secret', security: [{ bearerAuth: [] }], responses: { 200: { description: 'New signing secret returned once.' }, 409: { description: 'Wait for active attempts before rotating.' } } },
        },
        '/developer/webhooks/{id}/deliveries': {
          get: {
            summary: 'List persisted delivery attempts for a webhook subscription',
            description: 'Organization-scoped history. Events are signed with X-Inklly-Signature (timestamped HMAC SHA-256), sent only to pinned public HTTPS addresses, and retried with bounded backoff.',
            security: [{ bearerAuth: [] }],
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
              { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
              { name: 'offset', in: 'query', required: false, schema: { type: 'integer', minimum: 0 } },
            ],
            responses: { 200: { description: 'Persisted delivery records and attempts.' }, 404: { description: 'Subscription not found in the active organization.' } },
          },
        },
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
        '/subscriptions/invoices': {
          get: {
            summary: 'List issued pilot invoices for the authenticated merchant organization',
            description: 'Merchant-owner only. Statements are immutable INR Paise snapshots and remain manual-pending; this endpoint never records payment.',
            security: [{ bearerAuth: [] }],
            responses: { 200: { description: 'Invoices belonging only to the authenticated organization.' }, 401: { description: 'Authentication required.' }, 403: { description: 'Merchant owner role required.' } },
          },
        },
        '/platform/billing/organizations/{organizationId}/tariffs': {
          parameters: [{ name: 'organizationId', in: 'path', required: true, schema: { type: 'string' } }],
          get: { summary: 'List effective-dated pilot billing tariffs for an organization', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Append-only tariff history.' }, 403: { description: 'Platform billing:view permission required.' } } },
          post: { summary: 'Add a month-effective pilot billing tariff', security: [{ bearerAuth: [] }], requestBody: { required: true }, responses: { 201: { description: 'Tariff recorded in integer Paise.' }, 400: { description: 'Invalid month or amount.' }, 409: { description: 'Tariff is not later than the current schedule.' } } },
        },
        '/platform/billing/invoices': {
          get: { summary: 'List pilot invoices', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Issued immutable invoice snapshots; no payment data is implied.' } } },
          post: { summary: 'Issue an idempotent monthly pilot invoice from confirmed print-side usage', description: 'Requires an active organization and completed calendar month. Uses the effective tariff and append-only operator-confirmed usage. Does not charge the merchant or write a customer-payment ledger entry.', security: [{ bearerAuth: [] }], requestBody: { required: true }, responses: { 201: { description: 'Invoice issued.' }, 200: { description: 'Existing invoice returned for an idempotent replay.' }, 409: { description: 'The organization, tariff schedule, or period is not invoiceable.' } } },
        },
        '/platform/admins': {
          get: { summary: 'List platform admin accounts and their current permissions', description: 'Platform-owner only. Does not return credentials or session data.', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Platform admin accounts.' }, 403: { description: 'Platform owner role required.' } } },
        },
        '/platform/admins/{id}/permissions': {
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          put: { summary: 'Replace a platform admin permission grant list', description: 'Platform-owner only. Permission changes take effect on the next request and are audited.', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['permissions'], properties: { permissions: { type: 'array', uniqueItems: true, items: { type: 'string', enum: ['platform:view', 'platform:manage', 'support:view', 'support:manage', 'finance:view', 'security:audit', 'billing:view', 'billing:manage'] } } } } } } }, responses: { 200: { description: 'Current platform permissions.' }, 400: { description: 'Unknown or duplicate permission.' }, 403: { description: 'Platform owner role required.' }, 404: { description: 'Platform admin not found.' } } },
        },
        '/platform/incidents/assignees': {
          get: { summary: 'List active platform administrator incident assignees', description: 'Requires support:manage. Only active platform owner and administrator identities are returned.', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Active incident assignees as { assignees: [{ id, fullName, email }] }.' }, 403: { description: 'support:manage permission required.' } } },
        },
        '/platform/incidents': {
          get: { summary: 'List persisted platform incidents', description: 'Requires support:view or support:manage. Stable cursor pagination orders by creation time and ID.', security: [{ bearerAuth: [] }], parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'] } },
            { name: 'severity', in: 'query', schema: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
          ], responses: { 200: { description: 'Persisted incidents and stable pagination cursor.' }, 400: { description: 'Invalid filter or cursor.' }, 403: { description: 'Platform support permission required.' } } },
          post: { summary: 'Create a persistent platform incident', description: 'Requires support:manage. Optional organization, shop, order, and agent references are checked for ownership consistency. Mutations are transactionally audited.', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title', 'description', 'severity'], properties: { title: { type: 'string', minLength: 1, maxLength: 160 }, description: { type: 'string', minLength: 1, maxLength: 4000 }, severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] }, organizationId: { type: 'string', nullable: true }, shopId: { type: 'string', nullable: true }, orderId: { type: 'string', nullable: true }, agentId: { type: 'string', nullable: true }, assignedToUserId: { type: 'string', nullable: true }, resolutionNotes: { type: 'string', maxLength: 4000 } } } } } }, responses: { 201: { description: 'Created incident.' }, 400: { description: 'Invalid incident fields.' }, 403: { description: 'support:manage permission required.' }, 422: { description: 'References are missing or belong to inconsistent tenants.' } } },
        },
        '/platform/incidents/{id}': {
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          patch: { summary: 'Update, assign, resolve, close, or reopen a platform incident', description: 'Requires support:manage. Transitions to resolved or closed require non-empty resolutionNotes. Every mutation is transactionally audited.', security: [{ bearerAuth: [] }], requestBody: { required: true }, responses: { 200: { description: 'Updated incident.' }, 400: { description: 'Invalid incident fields.' }, 403: { description: 'support:manage permission required.' }, 404: { description: 'Incident not found.' }, 409: { description: 'Invalid status transition or concurrent update.' }, 422: { description: 'Invalid reference relationship or missing resolution notes.' } } },
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
        ...buildMerchantOpenApiPaths(),
        ...buildSubscriptionOpenApiPaths(),
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
    const shopId = req.user?.shopId;
    if (!shopId) return res.status(403).json({ error: 'An active shop membership is required to create an API key.' });
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
      shopId,
      createdByUserId: req.user!.userId,
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

  public getWebhookDeliveries = (req: Request, res: Response) => {
    const orgId = this.organizationId(req, res);
    if (!orgId) return;
    const subscriptionId = String(req.params.id || '');
    if (!this.agentRepo.hasWebhookSubscription(subscriptionId, orgId)) {
      return res.status(404).json({ error: 'Webhook subscription not found.' });
    }
    const rawLimit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    const rawOffset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100 || !Number.isInteger(rawOffset) || rawOffset < 0) {
      return res.status(400).json({ error: 'limit must be 1–100 and offset must be a non-negative integer.' });
    }
    return res.json(this.agentRepo.listWebhookDeliveries(orgId, subscriptionId, rawLimit, rawOffset));
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
      id: `whk-${crypto.randomUUID()}`,
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

  public rotateWebhookSecret = (req: Request, res: Response) => {
    const orgId = this.organizationId(req, res);
    if (!orgId) return;
    const subscriptionId = String(req.params.id || '');
    const webhookSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
    let encryptedSecret: string;
    try { encryptedSecret = encryptWebhookSecret(webhookSecret); }
    catch { return res.status(503).json({ error: 'Webhook secret encryption is not configured.' }); }
    const outcome = this.agentRepo.rotateWebhookSecret(subscriptionId, orgId, encryptedSecret);
    if (outcome === 'NOT_FOUND') return res.status(404).json({ error: 'Webhook subscription not found.' });
    if (outcome === 'IN_PROGRESS') return res.status(409).json({ error: 'Wait for active webhook attempts to finish before rotating this secret.' });
    return res.json({ subscriptionId, webhookSecret, rotatedAt: new Date().toISOString() });
  };

  public revokeWebhook = (req: Request, res: Response) => {
    const orgId = this.organizationId(req, res);
    if (!orgId) return;
    const revoked = this.agentRepo.revokeWebhookSubscription(String(req.params.id || ''), orgId);
    if (!revoked) return res.status(404).json({ error: 'Webhook subscription not found.' });
    return res.json({ revoked: true });
  };

  public testWebhook = (req: Request, res: Response) => {
    const supportedEvents = WEBHOOK_EVENT_TYPES;
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
