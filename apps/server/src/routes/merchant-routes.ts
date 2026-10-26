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
} from '@inklly/db';
import { authenticate, requireRole, enforceTenantIsolation } from '../middleware/auth';

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
    ledgerRepo
  );

  // Apply authentication and tenant isolation
  router.use(authenticate);
  router.use(enforceTenantIsolation);

  router.get('/dashboard', controller.getDashboard);
  router.get('/orders', controller.getOrders);
  router.get('/orders/:id', controller.getOrderById);
  router.patch('/orders/:id/status', controller.updateOrderStatus);
  router.post('/orders/:id/print', controller.printOrder);

  router.get('/rates', controller.getRates);
  router.put('/rates', controller.updateRateRule);
  router.put('/discounts/bulk', controller.updateBulkDiscount);

  router.get('/printers', controller.getPrinters);
  router.post('/printers', controller.addPrinter);

  router.get('/settings', controller.getSettings);
  router.put('/settings', controller.updateSettings);

  router.get('/staff', controller.getStaff);
  router.post('/staff', controller.addStaff);

  router.get('/bot-templates', controller.getBotTemplates);
  router.put('/bot-templates', controller.updateBotTemplate);

  return router;
}
