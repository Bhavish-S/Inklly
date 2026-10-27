import { Router } from 'express';
import { DeveloperController } from '../controllers/developer-controller';
import { DatabaseService, AgentRepository } from '@inklly/db';
import { authenticate, requireRole } from '../middleware/auth';

export function createDeveloperRoutes(db: DatabaseService): Router {
  const router = Router();
  const agentRepo = new AgentRepository(db);
  const controller = new DeveloperController(agentRepo);

  // OpenAPI spec is public
  router.get('/openapi.json', controller.getOpenApiSpec);

  // Scoped routes require developer or merchant authentication
  const developerAccess = [authenticate, requireRole('DEVELOPER', 'MERCHANT_OWNER')];
  router.get('/keys', ...developerAccess, controller.getKeys);
  router.post('/keys', ...developerAccess, controller.createKey);
  router.delete('/keys/:id', ...developerAccess, controller.revokeKey);

  router.get('/webhooks', ...developerAccess, controller.getWebhooks);
  router.post('/webhooks', ...developerAccess, controller.createWebhook);
  router.post('/test-webhook', ...developerAccess, controller.testWebhook);

  return router;
}
