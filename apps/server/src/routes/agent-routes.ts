import { Router } from 'express';
import { AgentDispatchController } from '../controllers/agent-dispatch-controller';
import { DatabaseService, AgentRepository, ShopRepository, PrinterRepository } from '@inklly/db';

export function createAgentRoutes(db: DatabaseService): Router {
  const router = Router();
  const agentRepo = new AgentRepository(db);
  const shopRepo = new ShopRepository(db);
  const printerRepo = new PrinterRepository(db);

  const controller = new AgentDispatchController(agentRepo, shopRepo, printerRepo);

  router.post('/enroll', controller.enroll);
  router.post('/heartbeat', controller.heartbeat);
  router.get('/poll-commands', controller.pollCommands);
  router.post('/command-result', controller.reportCommandResult);
  router.get('/download', controller.downloadAgent);
  router.get('/driver-matrix', controller.getDriverMatrix);
  router.get('/diagnostics', controller.getDiagnostics);

  return router;
}
