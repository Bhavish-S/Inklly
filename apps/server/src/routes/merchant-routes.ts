import { Router } from 'express';
import { MerchantController } from '../controllers/merchant-controller';
import {
  DatabaseService,
  ShopRepository,
  OrderRepository,
  PricingRepository,
  PrinterRepository,
  UserRepository,
  LedgerRepository,
  AgentRepository,
} from '@inklly/db';
import { authenticate, requireRole, enforceTenantIsolation } from '../middleware/auth';
import { ShopPaymentCredentialsService } from '../services/shop-payment-credentials';

export function createMerchantRoutes(db: DatabaseService): Router {
  const router = Router();

  const shopRepo = new ShopRepository(db);
  const orderRepo = new OrderRepository(db);
  const pricingRepo = new PricingRepository(db);
  const printerRepo = new PrinterRepository(db);
  const userRepo = new UserRepository(db);
  const ledgerRepo = new LedgerRepository(db);

  const controller = new MerchantController(
    shopRepo,
    orderRepo,
    pricingRepo,
    printerRepo,
    userRepo,
    ledgerRepo,
    new ShopPaymentCredentialsService(db),
    new AgentRepository(db)
  );

  // Apply authentication and tenant isolation
  router.use(authenticate);
  router.use(enforceTenantIsolation);

  router.get('/dashboard', controller.getDashboard);
  router.get('/orders', controller.getOrders);
  router.get('/orders/:id', controller.getOrderById);
  router.patch('/orders/:id/status', controller.updateOrderStatus);
  router.post('/orders/:id/print', controller.printOrder);

  router.post('/agents/pairing-code', requireRole('MERCHANT_OWNER'), controller.createAgentPairingCode);
  router.delete('/agents/:id', requireRole('MERCHANT_OWNER'), controller.revokeAgent);

  router.get('/rates', controller.getRates);
  router.put('/rates', controller.updateRateRule);
  router.put('/discounts/bulk', controller.updateBulkDiscount);

  router.get('/printers', controller.getPrinters);
  router.post('/printers', controller.addPrinter);

  router.get('/settings', controller.getSettings);
  router.put('/settings', requireRole('MERCHANT_OWNER', 'SHOP_MANAGER'), controller.updateSettings);
  router.get('/settings/razorpay', requireRole('MERCHANT_OWNER'), controller.getRazorpayCredentials);
  router.put('/settings/razorpay', requireRole('MERCHANT_OWNER'), controller.saveRazorpayCredentials);
  router.delete('/settings/razorpay', requireRole('MERCHANT_OWNER'), controller.removeRazorpayCredentials);

  router.get('/staff', controller.getStaff);
  router.post('/staff', controller.addStaff);

  router.get('/bot-templates', controller.getBotTemplates);
  router.put('/bot-templates', controller.updateBotTemplate);

  return router;
}
