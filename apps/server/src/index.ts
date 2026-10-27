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

export function createApp(db?: DatabaseService): express.Express {
  assertSessionSecretConfigured();
  const app = express();
  const allowedOrigins = new Set((process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000,https://inklly.vercel.app,https://inklly.in')
    .split(',').map((origin) => origin.trim()).filter(Boolean));
  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  }));
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
    });
  });

  // Website Enquiry Endpoint
  app.post('/api/v1/enquiry', (req, res) => {
    console.log('[Inklly Server] New Website Enquiry received:', req.body);
    res.status(201).json({
      success: true,
      message: 'Enquiry received successfully. Our team will contact you shortly.',
      data: req.body,
    });
  });

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
