import { Router } from 'express';
import { PortalController } from '../controllers/portal-controller';
import { DatabaseService, OrderRepository, PricingRepository, ShopRepository } from '@inklly/db';
import { ShopPaymentCredentialsService } from '../services/shop-payment-credentials';
import { PrivateFileStorage } from '../services/private-file-storage';

export function createPortalRoutes(db: DatabaseService, fileStorage: PrivateFileStorage): Router {
  const router = Router();
  const shopRepo = new ShopRepository(db);
  const pricingRepo = new PricingRepository(db);
  const orderRepo = new OrderRepository(db);

  const controller = new PortalController(db, shopRepo, pricingRepo, orderRepo, new ShopPaymentCredentialsService(db), fileStorage);

  router.get('/shop/:shop_code', controller.getShopByCode);
  router.post('/upload', controller.uploadDocument);
  router.post('/quote', controller.getQuote);
  router.post(['/orders', '/order'], controller.submitOrder);
  router.get(['/orders/:id', '/order/:id'], controller.getOrderStatus);

  return router;
}
