import { Router } from 'express';
import { AdminController } from '../controllers/admin-controller';
import { DatabaseService, EnquiryRepository, LedgerRepository, UserRepository } from '@inklly/db';
import { authenticate, requireRole, requirePermission } from '../middleware/auth';

export function createAdminRoutes(db: DatabaseService): Router {
  const router = Router();
  const ledgerRepo = new LedgerRepository(db);
  const userRepo = new UserRepository(db);

  const enquiryRepo = new EnquiryRepository(db);
  const controller = new AdminController(db, ledgerRepo, userRepo, enquiryRepo);

  router.use(authenticate);
  router.use(requireRole('PLATFORM_OWNER', 'PLATFORM_ADMIN'));

  router.get('/overview', requirePermission('platform:view'), controller.getOverview);
  router.get('/merchants', requirePermission('platform:view'), controller.getMerchants);
  router.patch('/merchants/:id/status', requirePermission('platform:manage'), controller.updateMerchantStatus);
  router.get('/plans', requirePermission('platform:view'), controller.getPlans);
  router.get('/ledger', requirePermission('finance:view'), controller.getPlatformLedger);
  router.get('/audit-logs', requirePermission('security:audit'), controller.getAuditLogs);
  router.get('/enquiries', requirePermission('support:view'), controller.getEnquiries);

  // Subscription management
  router.get('/subscriptions', requirePermission('billing:view'), controller.listSubscriptions);
  router.post('/subscriptions', requirePermission('billing:manage'), controller.createSubscription);
  router.patch('/subscriptions/:id', requirePermission('billing:manage'), controller.updateSubscription);

  return router;
}
