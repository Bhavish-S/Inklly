-- Inklly Core Relational Database Schema (SQLite / PostgreSQL Compatible)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS inklly_schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    plan_tier TEXT NOT NULL DEFAULT 'STARTER',
    plan_status TEXT NOT NULL DEFAULT 'ACTIVE',
    billing_currency TEXT NOT NULL DEFAULT 'INR',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    shop_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    tagline TEXT,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    gstin TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_gateway TEXT NOT NULL DEFAULT 'RAZORPAY',
    accept_cash_on_collection INTEGER NOT NULL DEFAULT 1,
    auto_print_mode TEXT NOT NULL DEFAULT 'MANUAL_OFF',
    order_separator TEXT NOT NULL DEFAULT 'NONE',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shops_shop_code ON shops(shop_code);
CREATE INDEX IF NOT EXISTS idx_shops_org ON shops(organization_id);

CREATE TABLE IF NOT EXISTS shop_payment_credentials (
    shop_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    key_id TEXT NOT NULL,
    encrypted_secret TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'MERCHANT_OWNER',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS public_enquiries (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE,
    source TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    message TEXT NOT NULL,
    city TEXT,
    state TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_enquiries_status_created ON public_enquiries(status, created_at);

CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    shop_id TEXT,
    role TEXT NOT NULL DEFAULT 'SHOP_STAFF',
    permissions TEXT NOT NULL, -- JSON array of granted permission strings
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_shop ON memberships(shop_id);

CREATE TABLE IF NOT EXISTS printers (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    name TEXT NOT NULL,
    system_driver_name TEXT NOT NULL,
    is_online INTEGER NOT NULL DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0,
    supports_color INTEGER NOT NULL DEFAULT 0,
    supports_duplex INTEGER NOT NULL DEFAULT 0,
    last_heartbeat TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_printers_shop ON printers(shop_id);

CREATE TABLE IF NOT EXISTS paper_trays (
    id TEXT PRIMARY KEY,
    printer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    supported_sizes TEXT NOT NULL, -- JSON array of sizes: ["A4", "A3"]
    is_default INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rate_rules (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    printer_id TEXT, -- NULL means shop default rate
    paper_size TEXT NOT NULL,
    color_mode TEXT NOT NULL,
    duplex_mode TEXT NOT NULL,
    price_per_printed_side_paise INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rate_rules_lookup ON rate_rules(shop_id, paper_size, color_mode, duplex_mode);

CREATE TABLE IF NOT EXISTS copy_discount_rules (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    paper_size TEXT NOT NULL,
    color_mode TEXT NOT NULL,
    duplex_mode TEXT NOT NULL,
    copy_one_price_paise INTEGER NOT NULL,
    additional_copy_price_paise INTEGER NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bulk_discount_rules (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    min_order_value_paise INTEGER NOT NULL,
    discount_percentage INTEGER NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Merchant vault records are separate from temporary customer-order uploads.
CREATE TABLE IF NOT EXISTS storage_categories (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    document_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE (shop_id, id),
    UNIQUE (shop_id, name),
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_storage_categories_shop ON storage_categories(shop_id, created_at);

CREATE TABLE IF NOT EXISTS storage_documents (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    category_id TEXT,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 1,
    storage_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (shop_id, category_id) REFERENCES storage_categories(shop_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_storage_documents_shop_created ON storage_documents(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_storage_documents_category ON storage_documents(category_id);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    token_number TEXT NOT NULL DEFAULT '',
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    channel TEXT NOT NULL DEFAULT 'QR_PORTAL',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    payment_status TEXT NOT NULL DEFAULT 'NOT_STARTED',
    payment_method TEXT NOT NULL DEFAULT 'CASH_ON_COLLECTION',
    total_amount_paise INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    quote_version TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    collected_at TEXT,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token_number);

CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON orders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Deduplicates public customer order submissions across retries/timeouts.
CREATE TABLE IF NOT EXISTS portal_order_idempotency (
    shop_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    order_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (shop_id, idempotency_key),
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_portal_order_idempotency_created ON portal_order_idempotency(created_at);

CREATE TABLE IF NOT EXISTS order_files (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    print_options TEXT NOT NULL, -- JSON object PrintOptions
    line_subtotal_paise INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_files_order ON order_files(order_id);

CREATE TABLE IF NOT EXISTS print_jobs (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    order_file_id TEXT NOT NULL,
    printer_id TEXT,
    status TEXT NOT NULL DEFAULT 'RECEIVED',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (order_file_id) REFERENCES order_files(id) ON DELETE CASCADE,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_order ON print_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);

CREATE TABLE IF NOT EXISTS print_attempts (
    id TEXT PRIMARY KEY,
    print_job_id TEXT NOT NULL,
    printer_id TEXT NOT NULL,
    agent_id TEXT,
    dispatch_acknowledged_at TEXT,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'CREATED',
    error_details TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (print_job_id) REFERENCES print_jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'RAZORPAY', 'STRIPE', 'MANUAL_CASH'
    provider_transaction_id TEXT,
    provider_event_id TEXT,
    amount_paise INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_tx ON payments(provider, provider_transaction_id);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL, -- 'CUSTOMER_PRINT_PAYMENT', 'SAAS_SUBSCRIPTION', 'CONVERSION_CREDIT', etc.
    organization_id TEXT,
    shop_id TEXT,
    order_id TEXT,
    amount_paise INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    provider TEXT NOT NULL,
    provider_transaction_id TEXT,
    provider_event_id TEXT,
    description TEXT NOT NULL,
    metadata TEXT, -- JSON
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_domain_org ON ledger_entries(domain, organization_id);
CREATE INDEX IF NOT EXISTS idx_ledger_shop ON ledger_entries(shop_id);

CREATE TABLE IF NOT EXISTS agent_registrations (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    secret_key_hash TEXT NOT NULL,
    hostname TEXT,
    os_platform TEXT,
    os_version TEXT,
    agent_version TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_heartbeat TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_shop ON agent_registrations(shop_id);

CREATE TABLE IF NOT EXISTS agent_pairing_codes (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL UNIQUE,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT,
    actor_role TEXT,
    shop_id TEXT,
    organization_id TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    outcome TEXT NOT NULL, -- 'SUCCESS', 'DENIED', 'FAILED'
    ip_address TEXT,
    details TEXT, -- JSON
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_shop ON audit_events(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action);

CREATE TABLE IF NOT EXISTS developer_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    key_name TEXT NOT NULL,
    key_prefix TEXT NOT NULL, -- e.g. "ink_live_" or "ink_test_"
    secret_hash TEXT NOT NULL,
    scopes TEXT NOT NULL, -- JSON array of scopes
    environment TEXT NOT NULL DEFAULT 'TEST',
    is_active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    target_url TEXT NOT NULL,
    secret TEXT NOT NULL,
    event_types TEXT NOT NULL, -- JSON array
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bot_templates (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    template_key TEXT NOT NULL, -- 'GREETING', 'DOC_RECEIVED', 'ORDER_READY', etc.
    template_text TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    UNIQUE(shop_id, template_key)
);

CREATE TABLE IF NOT EXISTS razorpay_checkout_claims (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    payment_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_razorpay_claims_order ON razorpay_checkout_claims(order_id);

CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_shop ON razorpay_webhook_events(shop_id);

CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    payment_id TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'REQUESTED', -- REQUESTED, PROCESSING, COMPLETED, FAILED, REVERSED
    provider_refund_id TEXT,
    provider_event_id TEXT,
    reason TEXT,
    requested_by TEXT,
    requested_at TEXT NOT NULL,
    processed_at TEXT,
    failure_reason TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    plan_tier TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'TRIALING', -- TRIALING, ACTIVE, PAST_DUE, GRACE, CANCELLED, EXPIRED, SUSPENDED
    current_period_start TEXT NOT NULL,
    current_period_end TEXT NOT NULL,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    provider_subscription_id TEXT,
    provider_customer_id TEXT,
    amount_paise INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS credit_accounts (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL UNIQUE,
    balance_paise INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_shop ON credit_accounts(shop_id);

CREATE TABLE IF NOT EXISTS credit_ledger_entries (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    type TEXT NOT NULL, -- PURCHASE, CONSUMPTION, EXPIRY, REVERSAL, MANUAL_ADJUSTMENT, PLAN_ALLOCATION
    amount_paise INTEGER NOT NULL,
    reference_type TEXT, -- ORDER, SUBSCRIPTION, TOPUP, MANUAL
    reference_id TEXT,
    balance_after_paise INTEGER NOT NULL,
    expires_at TEXT,
    description TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_shop ON credit_ledger_entries(shop_id);

CREATE TABLE IF NOT EXISTS payout_requests (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, REQUESTED, ELIGIBILITY_CHECK, PENDING_APPROVAL, SUBMITTED_TO_PROVIDER, PROCESSING, PAID, FAILED, REVERSED, CANCELLED
    provider_payout_id TEXT,
    provider_status TEXT,
    destination_account_masked TEXT,
    requested_by TEXT,
    requested_at TEXT NOT NULL,
    approved_by TEXT,
    approved_at TEXT,
    processed_at TEXT,
    failure_reason TEXT,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_shop ON payout_requests(shop_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    theme TEXT NOT NULL DEFAULT 'light',
    language TEXT NOT NULL DEFAULT 'en-IN',
    email_notifications INTEGER NOT NULL DEFAULT 1,
    sms_notifications INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

CREATE TABLE IF NOT EXISTS account_invitations (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_invitations_expiry ON account_invitations(expires_at, accepted_at);
