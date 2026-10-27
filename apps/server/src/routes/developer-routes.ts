import { Router } from 'express';
import { DeveloperController } from '../controllers/developer-controller';
import { DatabaseService, AgentRepository } from '@inklly/db';
import { authenticate, requireRole } from '../middleware/auth';
import { Request, Response, NextFunction } from 'express';

export function createDeveloperRoutes(db: DatabaseService): Router {
  const router = Router();
  const agentRepo = new AgentRepository(db);
  const controller = new DeveloperController(agentRepo);

  // OpenAPI spec is public
  router.get('/openapi.json', controller.getOpenApiSpec);

  // Internal developer tools are authenticated. Merchant self-service API
  // access remains disabled until product governance, quotas, support terms,
  // and the external API security review are approved.
  const developerAccess = [authenticate, requireRole('DEVELOPER', 'MERCHANT_OWNER')];
  const externalApiGate = (_req: Request, res: Response, next: NextFunction) => {
    if (process.env.ENABLE_EXTERNAL_API_ACCESS !== 'true') {
      return res.status(403).json({
        code: 'EXTERNAL_API_ACCESS_DISABLED',
        error: 'External API key and webhook management is disabled pending product governance approval.',
      });
    }
    return next();
  };
  router.get('/keys', ...developerAccess, externalApiGate, controller.getKeys);
  router.post('/keys', ...developerAccess, externalApiGate, controller.createKey);
  router.delete('/keys/:id', ...developerAccess, externalApiGate, controller.revokeKey);

  router.get('/webhooks', ...developerAccess, externalApiGate, controller.getWebhooks);
  router.post('/webhooks', ...developerAccess, externalApiGate, controller.createWebhook);
  router.post('/test-webhook', ...developerAccess, externalApiGate, controller.testWebhook);

  return router;
}
