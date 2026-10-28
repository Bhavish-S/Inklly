import { Router } from 'express';
import { AdminController } from '../controllers/admin-controller';
import { DatabaseService, EnquiryRepository, LedgerRepository, UserRepository } from '@inklly/db';
import { authenticate, requireRole, requirePermission } from '../middleware/auth';
import { PrivateFileStorage } from '../services/private-file-storage';

export function createAdminRoutes(db: DatabaseService, fileStorage: PrivateFileStorage): Router {
  const router = Router();
  const ledgerRepo = new LedgerRepository(db);
  const userRepo = new UserRepository(db);

  const enquiryRepo = new EnquiryRepository(db);
  const controller = new AdminController(db, ledgerRepo, userRepo, enquiryRepo, fileStorage);

  router.use(authenticate(db));
  router.use(requireRole('PLATFORM_OWNER', 'PLATFORM_ADMIN'));

  router.get('/overview', requirePermission('platform:view'), controller.getOverview);
  router.get('/agents', requirePermission('platform:view'), controller.getAgents);
  router.get('/retention', requirePermission('platform:view'), controller.getRetentionStats);
  router.post('/retention/purge', requirePermission('platform:manage'), controller.runRetentionPurge);
  router.get('/merchants', requirePermission('platform:view'), controller.getMerchants);
  router.post('/merchants', requirePermission('platform:manage'), controller.onboardMerchant);
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
