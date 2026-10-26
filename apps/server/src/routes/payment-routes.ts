import { Router } from 'express';
import { PaymentController } from '../controllers/payment-controller';
import { DatabaseService, OrderRepository, LedgerRepository } from '@inklly/db';
import { authenticate } from '../middleware/auth';

export function createPaymentRoutes(db: DatabaseService): Router {
  const router = Router();
  const orderRepo = new OrderRepository(db);
  const ledgerRepo = new LedgerRepository(db);

  const controller = new PaymentController(orderRepo, ledgerRepo, db);

  router.post('/create-intent', controller.createPaymentIntent);
  router.post('/verify', controller.verifyPayment);
  router.post('/webhook/:provider', controller.handleWebhook);
  router.post('/orders/:id/collect-cash', authenticate, controller.collectCashAtCounter);

  return router;
}
