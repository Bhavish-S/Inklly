import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscription-controller';
import { authenticate, requireRole } from '../middleware/auth';
import { DatabaseService } from '@inklly/db';

export function createSubscriptionRoutes(db: DatabaseService): Router {
  const router = Router();
  const controller = new SubscriptionController(db);

  router.get('/plans', controller.listPlans);
  const requireAuthentication = authenticate(db);
  router.get('/usage', requireAuthentication, requireRole('MERCHANT_OWNER'), controller.usage);
  router.post('/checkout', requireAuthentication, requireRole('MERCHANT_OWNER'), controller.createCheckout);
  router.post('/verify', requireAuthentication, requireRole('MERCHANT_OWNER'), controller.verifySubscription);

  return router;
}
