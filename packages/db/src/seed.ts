import { DatabaseService } from './database';
import { ShopRepository } from './repositories/shop-repository';
import { PricingRepository } from './repositories/pricing-repository';
import { PrinterRepository } from './repositories/printer-repository';
import { OrderRepository } from './repositories/order-repository';
import { UserRepository } from './repositories/user-repository';
import { AgentRepository } from './repositories/agent-repository';
import { ROLE_PRESETS } from '@inklly/shared';

export function seedDatabase(db: DatabaseService): void {
  const shopRepo = new ShopRepository(db);
  const pricingRepo = new PricingRepository(db);
  const printerRepo = new PrinterRepository(db);
  const orderRepo = new OrderRepository(db);
  const userRepo = new UserRepository(db);
  const agentRepo = new AgentRepository(db);

  const now = new Date().toISOString();

  // 1. Organization & Shop
  const orgId = 'org-campus-network';
  const shopId = 'shop-campus-1';

  if (!shopRepo.getOrganizationById(orgId)) {
    shopRepo.createOrganization({
      id: orgId,
      name: 'Campus Print Network',
      ownerUserId: 'user-owner-1',
      planTier: 'PRO',
      planStatus: 'ACTIVE',
      billingCurrency: 'INR',
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!shopRepo.getShopByCode('campus1')) {
    shopRepo.createShop({
      id: shopId,
      organizationId: orgId,
      shopCode: 'campus1',
      name: 'Campus Print Express',
      tagline: 'High Speed Quality Printing & Photocopying',
      phone: '+91 98765 43210',
      email: 'counter@campusprint.in',
      address: 'Shop 4, University Commercial Complex, FC Road',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411004',
      gstin: '27AAAAA0000A1Z5',
      currency: 'INR',
      paymentGateway: 'RAZORPAY',
      acceptCashOnCollection: true,
      autoPrintMode: 'MANUAL_OFF',
      orderSeparator: 'BW_INVOICE',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 1b. Multi-Tier Paid Plans Demo Merchants
  // Starter Plan (₹99/mo)
  const starterOrgId = 'org-starter-99';
  const starterShopId = 'shop-starter-99';
  if (!shopRepo.getOrganizationById(starterOrgId)) {
    shopRepo.createOrganization({
      id: starterOrgId,
      name: 'QuickPrint Corner Org',
      ownerUserId: 'user-owner-starter',
      planTier: 'STARTER',
      planStatus: 'ACTIVE',
      billingCurrency: 'INR',
      createdAt: now,
      updatedAt: now,
    });
  }
  if (!shopRepo.getShopByCode('quickprint99')) {
    shopRepo.createShop({
      id: starterShopId,
      organizationId: starterOrgId,
      shopCode: 'quickprint99',
      name: 'QuickPrint Corner (Starter ₹99/mo)',
      tagline: 'Single Counter Xerox & Fast Document Print',
      phone: '+91 98111 22233',
      email: 'counter@quickprint99.in',
      address: 'Shop 1, Near Metro Pillar 42, Karve Road',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411038',
      gstin: '27AABCS1111A1Z1',
      currency: 'INR',
      paymentGateway: 'CASH_ONLY',
      acceptCashOnCollection: true,
      autoPrintMode: 'MANUAL_OFF',
      orderSeparator: 'NONE',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Growth Plan Yearly (₹159/mo billed yearly)
  const hostelOrgId = 'org-hostel-yearly';
  const hostelShopId = 'shop-hostel-print';
  if (!shopRepo.getOrganizationById(hostelOrgId)) {
    shopRepo.createOrganization({
      id: hostelOrgId,
      name: 'Hostel FastPrint Network',
      ownerUserId: 'user-owner-hostel',
      planTier: 'GROWTH',
      planStatus: 'ACTIVE',
      billingCurrency: 'INR',
      createdAt: now,
      updatedAt: now,
    });
  }
  if (!shopRepo.getShopByCode('hostelprint')) {
    shopRepo.createShop({
      id: hostelShopId,
      organizationId: hostelOrgId,
      shopCode: 'hostelprint',
      name: 'Hostel FastPrint (Growth Yearly ₹159/mo)',
      tagline: '24/7 Student Self-Service Document Hub',
      phone: '+91 98222 33344',
      email: 'print@hostelfastprint.in',
      address: 'Hostel Block 3 Commercial Wing, University Campus',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411007',
      gstin: '27AABCH2222A1Z2',
      currency: 'INR',
      paymentGateway: 'RAZORPAY',
      acceptCashOnCollection: true,
      autoPrintMode: 'PRINT_AFTER_PAYMENT',
      orderSeparator: 'BLANK_PAGE',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Pro Plan (₹499/mo) - High Volume Center
  const metroOrgId = 'org-metro-pro';
  const metroShopId = 'shop-metro-pro';
  if (!shopRepo.getOrganizationById(metroOrgId)) {
    shopRepo.createOrganization({
      id: metroOrgId,
      name: 'Metro Xerox Graphics Corp',
      ownerUserId: 'user-owner-metro',
      planTier: 'PRO',
      planStatus: 'ACTIVE',
      billingCurrency: 'INR',
      createdAt: now,
      updatedAt: now,
    });
  }
  if (!shopRepo.getShopByCode('metro-xerox')) {
    shopRepo.createShop({
      id: metroShopId,
      organizationId: metroOrgId,
      shopCode: 'metro-xerox',
      name: 'Metro Xerox Hub (Pro ₹499/mo)',
      tagline: 'Multi-Counter High-Capacity Xerox, Plotting & Binding Center',
      phone: '+91 98333 44455',
      email: 'orders@metroxeroxhub.in',
      address: 'Shop 12-14, Mega Commercial Complex, Shivaji Nagar',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411005',
      gstin: '27AABCM3333A1Z3',
      currency: 'INR',
      paymentGateway: 'RAZORPAY',
      acceptCashOnCollection: true,
      autoPrintMode: 'AUTO_ALL',
      orderSeparator: 'BW_INVOICE',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Scale / Enterprise Plan (₹899/mo) - University Franchise
  const apexOrgId = 'org-apex-scale';
  const apexShopId = 'shop-apex-scale';
  if (!shopRepo.getOrganizationById(apexOrgId)) {
    shopRepo.createOrganization({
      id: apexOrgId,
      name: 'Apex University Print Services',
      ownerUserId: 'user-owner-apex',
      planTier: 'SCALE',
      planStatus: 'ACTIVE',
      billingCurrency: 'INR',
      createdAt: now,
      updatedAt: now,
    });
  }
  if (!shopRepo.getShopByCode('apex-univ')) {
    shopRepo.createShop({
      id: apexShopId,
      organizationId: apexOrgId,
      shopCode: 'apex-univ',
      name: 'Apex University Print Network (Scale ₹899/mo)',
      tagline: 'Campus-Wide Unified Printing & Cloud Spooler Fleet',
      phone: '+91 98444 55566',
      email: 'admin@apexuniversity.ac.in',
      address: 'Central Academic Library Building, Main Campus',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411004',
      gstin: '27AABCA4444A1Z4',
      currency: 'INR',
      paymentGateway: 'RAZORPAY',
      acceptCashOnCollection: true,
      autoPrintMode: 'AUTO_ALL',
      orderSeparator: 'BW_INVOICE',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 2. Users & Memberships
  // Platform Owner
  if (!userRepo.getUserByEmail('admin@inklly.com')) {
    userRepo.createUser(
      {
        id: 'user-admin-1',
        email: 'admin@inklly.com',
        phone: '+91 99999 00000',
        fullName: 'Inklly Super Admin',
        role: 'PLATFORM_OWNER',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' // sha256 of admin123
    );
  }

  // Developer User
  if (!userRepo.getUserByEmail('dev@inklly.com')) {
    userRepo.createUser(
      {
        id: 'user-dev-1',
        email: 'dev@inklly.com',
        phone: '+91 99999 11111',
        fullName: 'Inklly Developer API',
        role: 'DEVELOPER',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      '87274af01876341455b32d805946f272871bb42effa6604dccf28bb027afa82b' // sha256 of dev123
    );
  }

  // Merchant Owner
  if (!userRepo.getUserByEmail('owner@campusprint.in')) {
    userRepo.createUser(
      {
        id: 'user-owner-1',
        email: 'owner@campusprint.in',
        phone: '+91 98765 43210',
        fullName: 'Rajesh Kulkarni',
        role: 'MERCHANT_OWNER',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      'hash_owner_123'
    );

    userRepo.createMembership({
      id: 'mem-owner-1',
      userId: 'user-owner-1',
      organizationId: orgId,
      shopId,
      role: 'MERCHANT_OWNER',
      permissions: ['*'] as any,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Shop Staff (Operator)
  if (!userRepo.getUserByEmail('operator@campusprint.in')) {
    userRepo.createUser(
      {
        id: 'user-staff-1',
        email: 'operator@campusprint.in',
        phone: '+91 98765 11111',
        fullName: 'Vikas Deshmukh (Desk Operator)',
        role: 'SHOP_STAFF',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      'hash_staff_123'
    );

    userRepo.createMembership({
      id: 'mem-staff-1',
      userId: 'user-staff-1',
      organizationId: orgId,
      shopId,
      role: 'SHOP_STAFF',
      permissions: ROLE_PRESETS['Print Operator'],
      createdAt: now,
      updatedAt: now,
    });
  }

  // 3. Printers
  const p1Id = 'printer-hp-laserjet';
  const p2Id = 'printer-canon-color';

  if (printerRepo.getPrintersByShop(shopId).length === 0) {
    printerRepo.registerPrinter({
      id: p1Id,
      shopId,
      name: 'HP LaserJet Pro M401dne (B&W High-Speed)',
      systemDriverName: 'HP LaserJet Pro M401 PCL6',
      isOnline: true,
      isDefault: true,
      supportsColor: false,
      supportsDuplex: true,
      lastHeartbeat: now,
      trays: [
        { id: 'tray-1', name: 'Tray 1 (A4 Standard)', supportedSizes: ['A4', 'PLAIN'], isDefault: true },
        { id: 'tray-2', name: 'Tray 2 (Manual Bypass)', supportedSizes: ['A4', 'PLAIN'], isDefault: false },
      ],
    });

    printerRepo.registerPrinter({
      id: p2Id,
      shopId,
      name: 'Canon imageRUNNER ADVANCE C3530i (Color/Multi-Format)',
      systemDriverName: 'Canon Generic Plus PCL6',
      isOnline: true,
      isDefault: false,
      supportsColor: true,
      supportsDuplex: true,
      lastHeartbeat: now,
      trays: [
        { id: 'tray-c1', name: 'Tray 1 (A4 Plain)', supportedSizes: ['A4', 'PLAIN'], isDefault: true },
        { id: 'tray-c2', name: 'Tray 2 (A3 Heavy)', supportedSizes: ['A3', 'PLAIN'], isDefault: false },
        { id: 'tray-c3', name: 'Tray 3 (Photo 4x6 / 5x7)', supportedSizes: ['PHOTO_4X6', 'PHOTO_5X7', 'GLOSSY'], isDefault: false },
      ],
    });
  }

  // 4. Pricing Rules
  pricingRepo.setRateRule({
    id: 'rate-a4-bw-simplex',
    shopId,
    paperSize: 'A4',
    colorMode: 'bw',
    duplexMode: 'simplex',
    pricePerPrintedSidePaise: 200, // ₹2.00
  });

  pricingRepo.setRateRule({
    id: 'rate-a4-bw-duplex',
    shopId,
    paperSize: 'A4',
    colorMode: 'bw',
    duplexMode: 'duplex_auto',
    pricePerPrintedSidePaise: 150, // ₹1.50 per side
  });

  pricingRepo.setRateRule({
    id: 'rate-a4-color-simplex',
    shopId,
    paperSize: 'A4',
    colorMode: 'color',
    duplexMode: 'simplex',
    pricePerPrintedSidePaise: 1000, // ₹10.00
  });

  pricingRepo.setRateRule({
    id: 'rate-a4-color-duplex',
    shopId,
    paperSize: 'A4',
    colorMode: 'color',
    duplexMode: 'duplex_auto',
    pricePerPrintedSidePaise: 800, // ₹8.00 per side
  });

  pricingRepo.setRateRule({
    id: 'rate-a3-bw-simplex',
    shopId,
    paperSize: 'A3',
    colorMode: 'bw',
    duplexMode: 'simplex',
    pricePerPrintedSidePaise: 500, // ₹5.00
  });

  pricingRepo.setRateRule({
    id: 'rate-a3-color-simplex',
    shopId,
    paperSize: 'A3',
    colorMode: 'color',
    duplexMode: 'simplex',
    pricePerPrintedSidePaise: 2000, // ₹20.00
  });

  pricingRepo.setRateRule({
    id: 'rate-photo-4x6-glossy',
    shopId,
    paperSize: 'PHOTO_4X6',
    colorMode: 'color',
    duplexMode: 'simplex',
    pricePerPrintedSidePaise: 1500, // ₹15.00
  });

  // Bulk Discount Rule
  pricingRepo.setBulkDiscountRule({
    id: 'bulk-discount-campus1',
    shopId,
    minOrderValuePaise: 10000, // Orders over ₹100
    discountPercentage: 10, // 10% discount
    isEnabled: true,
  });

  // 5. WhatsApp Bot Templates
  userRepo.upsertBotTemplate(
    shopId,
    'GREETING',
    'Hello! Welcome to Campus Print Express. You can upload documents directly to our queue at https://inklly.com/p/campus1',
    true
  );
  userRepo.upsertBotTemplate(
    shopId,
    'ORDER_READY',
    'Your print order {{order_number}} is ready! Please collect it from Counter 1.',
    true
  );

  // 6. Developer Keys
  const existingKey = db.queryOne<{ id: string }>('SELECT id FROM developer_keys WHERE id = ?', ['key-dev-demo-1']);
  if (!existingKey) {
    agentRepo.createDeveloperKey({
      id: 'key-dev-demo-1',
      organizationId: orgId,
      keyName: 'Campus Automation Key',
      keyPrefix: 'ink_test_',
      secretHash: 'hash_test_sec_campus_987',
      scopes: ['orders:read', 'orders:write', 'printers:read'],
      environment: 'TEST',
      isActive: true,
      createdAt: now,
    });
  }

  // 7. Seed sample incoming pending order
  if (!orderRepo.getOrderByNumber('INK-DEMO-001')) {
    orderRepo.createOrder({
      id: 'order-demo-001',
      shopId,
      orderNumber: 'INK-DEMO-001',
      customerName: 'Aarav Sharma',
      customerPhone: '+91 91234 56789',
      channel: 'QR_PORTAL',
      status: 'AWAITING_REVIEW',
      paymentStatus: 'VERIFIED',
      paymentMethod: 'ONLINE_RAZORPAY',
      totalAmountPaise: 2000,
      currency: 'INR',
      quoteVersion: 'v1-demo',
      createdAt: now,
      updatedAt: now,
      files: [
        {
          id: 'file-demo-001',
          orderId: 'order-demo-001',
          fileName: 'Final_Project_Report.pdf',
          fileSizeBytes: 2450000,
          mimeType: 'application/pdf',
          storageKey: 'uploads/demo/Final_Project_Report.pdf',
          pageCount: 10,
          printOptions: {
            colorMode: 'bw',
            duplexMode: 'simplex',
            paperSize: 'A4',
            orientation: 'portrait',
            copies: 1,
            fitMode: 'fit',
            pagesPerSheet: 1,
            collation: true,
          },
          lineSubtotalPaise: 2000,
        },
      ],
    });
  }
}
