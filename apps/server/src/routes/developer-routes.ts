import { Router } from 'express';
import { DeveloperController } from '../controllers/developer-controller';
import { DatabaseService, AgentRepository } from '@inklly/db';
import { authenticate } from '../middleware/auth';

export function createDeveloperRoutes(db: DatabaseService): Router {
  const router = Router();
  const agentRepo = new AgentRepository(db);
  const controller = new DeveloperController(agentRepo);

  // OpenAPI spec is public
  router.get('/openapi.json', controller.getOpenApiSpec);

  // Scoped routes require developer or merchant authentication
  router.get('/keys', authenticate, controller.getKeys);
  router.post('/keys', authenticate, controller.createKey);
  router.delete('/keys/:id', authenticate, controller.revokeKey);

  router.get('/webhooks', authenticate, controller.getWebhooks);
  router.post('/webhooks', authenticate, controller.createWebhook);
  router.post('/test-webhook', authenticate, controller.testWebhook);

  return router;
}
