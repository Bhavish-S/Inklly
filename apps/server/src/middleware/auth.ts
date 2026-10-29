import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@inklly/shared';
import { DatabaseService } from '@inklly/db';
import { hashSessionToken, verifySessionToken } from './session-token';
import * as crypto from 'node:crypto';
import { AgentRepository } from '@inklly/db';

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
  if (token.startsWith('ink_test_') || token.startsWith('ink_live_')) {
    if (process.env.ENABLE_EXTERNAL_API_ACCESS !== 'true') {
      res.status(403).json({ code: 'EXTERNAL_API_ACCESS_DISABLED', error: 'External API access is disabled.' });
      return;
    }
    const requestedEnvironment = token.startsWith('ink_live_') ? 'LIVE' : 'TEST';
    const runtimeEnvironment = process.env.NODE_ENV === 'production' ? 'LIVE' : 'TEST';
    if (requestedEnvironment !== runtimeEnvironment || token.length !== 41) {
      res.status(401).json({ error: 'Invalid API key or environment.' });
      return;
    }
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const key = new AgentRepository(db).authenticateDeveloperKey(hash, runtimeEnvironment);
    if (!key) {
      res.status(401).json({ error: 'Invalid, expired, or revoked API key.' });
      return;
    }
    const membership = db.queryOne<any>(
      `SELECT m.role, m.permissions, m.is_active AS membership_active, s.organization_id, s.is_active AS shop_active, u.email, u.is_active AS user_active
       FROM memberships m JOIN shops s ON s.id = m.shop_id JOIN users u ON u.id = m.user_id
       WHERE m.user_id = ? AND m.organization_id = ? AND m.shop_id = ?`,
      [key.createdByUserId, key.organizationId, key.shopId]
    );
    if (!membership || !membership.membership_active || !membership.user_active || !membership.shop_active || membership.organization_id !== key.organizationId) {
      res.status(401).json({ error: 'API key owner or shop membership is no longer active.' });
      return;
    }
    const scopePermissions: Record<string, string[]> = {
      'orders:read': ['orders:view'],
      'orders:write': ['orders:process'],
      'printers:read': ['printers:view'],
      'printers:spool': ['live_print:manage'],
      'ledger:read': ['finance:view'],
    };
    const permissions = [...new Set(key.scopes.flatMap((scope) => scopePermissions[scope] || []))];
    req.user = {
      sessionId: `api-key:${key.id}`,
      userId: key.createdByUserId,
      email: membership.email,
      // Never inherit owner/manager bypasses from the key creator. API keys are
      // a separate principal whose authority is the intersection of key scopes.
      role: 'SHOP_STAFF',
      shopId: key.shopId,
      organizationId: key.organizationId,
      permissions,
    };
    next();
    return;
  }
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
  const currentUser = db.queryOne<any>(`SELECT id, email, role, is_active FROM users WHERE id = ?`, [session.userId]);
  if (!currentUser || !currentUser.is_active) {
    db.execute(`UPDATE user_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`, [new Date().toISOString(), session.sessionId]);
    res.status(401).json({ error: 'Account is inactive. Please contact your organization administrator.' });
    return;
  }

  let currentClaims: AuthenticatedUser;
  if (currentUser.role === 'PLATFORM_OWNER' || currentUser.role === 'PLATFORM_ADMIN') {
    // Never let an old token retain platform privilege after the persisted role changes.
    if (session.role !== currentUser.role) {
      res.status(401).json({ error: 'Account permissions changed. Please sign in again.' });
      return;
    }
    const platformPermissions = currentUser.role === 'PLATFORM_OWNER'
      ? ['*']
      : db.query<{ permission: string }>(`SELECT permission FROM platform_admin_permissions WHERE user_id = ? ORDER BY permission`, [currentUser.id])
          .map((row) => row.permission);
    currentClaims = { ...session, email: currentUser.email, role: currentUser.role, shopId: undefined, organizationId: undefined,
      permissions: platformPermissions };
  } else if (currentUser.role === 'DEVELOPER' && !session.organizationId && !session.shopId) {
    // Unaffiliated developer accounts may use identity-only routes, but have no
    // tenant scope or tenant permissions until an organization membership exists.
    currentClaims = { ...session, email: currentUser.email, role: 'DEVELOPER', permissions: [] };
  } else {
    // Tenant scope, role, and permissions are refreshed from the current membership
    // on every request. A signed but stale JWT is not a durable authorization grant.
    const membership = db.queryOne<any>(
      `SELECT m.role, m.permissions, m.is_active AS membership_active, s.is_active AS shop_active
       FROM memberships m
       LEFT JOIN shops s ON s.id = m.shop_id AND s.organization_id = m.organization_id
       WHERE m.user_id = ? AND m.organization_id = ? AND m.shop_id = ?`,
      [session.userId, session.organizationId || '', session.shopId || '']
    );
    if (!membership || !membership.membership_active) {
      res.status(401).json({ error: 'Shop membership is no longer active. Please sign in again.' });
      return;
    }
    if (session.shopId && !membership.shop_active) {
      res.status(403).json({ error: 'This shop is inactive. Contact your platform administrator.' });
      return;
    }
    let permissions: string[];
    try {
      const parsed = JSON.parse(membership.permissions);
      permissions = Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
    } catch {
      permissions = [];
    }
    currentClaims = { ...session, email: currentUser.email, role: membership.role as UserRole, permissions };
  }
  db.execute(`UPDATE user_sessions SET last_used_at = ? WHERE id = ?`, [new Date().toISOString(), session.sessionId]);
  req.user = currentClaims;
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
