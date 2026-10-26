import { Request, Response } from 'express';
import * as crypto from 'node:crypto';
import { ShopRepository, UserRepository, PricingRepository } from '@inklly/db';
import { UserRole, ROLE_PRESETS } from '@inklly/shared';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export class AuthController {
  constructor(
    private userRepo: UserRepository,
    private shopRepo: ShopRepository,
    private pricingRepo: PricingRepository
  ) {}

  public login = (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userWithHash = this.userRepo.getUserByEmail(email.toLowerCase().trim());
    if (!userWithHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const inputHash = hashPassword(password);
    // Allow demo password shortcuts as well
    const isValid =
      userWithHash.passwordHash === inputHash ||
      userWithHash.passwordHash === `hash_${password}` ||
      password === 'demo123' ||
      password === 'admin123' ||
      password === 'owner123';

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Get primary membership
    const memberships = this.userRepo.getMembershipsByUser(userWithHash.id);
    const primary = memberships[0];

    const tokenPayload = {
      userId: userWithHash.id,
      email: userWithHash.email,
      role: userWithHash.role,
      organizationId: primary?.organizationId,
      shopId: primary?.shopId,
      permissions: primary?.permissions || ['*'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
    };

    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    res.json({
      token,
      user: {
        id: userWithHash.id,
        email: userWithHash.email,
        fullName: userWithHash.fullName,
        role: userWithHash.role,
      },
      shopId: primary?.shopId,
      organizationId: primary?.organizationId,
    });
  };

  public register = (req: Request, res: Response) => {
    const {
      orgName,
      shopName,
      shopCode,
      ownerName,
      email,
      password,
      phone,
      address,
      city,
      state,
      pinCode,
    } = req.body;

    if (!shopCode || !shopName || !email || !password || !ownerName) {
      return res.status(400).json({ error: 'Missing required onboarding registration fields' });
    }

    const cleanCode = shopCode.toLowerCase().trim();
    if (this.shopRepo.getShopByCode(cleanCode)) {
      return res.status(409).json({ error: 'Shop code is already taken. Please choose another.' });
    }

    const existingUser = this.userRepo.getUserByEmail(email.toLowerCase().trim());
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const now = new Date().toISOString();
    const userId = `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const orgId = `org-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const shopId = `shop-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    // 1. Create User
    this.userRepo.createUser(
      {
        id: userId,
        email: email.toLowerCase().trim(),
        phone,
        fullName: ownerName,
        role: 'MERCHANT_OWNER',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      hashPassword(password)
    );

    // 2. Create Organization
    this.shopRepo.createOrganization({
      id: orgId,
      name: orgName || `${ownerName}'s Printing Services`,
      ownerUserId: userId,
      planTier: 'STARTER',
      planStatus: 'ACTIVE',
      billingCurrency: 'INR',
      createdAt: now,
      updatedAt: now,
    });

    // 3. Create Shop
    this.shopRepo.createShop({
      id: shopId,
      organizationId: orgId,
      shopCode: cleanCode,
      name: shopName,
      tagline: 'Quality Document Printing & Copying',
      phone: phone || '+91 99999 99999',
      email: email.toLowerCase().trim(),
      address: address || 'Main Market Road',
      city: city || 'Pune',
      state: state || 'Maharashtra',
      pinCode: pinCode || '411001',
      currency: 'INR',
      paymentGateway: 'RAZORPAY',
      acceptCashOnCollection: true,
      autoPrintMode: 'MANUAL_OFF',
      orderSeparator: 'NONE',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 4. Create Membership
    this.userRepo.createMembership({
      id: `mem-${userId}`,
      userId,
      organizationId: orgId,
      shopId,
      role: 'MERCHANT_OWNER',
      permissions: ['*'] as any,
      createdAt: now,
      updatedAt: now,
    });

    // 5. Seed Baseline Rates for new shop
    this.pricingRepo.setRateRule({
      id: `rate-${shopId}-a4-bw-simp`,
      shopId,
      paperSize: 'A4',
      colorMode: 'bw',
      duplexMode: 'simplex',
      pricePerPrintedSidePaise: 200,
    });
    this.pricingRepo.setRateRule({
      id: `rate-${shopId}-a4-bw-dupl`,
      shopId,
      paperSize: 'A4',
      colorMode: 'bw',
      duplexMode: 'duplex_auto',
      pricePerPrintedSidePaise: 150,
    });
    this.pricingRepo.setRateRule({
      id: `rate-${shopId}-a4-col-simp`,
      shopId,
      paperSize: 'A4',
      colorMode: 'color',
      duplexMode: 'simplex',
      pricePerPrintedSidePaise: 1000,
    });

    const tokenPayload = {
      userId,
      email: email.toLowerCase().trim(),
      role: 'MERCHANT_OWNER' as UserRole,
      organizationId: orgId,
      shopId,
      permissions: ['*'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 7,
    };

    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        email,
        fullName: ownerName,
        role: 'MERCHANT_OWNER',
      },
      shop: {
        id: shopId,
        shopCode: cleanCode,
        name: shopName,
      },
    });
  };

  public getMe = (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const user = this.userRepo.getUserById(req.user.userId);
    const shop = req.user.shopId ? this.shopRepo.getShopById(req.user.shopId) : null;
    const org = req.user.organizationId ? this.shopRepo.getOrganizationById(req.user.organizationId) : null;

    res.json({
      user: user || {
        id: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        fullName: 'Operator',
      },
      shop,
      organization: org,
      permissions: req.user.permissions,
    });
  };
}
