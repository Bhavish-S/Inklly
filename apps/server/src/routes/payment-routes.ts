import { Router } from 'express';
import { PaymentController } from '../controllers/payment-controller';
import { DatabaseService, OrderRepository, LedgerRepository } from '@inklly/db';
import { authenticate, requireRole } from '../middleware/auth';
import { ShopPaymentCredentialsService } from '../services/shop-payment-credentials';

export function createPaymentRoutes(db: DatabaseService): Router {
  const router = Router();
  const orderRepo = new OrderRepository(db);
  const ledgerRepo = new LedgerRepository(db);

  const controller = new PaymentController(orderRepo, ledgerRepo, db, new ShopPaymentCredentialsService(db));

  router.post('/create-intent', controller.createPaymentIntent);
  router.post('/verify', controller.verifyPayment);
  router.post('/webhook/razorpay/:shopId', controller.handleWebhook);
  router.post(
    '/orders/:id/collect-cash',
    authenticate,
    requireRole('MERCHANT_OWNER', 'SHOP_MANAGER', 'SHOP_STAFF', 'PLATFORM_OWNER', 'PLATFORM_ADMIN'),
    controller.collectCashAtCounter
  );

  return router;
}
