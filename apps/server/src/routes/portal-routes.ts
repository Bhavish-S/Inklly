import { Router } from 'express';
import { PortalController } from '../controllers/portal-controller';
import { DatabaseService, OrderRepository, PricingRepository, ShopRepository } from '@inklly/db';

export function createPortalRoutes(db: DatabaseService): Router {
  const router = Router();
  const shopRepo = new ShopRepository(db);
  const pricingRepo = new PricingRepository(db);
  const orderRepo = new OrderRepository(db);

  const controller = new PortalController(shopRepo, pricingRepo, orderRepo);

  router.get('/shop/:shop_code', controller.getShopByCode);
  router.post('/upload', controller.uploadDocument);
  router.post('/quote', controller.getQuote);
  router.post(['/orders', '/order'], controller.submitOrder);
  router.get(['/orders/:id', '/order/:id'], controller.getOrderStatus);

  return router;
}
