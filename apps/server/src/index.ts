import express from 'express';
import cors from 'cors';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { AgentRepository, DatabaseService, seedDatabase } from '@inklly/db';
import { createPortalRoutes } from './routes/portal-routes';
import { createAuthRoutes } from './routes/auth-routes';
import { createMerchantRoutes } from './routes/merchant-routes';
import { createPaymentRoutes } from './routes/payment-routes';
import { createAgentRoutes } from './routes/agent-routes';
import { createAdminRoutes } from './routes/admin-routes';
import { createDeveloperRoutes } from './routes/developer-routes';
import { createSubscriptionRoutes } from './routes/subscription-routes';
import { assertSessionSecretConfigured } from './middleware/session-token';
import { purgeExpiredPrintFiles } from './services/print-file-retention';
import { purgePendingVaultDeletions } from './services/merchant-vault-retention';
import { PrivateFileStorage } from './services/private-file-storage';
import { createUploadConcurrencyGuard } from './middleware/public-upload-guard';
import { createPublicUploadRateLimit } from './middleware/public-upload-rate-limit';
import { authenticate, enforceTenantIsolation, requireActiveSubscription, requirePermission } from './middleware/auth';
import { EnquiryRepository } from '@inklly/db';
import { EnquiryController } from './controllers/enquiry-controller';
import { createEnquiryRateLimit } from './middleware/enquiry-rate-limit';
import { WebhookDeliveryWorker } from './services/webhook-delivery';

export function createApp(db?: DatabaseService): express.Express {
  assertSessionSecretConfigured();
  const app = express();
  // Render terminates TLS and forwards one proxy hop. Trust that hop so
  // IP-based public form limits use the originating client address.
  app.set('trust proxy', 1);
  const allowedOrigins = new Set((process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000,https://inklly.vercel.app,https://inklly.in')
    .split(',').map((origin) => origin.trim()).filter(Boolean));
  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  }));
  const database = db || DatabaseService.getInstance(process.env.DATABASE_URL || process.env.DB_PATH || path.join(process.cwd(), 'data', 'inklly.db'));
  const maxConcurrentUploads = Number(process.env.MAX_CONCURRENT_PUBLIC_UPLOADS) || 2;
  const uploadCapacityGuard = createUploadConcurrencyGuard(maxConcurrentUploads);
  const publicUploadRateLimit = createPublicUploadRateLimit(database);
  const maxFileSizeMb = Math.max(1, Math.min(35, Number(process.env.MAX_FILE_SIZE_MB) || 25));
  const fileUploadJsonParser = express.json({ limit: `${maxFileSizeMb * 2}mb` });

  // Large base64 bodies are accepted only on the two file-upload routes. The
  // merchant vault checks the persisted session, tenant, subscription, and
  // permission before parsing; both routes share one in-flight capacity cap.
  app.post('/api/v1/portal/upload', uploadCapacityGuard, publicUploadRateLimit, fileUploadJsonParser);
  app.post(
    '/api/v1/merchant/storage/documents',
    uploadCapacityGuard,
    authenticate(database),
    enforceTenantIsolation,
    requireActiveSubscription(database),
    requirePermission('storage:manage'),
    fileUploadJsonParser
  );
  app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buffer) => {
      if (req.url?.startsWith('/api/v1/payments/webhook/') || req.url?.startsWith('/api/v1/subscriptions/webhook/razorpay')) {
        (req as any).rawBody = Buffer.from(buffer);
      }
    },
  }));

  // Customer files use private storage; production refuses ephemeral local-disk fallback.
  const downloadsDir = path.join(process.cwd(), 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
  // Public downloads are deliberately disabled. Agent installers need an owner-scoped flow.

  const fileStorage = new PrivateFileStorage();
  app.locals.privateFileStorage = fileStorage;
  seedDatabase(database);
  const retentionTimer = setInterval(() => {
    void purgeExpiredPrintFiles(database, fileStorage).catch((error) => console.error('[File retention] Cleanup pass failed', error));
  }, 15 * 60 * 1000);
  retentionTimer.unref();
  void purgeExpiredPrintFiles(database, fileStorage).catch((error) => console.error('[File retention] Initial cleanup pass failed', error));
  const vaultDeletionTimer = setInterval(() => {
    void purgePendingVaultDeletions(database, fileStorage).catch((error) => console.error('[Vault deletion] Cleanup pass failed', error));
  }, 60 * 1000);
  vaultDeletionTimer.unref();
  void purgePendingVaultDeletions(database, fileStorage).catch((error) => console.error('[Vault deletion] Initial cleanup pass failed', error));

  app.get(['/health', '/api/v1/health'], (_req, res) => {
    res.json({
      status: 'HEALTHY',
      service: 'Inklly Backend Server',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      // Render provides this SHA for each deployed service revision. Returning
      // it makes runtime/deployment verification possible without exposing
      // configuration or secret values.
      revision: process.env.RENDER_GIT_COMMIT || null,
    });
  });

  // Public marketing enquiries are validated and stored without logging PII.
  const enquiryController = new EnquiryController(new EnquiryRepository(database));
  app.post('/api/v1/enquiry', createEnquiryRateLimit(database), enquiryController.submit);

  // Mount API routers
  app.use('/api/v1/portal', createPortalRoutes(database, fileStorage));
  app.use('/api/v1/auth', createAuthRoutes(database));
  app.use('/api/v1/merchant', createMerchantRoutes(database, fileStorage));
  app.use('/api/v1/payments', createPaymentRoutes(database));
  app.use('/api/v1/agent', createAgentRoutes(database, fileStorage));
  app.use('/api/v1/platform', createAdminRoutes(database, fileStorage));
  app.use('/api/v1/developer', createDeveloperRoutes(database));
  app.use('/api/v1/subscriptions', createSubscriptionRoutes(database));

  // Global Error Handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      return res.status(413).json({ error: 'Request body is too large.' });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body must contain valid JSON.' });
    }
    const requestId = crypto.randomUUID();
    // Keep provider credentials, database details, and stack traces out of API
    // responses while giving operators a stable correlation handle.
    console.error(`[Inklly Server Error] requestId=${requestId}`, err);
    res.status(500).json({ error: 'Internal Server Error', requestId });
  });

  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  const app = createApp();
  void app.locals.privateFileStorage.verifyReady().then(() => {
    const webhookWorker = new WebhookDeliveryWorker(new AgentRepository(DatabaseService.getInstance()));
    webhookWorker.start();
    const server = app.listen(PORT, () => {
      console.log(`🚀 [Inklly Server] listening on port ${PORT}`);
      console.log(`📄 [QR Portal] /api/v1/portal/shop/:shop_code`);
      console.log(`⚙️  [Merchant API] /api/v1/merchant/dashboard`);
      console.log(`🔌 [Agent Poll] /api/v1/agent/poll-commands`);
    });
    const shutdown = () => {
      webhookWorker.stop();
      server.close(() => process.exit(0));
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }).catch((error: any) => {
    console.error('[Inklly Startup] Private file storage is not ready:', error.message || error);
    process.exitCode = 1;
  });
}
