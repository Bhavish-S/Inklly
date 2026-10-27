import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@inklly/shared';
import { verifySessionToken } from './session-token';

export interface AuthenticatedUser {
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
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Public routes proceed without user
    return next();
  }

  const session = verifySessionToken(authHeader.substring(7));
  if (session === 'expired') {
    res.status(401).json({ error: 'Token has expired' });
    return;
  }
  if (!session) {
    res.status(401).json({ error: 'Invalid authentication token' });
    return;
  }
  req.user = session;
  next();
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
