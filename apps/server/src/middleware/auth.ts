import { Request, Response, NextFunction } from 'express';
import { UserRole, StaffPermission } from '@inklly/shared';

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
 * Supports standard Bearer session tokens and simulated development headers.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const devShopHeader = req.headers['x-shop-id'] as string | undefined;
  const devRoleHeader = req.headers['x-user-role'] as UserRole | undefined;

  // Development / Staging fallback header parsing for robust testing
  if (devRoleHeader) {
    req.user = {
      userId: (req.headers['x-user-id'] as string) || 'user-dev-1',
      email: (req.headers['x-user-email'] as string) || 'dev@inklly.com',
      role: devRoleHeader,
      shopId: devShopHeader || 'shop-campus-1',
      organizationId: 'org-campus-network',
      permissions: ['*'],
    };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Public routes proceed without user
    return next();
  }

  const token = authHeader.substring(7);

  // Simple token decoder for session simulation
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    if (payload.exp && typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
      res.status(401).json({ error: 'Token has expired' });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
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

  const requestedShopId =
    req.params.shopId ||
    req.body?.shopId ||
    (req.query.shopId as string) ||
    (req.headers['x-shop-id'] as string);
  if (requestedShopId && req.user.shopId && requestedShopId !== req.user.shopId) {
    return res.status(403).json({
      error: 'Tenant isolation violation: Cross-tenant access denied',
      requestedShopId,
      userShopId: req.user.shopId,
    });
  }

  next();
}
