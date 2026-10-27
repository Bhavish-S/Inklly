import { Router } from 'express';
import { AdminController } from '../controllers/admin-controller';
import { DatabaseService, EnquiryRepository, LedgerRepository, UserRepository } from '@inklly/db';
import { authenticate, requireRole } from '../middleware/auth';

export function createAdminRoutes(db: DatabaseService): Router {
  const router = Router();
  const ledgerRepo = new LedgerRepository(db);
  const userRepo = new UserRepository(db);

  const enquiryRepo = new EnquiryRepository(db);
  const controller = new AdminController(db, ledgerRepo, userRepo, enquiryRepo);

  router.use(authenticate);
  router.use(requireRole('PLATFORM_OWNER', 'PLATFORM_ADMIN'));

  router.get('/overview', controller.getOverview);
  router.get('/merchants', controller.getMerchants);
  router.patch('/merchants/:id/status', controller.updateMerchantStatus);
  router.get('/plans', controller.getPlans);
  router.get('/ledger', controller.getPlatformLedger);
  router.get('/audit-logs', controller.getAuditLogs);
  router.get('/enquiries', controller.getEnquiries);

  return router;
}
