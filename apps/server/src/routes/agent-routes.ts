import { Router } from 'express';
import { AgentDispatchController } from '../controllers/agent-dispatch-controller';
import { DatabaseService, AgentRepository, ShopRepository, PrinterRepository } from '@inklly/db';
import { PrivateFileStorage } from '../services/private-file-storage';

export function createAgentRoutes(db: DatabaseService, fileStorage: PrivateFileStorage): Router {
  const router = Router();
  const agentRepo = new AgentRepository(db);
  const shopRepo = new ShopRepository(db);
  const printerRepo = new PrinterRepository(db);

  const controller = new AgentDispatchController(agentRepo, shopRepo, printerRepo, db, fileStorage);

  const authenticateAgent = (req: any, res: any, next: any) => {
    const agentId = req.header('x-agent-id');
    const authorization = req.header('authorization') || '';
    const secret = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const identity = agentRepo.authenticateAgent(agentId, secret);
    if (!identity) return res.status(401).json({ error: 'Agent authentication required' });
    req.agent = identity;
    next();
  };

  router.post('/enroll', controller.enroll);
  router.post('/heartbeat', authenticateAgent, controller.heartbeat);
  router.get('/poll-commands', authenticateAgent, controller.pollCommands);
  router.post('/command-result', authenticateAgent, controller.reportCommandResult);
  router.get('/files/:fileId', authenticateAgent, controller.downloadPrintFile);
  router.get('/download', controller.downloadAgent);
  router.get('/driver-matrix', controller.getDriverMatrix);
  router.get('/diagnostics', controller.getDiagnostics);

  return router;
}
