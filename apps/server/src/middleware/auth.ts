import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@inklly/shared';
import { DatabaseService } from '@inklly/db';
import { hashSessionToken, verifySessionToken } from './session-token';

export interface AuthenticatedUser {
  sessionId: string;
  userId: string;
  email: string;
  role: UserRole;
  shopId?: string;
  organizationId?: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Multi-Tenant Authentication & Scoping Middleware
 * Supports only server-signed Bearer session tokens. Identity and authorization
 * claims from request headers are never trusted.
 */
export function authenticate(db: DatabaseService) {
  return (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Public routes proceed without user
    return next();
  }

  const token = authHeader.substring(7);
  const session = verifySessionToken(token);
  if (session === 'expired') {
    res.status(401).json({ error: 'Token has expired' });
    return;
  }
  if (!session) {
    res.status(401).json({ error: 'Invalid authentication token' });
    return;
  }
  const storedSession = db.queryOne<any>(
    `SELECT id FROM user_sessions WHERE id = ? AND user_id = ? AND token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
    [session.sessionId, session.userId, hashSessionToken(token), new Date().toISOString()]
  );
  if (!storedSession) {
    res.status(401).json({ error: 'Session has expired or was revoked. Please sign in again.' });
    return;
  }
  db.execute(`UPDATE user_sessions SET last_used_at = ? WHERE id = ?`, [new Date().toISOString(), session.sessionId]);
  req.user = session;
  next();
  };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role === 'PLATFORM_OWNER' || allowedRoles.includes(req.user.role)) {
      return next();
    }
    res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
  };
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    if (user.role === 'PLATFORM_OWNER' || user.role === 'MERCHANT_OWNER') return next();
    if (user.role === 'PLATFORM_ADMIN' ? user.permissions.includes(permission) : (user.permissions.includes('*') || user.permissions.includes(permission))) return next();
    return res.status(403).json({ error: `Permission required: ${permission}` });
  };
}

/** Keep trial access in sync with its persisted expiry before merchant API work. */
export function requireActiveSubscription(db: DatabaseService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    if (user.role === 'PLATFORM_OWNER' || user.role === 'PLATFORM_ADMIN') return next();
    if (!user.organizationId) return res.status(403).json({ error: 'An organization membership is required.' });

    const organization = db.queryOne<{ plan_status: string }>(
      `SELECT plan_status FROM organizations WHERE id = ?`,
      [user.organizationId]
    );
    if (!organization) return res.status(403).json({ error: 'Organization not found.' });
    if (organization.plan_status === 'ACTIVE') return next();

    if (organization.plan_status === 'TRIAL') {
      const trial = db.queryOne<{ status: string; current_period_end: string }>(
        `SELECT status, current_period_end FROM subscriptions WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
        [user.organizationId]
      );
      if (trial?.status === 'TRIALING' && Date.parse(trial.current_period_end) > Date.now()) return next();
      db.execute(`UPDATE organizations SET plan_status = 'PAST_DUE', updated_at = ? WHERE id = ? AND plan_status = 'TRIAL'`, [new Date().toISOString(), user.organizationId]);
    }

    return res.status(402).json({
      error: 'Your Inklly trial has ended. Contact us to activate pilot pricing.',
      subscriptionRequired: true,
    });
  };
}

export function enforceTenantIsolation(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Platform owners can access any tenant
  if (req.user.role === 'PLATFORM_OWNER' || req.user.role === 'PLATFORM_ADMIN') {
    return next();
  }

  if (!req.user.shopId) {
    return res.status(403).json({ error: 'An active shop membership is required for this operation' });
  }

  const requestedShopId =
    req.params.shopId ||
    req.body?.shopId ||
    (req.query.shopId as string) ||
    (req.headers['x-shop-id'] as string);
  if (requestedShopId && requestedShopId !== req.user.shopId) {
    return res.status(403).json({
      error: 'Tenant isolation violation: Cross-tenant access denied',
      requestedShopId,
      userShopId: req.user.shopId,
    });
  }

  next();
}
