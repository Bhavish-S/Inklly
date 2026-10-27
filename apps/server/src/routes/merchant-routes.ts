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
import { authenticate, requireRole, requirePermission, enforceTenantIsolation } from '../middleware/auth';
import { ShopPaymentCredentialsService } from '../services/shop-payment-credentials';
import { PrivateFileStorage } from '../services/private-file-storage';

export function createMerchantRoutes(db: DatabaseService, fileStorage: PrivateFileStorage): Router {
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
    new AgentRepository(db),
    db,
    fileStorage
  );

  // Apply authentication and tenant isolation
  router.use(authenticate);
  router.use(enforceTenantIsolation);

  router.get('/dashboard', requirePermission('orders:view'), controller.getDashboard);
  router.get('/orders', requirePermission('orders:view'), controller.getOrders);
  router.get('/orders/:id', requirePermission('orders:view'), controller.getOrderById);
  router.get('/orders/:id/files/:fileId', requirePermission('orders:view'), controller.downloadOrderFile);
  router.patch('/orders/:id/status', requirePermission('orders:process'), controller.updateOrderStatus);
  router.post('/orders/:id/print', requirePermission('live_print:manage'), controller.printOrder);

  router.post('/agents/pairing-code', requireRole('MERCHANT_OWNER'), controller.createAgentPairingCode);
  router.delete('/agents/:id', requireRole('MERCHANT_OWNER'), controller.revokeAgent);

  router.get('/rates', requirePermission('settings:view'), controller.getRates);
  router.put('/rates', controller.updateRateRule);
  router.put('/discounts/bulk', controller.updateBulkDiscount);

  router.get('/printers', requirePermission('printers:view'), controller.getPrinters);
  router.post('/printers', requirePermission('printers:manage'), controller.addPrinter);

  router.get('/settings', requirePermission('settings:view'), controller.getSettings);
  router.put('/settings', requireRole('MERCHANT_OWNER', 'SHOP_MANAGER'), controller.updateSettings);
  router.get('/settings/razorpay', requireRole('MERCHANT_OWNER'), controller.getRazorpayCredentials);
  router.put('/settings/razorpay', requireRole('MERCHANT_OWNER'), controller.saveRazorpayCredentials);
  router.delete('/settings/razorpay', requireRole('MERCHANT_OWNER'), controller.removeRazorpayCredentials);

  router.get('/staff', requireRole('MERCHANT_OWNER', 'SHOP_MANAGER'), controller.getStaff);
  router.post('/staff', requireRole('MERCHANT_OWNER'), controller.addStaff);

  router.get('/bot-templates', requirePermission('bot:train'), controller.getBotTemplates);
  router.put('/bot-templates', requirePermission('bot:train'), controller.updateBotTemplate);

  return router;
}
