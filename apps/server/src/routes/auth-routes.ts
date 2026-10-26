import { Router } from 'express';
import { AuthController } from '../controllers/auth-controller';
import { DatabaseService, ShopRepository, UserRepository, PricingRepository } from '@inklly/db';
import { authenticate } from '../middleware/auth';

export function createAuthRoutes(db: DatabaseService): Router {
  const router = Router();
  const userRepo = new UserRepository(db);
  const shopRepo = new ShopRepository(db);
  const pricingRepo = new PricingRepository(db);

  const controller = new AuthController(userRepo, shopRepo, pricingRepo);

  router.post('/login', controller.login);
  router.post('/register', controller.register);
  router.get('/me', authenticate, controller.getMe);

  return router;
}
