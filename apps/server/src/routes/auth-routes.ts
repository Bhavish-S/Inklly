import { Router } from 'express';
import { AuthController } from '../controllers/auth-controller';
import { DatabaseService, ShopRepository, UserRepository, PricingRepository } from '@inklly/db';
import { authenticate } from '../middleware/auth';

export function createAuthRoutes(db: DatabaseService): Router {
  const router = Router();
  const userRepo = new UserRepository(db);
  const shopRepo = new ShopRepository(db);
  const pricingRepo = new PricingRepository(db);

  const controller = new AuthController(userRepo, shopRepo, pricingRepo, db);

  router.post('/login', controller.login);
  router.post('/register', controller.register);
  router.get('/me', authenticate, controller.getMe);

  // Appearance & Account settings
  router.get('/preferences', authenticate, controller.getPreferences);
  router.put('/preferences', authenticate, controller.updatePreferences);
  router.post('/password-reset/request', controller.requestPasswordReset);
  router.get('/sessions', authenticate, controller.getSessions);
  router.delete('/sessions/:id', authenticate, controller.revokeSession);

  return router;
}
