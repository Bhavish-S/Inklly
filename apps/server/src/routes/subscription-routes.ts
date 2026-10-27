import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscription-controller';
import { authenticate, requireRole } from '../middleware/auth';

export function createSubscriptionRoutes(): Router {
  const router = Router();
  const controller = new SubscriptionController();

  router.get('/plans', controller.listPlans);
  router.post('/checkout', authenticate, requireRole('MERCHANT_OWNER'), controller.createCheckout);
  router.post('/verify', authenticate, requireRole('MERCHANT_OWNER'), controller.verifySubscription);

  return router;
}
