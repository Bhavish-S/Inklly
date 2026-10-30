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
  router.post('/signup-checkout', controller.signupCheckout);
  router.post('/register', controller.register);
  router.post('/invitations/accept', controller.acceptPlatformInvitation);
  const requireAuthentication = authenticate(db);
  router.get('/me', requireAuthentication, controller.getMe);
  router.put('/me', requireAuthentication, controller.updateMe);
  router.put('/password', requireAuthentication, controller.changePassword);

  // Appearance & Account settings
  router.get('/preferences', requireAuthentication, controller.getPreferences);
  router.put('/preferences', requireAuthentication, controller.updatePreferences);
  router.post('/password-reset/request', controller.requestPasswordReset);
  router.get('/sessions', requireAuthentication, controller.getSessions);
  router.delete('/sessions/:id', requireAuthentication, controller.revokeSession);

  return router;
}
