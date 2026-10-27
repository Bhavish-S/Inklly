import express from 'express';
import cors from 'cors';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { DatabaseService, seedDatabase } from '@inklly/db';
import { createPortalRoutes } from './routes/portal-routes';
import { createAuthRoutes } from './routes/auth-routes';
import { createMerchantRoutes } from './routes/merchant-routes';
import { createPaymentRoutes } from './routes/payment-routes';
import { createAgentRoutes } from './routes/agent-routes';
import { createAdminRoutes } from './routes/admin-routes';
import { createDeveloperRoutes } from './routes/developer-routes';
import { assertSessionSecretConfigured } from './middleware/session-token';
import { purgeExpiredPrintFiles } from './services/print-file-retention';
import { PrivateFileStorage } from './services/private-file-storage';
import { createPublicUploadConcurrencyGuard } from './middleware/public-upload-guard';
import { EnquiryRepository } from '@inklly/db';
import { EnquiryController } from './controllers/enquiry-controller';
import { createEnquiryRateLimit } from './middleware/enquiry-rate-limit';

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
  const maxConcurrentUploads = Number(process.env.MAX_CONCURRENT_PUBLIC_UPLOADS) || 2;
  // This must run before express.json so capacity-rejected uploads do not
  // allocate/decode large base64 request bodies first.
  app.use('/api/v1/portal/upload', createPublicUploadConcurrencyGuard(maxConcurrentUploads));
  app.use(express.json({
    limit: `${Math.max(1, Math.min(35, Number(process.env.MAX_FILE_SIZE_MB) || 25)) * 2}mb`,
    verify: (req, _res, buffer) => {
      if (req.url?.startsWith('/api/v1/payments/webhook/')) (req as any).rawBody = Buffer.from(buffer);
    },
  }));

  // Customer files use private storage; production refuses ephemeral local-disk fallback.
  const downloadsDir = path.join(process.cwd(), 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
  // Public downloads are deliberately disabled. Agent installers need an owner-scoped flow.

  const database = db || DatabaseService.getInstance(process.env.DATABASE_URL || process.env.DB_PATH || path.join(process.cwd(), 'data', 'inklly.db'));
  const fileStorage = new PrivateFileStorage();
  app.locals.privateFileStorage = fileStorage;
  seedDatabase(database);
  const retentionTimer = setInterval(() => {
    void purgeExpiredPrintFiles(database, fileStorage).catch((error) => console.error('[File retention] Cleanup pass failed', error));
  }, 15 * 60 * 1000);
  retentionTimer.unref();
  void purgeExpiredPrintFiles(database, fileStorage).catch((error) => console.error('[File retention] Initial cleanup pass failed', error));

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
  app.post('/api/v1/enquiry', createEnquiryRateLimit(), enquiryController.submit);

  // Mount API routers
  app.use('/api/v1/portal', createPortalRoutes(database, fileStorage));
  app.use('/api/v1/auth', createAuthRoutes(database));
  app.use('/api/v1/merchant', createMerchantRoutes(database, fileStorage));
  app.use('/api/v1/payments', createPaymentRoutes(database));
  app.use('/api/v1/agent', createAgentRoutes(database, fileStorage));
  app.use('/api/v1/platform', createAdminRoutes(database));
  app.use('/api/v1/developer', createDeveloperRoutes(database));

  // Global Error Handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Inklly Server Error]:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });

  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  const app = createApp();
  void app.locals.privateFileStorage.verifyReady().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 [Inklly Server] listening on port ${PORT}`);
      console.log(`📄 [QR Portal] /api/v1/portal/shop/:shop_code`);
      console.log(`⚙️  [Merchant API] /api/v1/merchant/dashboard`);
      console.log(`🔌 [Agent Poll] /api/v1/agent/poll-commands`);
    });
  }).catch((error: any) => {
    console.error('[Inklly Startup] Private file storage is not ready:', error.message || error);
    process.exitCode = 1;
  });
}
