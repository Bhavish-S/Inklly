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
import { authenticate, requireRole, requirePermission, enforceTenantIsolation, requireActiveSubscription, requireShopOrganizationOwner } from '../middleware/auth';
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

  // Auto-print runs in the background for shops that switched it on.
  const autoPrintTimer = setInterval(() => {
    try { controller.runAutoPrintPass(); } catch (error) { console.error('[Auto-print] Pass failed', error); }
  }, 10_000);
  autoPrintTimer.unref();
  (router as any).runAutoPrintPass = () => controller.runAutoPrintPass();

  // Apply authentication and tenant isolation
  router.use(authenticate(db));
  router.use(enforceTenantIsolation);
  router.use(requireActiveSubscription(db));

  router.get('/dashboard', requirePermission('orders:view'), controller.getDashboard);
  router.get('/orders', requirePermission('orders:view'), controller.getOrders);
  router.get('/orders/:id', requirePermission('orders:view'), controller.getOrderById);
  router.get('/orders/:id/files/:fileId', requirePermission('orders:view'), controller.downloadOrderFile);
  router.patch('/orders/:id/status', requirePermission('orders:process'), controller.updateOrderStatus);
  router.post('/orders/:id/reconcile-output', requirePermission('orders:process'), controller.reconcilePrintOutput);
  router.post('/orders/:id/print', requirePermission('live_print:manage'), controller.printOrder);

  router.get('/operations', requirePermission('orders:view'), controller.getOperations);
  router.put('/operations', requirePermission('orders:process'), controller.updateOperations);
  router.get('/reports/daily', requirePermission('orders:view'), controller.getDailyReport);

  router.get('/counter/settings', requirePermission('orders:view'), controller.getCounterSettings);
  router.put('/counter/settings', requirePermission('settings:manage'), controller.updateCounterSettings);
  router.get('/counter/services', requirePermission('orders:view'), controller.getCounterServices);
  router.put('/counter/services', requirePermission('settings:manage'), controller.replaceCounterServices);
  router.get('/counter/sales', requirePermission('orders:view'), controller.listCounterSales);
  router.post('/counter/sales/quote', requirePermission('orders:process'), controller.quoteCounterSale);
  router.post('/counter/sales', requirePermission('orders:process'), controller.createCounterSale);
  router.post('/counter/sales/:id/void', requirePermission('finance:manage'), controller.voidCounterSale);

  router.post('/agents/pairing-code', requireRole('MERCHANT_OWNER'), controller.createAgentPairingCode);
  router.delete('/agents/:id', requireRole('MERCHANT_OWNER'), controller.revokeAgent);

  router.get('/rates', requirePermission('settings:view'), controller.getRates);
  router.put('/rates', requirePermission('settings:manage'), controller.updateRateRule);
  router.put('/discounts/bulk', requirePermission('settings:manage'), controller.updateBulkDiscount);
  router.put('/discounts', requirePermission('settings:manage'), controller.updateDiscountSettings);

  router.get('/printers', requirePermission('printers:view'), controller.getPrinters);
  router.post('/printers', requirePermission('printers:manage'), controller.addPrinter);
  router.put('/printers/:id/default', requirePermission('printers:manage'), controller.setDefaultPrinter);
  router.put('/printers/:id', requirePermission('printers:manage'), controller.updatePrinter);

  router.get('/settings', requirePermission('settings:view'), controller.getSettings);
  router.put('/settings', requirePermission('settings:manage'), controller.updateSettings);
  const requirePaymentCredentialOwner = requireShopOrganizationOwner(db);
  router.get('/settings/razorpay', requireRole('MERCHANT_OWNER'), requirePaymentCredentialOwner, controller.getRazorpayCredentials);
  router.put('/settings/razorpay', requireRole('MERCHANT_OWNER'), requirePaymentCredentialOwner, controller.saveRazorpayCredentials);
  router.post('/settings/razorpay/test', requireRole('MERCHANT_OWNER'), requirePaymentCredentialOwner, controller.testRazorpayCredentials);
  router.delete('/settings/razorpay', requireRole('MERCHANT_OWNER'), requirePaymentCredentialOwner, controller.removeRazorpayCredentials);

  router.get('/staff', requireRole('MERCHANT_OWNER', 'SHOP_MANAGER'), controller.getStaff);
  router.post('/staff', requireRole('MERCHANT_OWNER'), controller.addStaff);
  router.put('/staff/:userId', requireRole('MERCHANT_OWNER'), controller.updateStaffAccess);

  router.get('/bot-templates', requirePermission('bot:train'), controller.getBotTemplates);
  router.put('/bot-templates', requirePermission('bot:train'), controller.updateBotTemplate);

  // Credits
  router.get('/credits/balance', requirePermission('credits:view'), controller.getCreditBalance);
  router.post('/credits/purchase', requirePermission('credits:manage'), controller.purchaseCredits);

  // Payouts / Withdrawals
  router.get('/payouts', requirePermission('finance:view'), controller.getPayouts);
  router.post('/payouts', requirePermission('finance:manage'), controller.requestPayout);

  // Storage / Document tools
  router.get('/storage/categories', requirePermission('storage:view'), controller.getStorageCategories);
  router.post('/storage/categories', requirePermission('storage:manage'), controller.createStorageCategory);
  router.delete('/storage/categories/:id', requirePermission('storage:manage'), controller.deleteStorageCategory);
  router.post('/storage/documents', requirePermission('storage:manage'), controller.uploadStorageDocument);
  router.get('/storage/documents', requirePermission('storage:view'), controller.getStorageDocuments);
  router.get('/storage/documents/:id/download', requirePermission('storage:view'), controller.downloadStorageDocument);
  router.delete('/storage/documents/:id', requirePermission('storage:manage'), controller.deleteStorageDocument);

  // WhatsApp Setup
  router.get('/whatsapp/setup', requireRole('MERCHANT_OWNER', 'SHOP_MANAGER'), controller.getWhatsAppSetup);
  router.post('/whatsapp/setup', requireRole('MERCHANT_OWNER', 'SHOP_MANAGER'), controller.saveWhatsAppSetup);
  router.post('/whatsapp/qr-pairing', requireRole('MERCHANT_OWNER', 'SHOP_MANAGER'), controller.generateWhatsAppQrPairing);
  router.post('/whatsapp/qr-pairing/refresh', requireRole('MERCHANT_OWNER', 'SHOP_MANAGER'), controller.refreshWhatsAppQrPairing);
  router.delete('/whatsapp/account/:id', requireRole('MERCHANT_OWNER'), controller.removeWhatsAppAccount);
  router.get('/whatsapp/events', requireRole('MERCHANT_OWNER', 'SHOP_MANAGER'), controller.getWhatsAppEvents);

  return router;
}
