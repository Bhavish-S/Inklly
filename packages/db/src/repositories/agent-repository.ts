import { DatabaseService } from '../database';
import * as crypto from 'node:crypto';
import {
  AgentHeartbeat,
  AgentRegistration,
  PrintCommandTicket,
  PrintJobStatus,
  SpoolerResult,
  validatePrintJobTransition,
} from '@inklly/shared';

export interface DeveloperKeyRecord {
  id: string;
  organizationId: string;
  shopId?: string;
  createdByUserId?: string;
  keyName: string;
  keyPrefix: string;
  secretHash: string;
  scopes: string[];
  environment: 'TEST' | 'LIVE';
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  revokedAt?: string;
}

export interface WebhookSubscriptionRecord {
  id: string;
  organizationId: string;
  targetUrl: string;
  secret: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryLease {
  deliveryId: string;
  organizationId: string;
  subscriptionId: string;
  targetUrl: string;
  encryptedSecret: string;
  eventId: string;
  eventType: string;
  eventCreatedAt: string;
  payloadJson: string;
  attemptCount: number;
}

export interface WebhookDeliveryHistoryRecord {
  deliveryId: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  payloadJson: string;
  status: string;
  attemptCount: number;
  nextAttemptAt: string;
  lastStatusCode: number | null;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
  attempts: Array<{ attemptNumber: number; statusCode: number | null; error: string | null; startedAt: string; completedAt: string | null }>;
}

const DISPATCH_ACK_LEASE_MS = 2 * 60 * 1000;

export class AgentRepository {
  constructor(private db: DatabaseService) {}

  public registerAgent(reg: AgentRegistration): void {
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO agent_registrations (
        id, shop_id, secret_key_hash, hostname, os_platform, os_version, agent_version, is_active, last_heartbeat, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        reg.agentId,
        reg.shopId,
        crypto.createHash('sha256').update(reg.secretKey).digest('hex'),
        reg.hostname,
        reg.osPlatform,
        reg.osVersion,
        reg.agentVersion,
        now,
        now,
        now,
      ]
    );
  }

  public issuePairingCode(shopId: string, createdBy: string, pairingCode: string, expiresAt: string): void {
    const now = new Date().toISOString();
    const codeHash = crypto.createHash('sha256').update(pairingCode).digest('hex');
    this.db.transaction(() => {
      this.db.execute('DELETE FROM agent_pairing_codes WHERE shop_id = ?', [shopId]);
      this.db.execute(
        `INSERT INTO agent_pairing_codes (id, shop_id, code_hash, expires_at, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), shopId, codeHash, expiresAt, createdBy, now]
      );
    });
  }

  public consumePairingCode(shopId: string, pairingCode: string): boolean {
    const codeHash = crypto.createHash('sha256').update(pairingCode).digest('hex');
    // A single conditional delete is the consume operation, so concurrent requests can
    // never both enroll with the same one-time code.
    const consumed = this.db.queryOne<any>(
      `DELETE FROM agent_pairing_codes WHERE shop_id = ? AND code_hash = ? AND expires_at > ? RETURNING id`,
      [shopId, codeHash, new Date().toISOString()]
    );
    return Boolean(consumed);
  }

  public authenticateAgent(agentId: string, secret: string): { agentId: string; shopId: string } | null {
    if (!agentId || typeof secret !== 'string' || secret.length < 40 || secret.length > 100) return null;
    const row = this.db.queryOne<any>(
      `SELECT ar.id, ar.shop_id, ar.secret_key_hash
       FROM agent_registrations ar
       JOIN shops s ON s.id = ar.shop_id
       WHERE ar.id = ? AND ar.is_active = 1 AND s.is_active = 1`,
      [agentId]
    );
    if (!row) return null;
    const expected = Buffer.from(row.secret_key_hash, 'hex');
    const supplied = crypto.createHash('sha256').update(secret).digest();
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
    return { agentId: row.id, shopId: row.shop_id };
  }

  public revokeAgent(agentId: string, shopId: string): boolean {
    const row = this.db.queryOne<any>(
      `SELECT id FROM agent_registrations WHERE id = ? AND shop_id = ? AND is_active = 1`,
      [agentId, shopId]
    );
    if (!row) return false;
    this.db.execute(`UPDATE agent_registrations SET is_active = 0, updated_at = ? WHERE id = ?`, [new Date().toISOString(), agentId]);
    return true;
  }

  public getAgentByShop(shopId: string): AgentRegistration | null {
    const row = this.db.queryOne<any>(
      `SELECT * FROM agent_registrations WHERE shop_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1`,
      [shopId]
    );
    if (!row) return null;
    return {
      agentId: row.id,
      shopId: row.shop_id,
      secretKey: '',
      hostname: row.hostname,
      osPlatform: row.os_platform,
      osVersion: row.os_version,
      agentVersion: row.agent_version,
    };
  }

  public recordHeartbeat(hb: AgentHeartbeat): void {
    const now = new Date().toISOString();
    this.db.execute(
      `UPDATE agent_registrations SET last_heartbeat = ?, updated_at = ? WHERE id = ? AND shop_id = ? AND is_active = 1`,
      [now, now, hb.agentId, hb.shopId]
    );
  }

  public getPendingPrintTickets(shopId: string, agentId: string): PrintCommandTicket[] {
    return this.db.transaction(() => {
      const now = new Date();
      const nowIso = now.toISOString();
      const leaseCutoff = new Date(now.getTime() - DISPATCH_ACK_LEASE_MS).toISOString();
      const expired = this.db.query<any>(
        `SELECT pa.id AS attempt_id, pj.id AS job_id
         FROM print_attempts pa JOIN print_jobs pj ON pj.id = pa.print_job_id
         JOIN orders o ON o.id = pj.order_id
         WHERE o.shop_id = ? AND pa.agent_id = ? AND pj.status = 'DISPATCHED'
           AND pa.status = 'DISPATCHED_TO_AGENT' AND pa.dispatch_acknowledged_at IS NULL
           AND pa.created_at <= ?`,
        [shopId, agentId, leaseCutoff]
      );
      for (const row of expired) {
        const expiredAttempt = this.db.queryOne<any>(
          `UPDATE print_attempts SET status = 'OUTPUT_UNCERTAIN', error_details = ?, updated_at = ?
           WHERE id = ? AND status = 'DISPATCHED_TO_AGENT' AND dispatch_acknowledged_at IS NULL RETURNING id`,
          ['Agent did not acknowledge command delivery before the dispatch lease expired; physical output is unknown.', nowIso, row.attempt_id]
        );
        if (expiredAttempt) {
          this.db.execute(`UPDATE print_jobs SET status = 'OUTPUT_UNCERTAIN', updated_at = ? WHERE id = ? AND status = 'DISPATCHED'`, [nowIso, row.job_id]);
        }
      }

      const rows = this.db.query<any>(
        `SELECT pj.id AS job_id, pj.order_id, pj.printer_id, pj.status AS job_status,
                of.id AS file_id, of.file_name, of.storage_key, of.print_options,
                p.id AS target_printer_id, p.name AS target_printer_name, pa.id AS existing_attempt_id,
                pa.created_at AS existing_attempt_created_at
         FROM print_jobs pj
         JOIN orders o ON pj.order_id = o.id
         JOIN order_files of ON pj.order_file_id = of.id
         LEFT JOIN printers p ON pj.printer_id = p.id
         LEFT JOIN print_attempts pa ON pa.id = (
           SELECT pa2.id FROM print_attempts pa2 WHERE pa2.print_job_id = pj.id ORDER BY pa2.created_at DESC LIMIT 1
         )
         WHERE o.shop_id = ?
           AND EXISTS (SELECT 1 FROM shops active_shop WHERE active_shop.id = o.shop_id AND active_shop.is_active = 1)
           AND p.id IS NOT NULL AND p.is_online = 1 AND p.agent_id = ?
           AND o.status IN ('READY_FOR_PRINT', 'IN_PROGRESS')
           AND (o.payment_method <> 'ONLINE_RAZORPAY' OR o.payment_status = 'VERIFIED')
           AND (
           pj.status = 'RECEIVED' OR
           (pj.status = 'DISPATCHED' AND pa.status = 'DISPATCHED_TO_AGENT'
             AND pa.agent_id = ? AND pa.dispatch_acknowledged_at IS NULL AND pa.created_at > ?)
         )
         ORDER BY pj.created_at ASC`,
        [shopId, agentId, agentId, leaseCutoff]
      );

      return rows.flatMap((r): PrintCommandTicket[] => {
        let attemptId = r.existing_attempt_id as string | null;
        if (r.job_status === 'RECEIVED') {
          const claimed = this.db.queryOne<any>(
            `UPDATE print_jobs SET status = 'DISPATCHED', updated_at = ? WHERE id = ? AND status = 'RECEIVED' RETURNING id`,
            [nowIso, r.job_id]
          );
          if (!claimed) return [];
          attemptId = `att-${crypto.randomUUID()}`;
          this.db.execute(
            `INSERT INTO print_attempts (id, print_job_id, printer_id, agent_id, attempt_number, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, 'DISPATCHED_TO_AGENT', ?, ?)`,
            [attemptId, r.job_id, r.target_printer_id, agentId, nowIso, nowIso]
          );
        }
        if (!attemptId) return [];

        const cleanBase = (process.env.SERVER_BASE_URL || process.env.INKLLY_SERVER_URL || 'https://inklly.onrender.com').replace(/\/api\/v1\/?$/, '');
        return [{
          commandId: `cmd-${attemptId}`,
          jobId: r.job_id,
          attemptId,
          shopId,
          printerId: r.target_printer_name,
          documentUrl: `${cleanBase}/api/v1/agent/files/${encodeURIComponent(r.file_id)}`,
          storageKey: r.storage_key,
          fileName: r.file_name,
          options: JSON.parse(r.print_options),
          expiresAt: new Date(Date.parse(r.job_status === 'RECEIVED' ? nowIso : r.existing_attempt_created_at) + DISPATCH_ACK_LEASE_MS).toISOString(),
          correlationId: `corr-${r.order_id}`,
        }];
      });
    });
  }

  public acknowledgeDispatch(commandId: string, attemptId: string, agentId: string, shopId: string): boolean {
    if (commandId !== `cmd-${attemptId}`) return false;
    return this.db.transaction(() => {
      const attempt = this.db.queryOne<any>(
        `SELECT pa.status, pa.dispatch_acknowledged_at
         FROM print_attempts pa JOIN print_jobs pj ON pj.id = pa.print_job_id
         JOIN orders o ON o.id = pj.order_id
         WHERE pa.id = ? AND pa.agent_id = ? AND o.shop_id = ?`,
        [attemptId, agentId, shopId]
      );
      if (!attempt) return false;
      if (attempt.dispatch_acknowledged_at) return true;
      if (attempt.status !== 'DISPATCHED_TO_AGENT') return false;
      const acknowledged = this.db.queryOne<any>(
        `UPDATE print_attempts SET dispatch_acknowledged_at = ?, updated_at = ?
         WHERE id = ? AND agent_id = ? AND status = 'DISPATCHED_TO_AGENT'
           AND dispatch_acknowledged_at IS NULL AND created_at > ? RETURNING id`,
        [new Date().toISOString(), new Date().toISOString(), attemptId, agentId, new Date(Date.now() - DISPATCH_ACK_LEASE_MS).toISOString()]
      );
      return Boolean(acknowledged);
    });
  }

  public recordCommandResult(result: SpoolerResult, agentId: string, shopId: string): boolean {
    const now = new Date().toISOString();

    if (!['SUBMITTED_TO_SPOOLER', 'OUTPUT_UNCERTAIN', 'FAILED'].includes(result.status)) return false;
    return this.db.transaction(() => {
    const ownedAttempt = this.db.queryOne<any>(
      `SELECT pa.status AS attempt_status, pa.dispatch_acknowledged_at, pj.status AS job_status
       FROM print_attempts pa
       JOIN print_jobs pj ON pj.id = pa.print_job_id
       JOIN orders o ON o.id = pj.order_id
       WHERE pa.id = ? AND pj.id = ? AND pa.agent_id = ? AND o.shop_id = ?`,
      [result.attemptId, result.jobId, agentId, shopId]
    );
    if (!ownedAttempt) return false;
    if (!ownedAttempt.dispatch_acknowledged_at) return false;
    // A later operator reconciliation is authoritative for the job state. A
    // delayed agent report may be acknowledged, but must never regress it.
    if (ownedAttempt.job_status === 'PRINT_CONFIRMED') return true;

    // Map spooler result to PrintJobStatus
    let nextJobStatus: PrintJobStatus;
    let nextAttemptStatus: string;

    if (result.status === 'OUTPUT_UNCERTAIN') {
      // CRITICAL HARDWARE SAFETY: Must NEVER blind retry
      nextJobStatus = 'OUTPUT_UNCERTAIN';
      nextAttemptStatus = 'OUTPUT_UNCERTAIN';
    } else if (result.status === 'SUBMITTED_TO_SPOOLER') {
      nextJobStatus = 'SUBMITTED_TO_SPOOLER';
      nextAttemptStatus = 'SPOOLING';
    } else {
      nextJobStatus = 'DISPATCH_FAILED';
      nextAttemptStatus = 'FAILED';
    }

    if (['SUCCESS', 'OUTPUT_UNCERTAIN', 'FAILED'].includes(ownedAttempt.attempt_status)) {
      return ownedAttempt.attempt_status === nextAttemptStatus;
    }
    if (!['DISPATCHED_TO_AGENT', 'SPOOLING'].includes(ownedAttempt.attempt_status)) return false;

    // Update attempt
    this.db.execute(
      `UPDATE print_attempts SET status = ?, error_details = ?, updated_at = ? WHERE id = ? AND agent_id = ?`,
      [nextAttemptStatus, typeof result.errorMessage === 'string' ? result.errorMessage.slice(0, 1000) : null, now, result.attemptId, agentId]
    );

    // Update print job
    this.db.execute(
      `UPDATE print_jobs SET status = ?, updated_at = ? WHERE id = ?`,
      [nextJobStatus, now, result.jobId]
    );

    return true;
    });
  }

  // Developer Keys
  public createDeveloperKey(key: DeveloperKeyRecord): void {
    this.db.execute(
      `INSERT INTO developer_keys (id, organization_id, shop_id, created_by_user_id, key_name, key_prefix, secret_hash, scopes, environment, is_active, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        key.id,
        key.organizationId,
        key.shopId || null,
        key.createdByUserId || null,
        key.keyName,
        key.keyPrefix,
        key.secretHash,
        JSON.stringify(key.scopes),
        key.environment,
        key.expiresAt || null,
        key.createdAt,
      ]
    );
  }

  public authenticateDeveloperKey(secretHash: string, environment: 'TEST' | 'LIVE', now = new Date().toISOString()): (DeveloperKeyRecord & { shopId: string; createdByUserId: string }) | null {
    const row = this.db.queryOne<any>(
      `SELECT * FROM developer_keys WHERE secret_hash = ? AND environment = ? AND is_active = 1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?) AND shop_id IS NOT NULL AND created_by_user_id IS NOT NULL`,
      [secretHash, environment, now]
    );
    if (!row) return null;
    let scopes: unknown;
    try { scopes = JSON.parse(row.scopes); } catch { return null; }
    if (!Array.isArray(scopes) || !scopes.every((scope) => typeof scope === 'string')) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      shopId: row.shop_id,
      createdByUserId: row.created_by_user_id,
      keyName: row.key_name,
      keyPrefix: row.key_prefix,
      secretHash: row.secret_hash,
      scopes,
      environment: row.environment,
      isActive: Boolean(row.is_active),
      expiresAt: row.expires_at || undefined,
      createdAt: row.created_at,
      revokedAt: row.revoked_at || undefined,
    };
  }

  public getDeveloperKeysByOrg(orgId: string): DeveloperKeyRecord[] {
    const rows = this.db.query<any>(
      `SELECT * FROM developer_keys WHERE organization_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`,
      [orgId]
    );
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      shopId: r.shop_id || undefined,
      createdByUserId: r.created_by_user_id || undefined,
      keyName: r.key_name,
      keyPrefix: r.key_prefix,
      secretHash: r.secret_hash,
      scopes: JSON.parse(r.scopes),
      environment: r.environment as 'TEST' | 'LIVE',
      isActive: Boolean(r.is_active),
      expiresAt: r.expires_at || undefined,
      createdAt: r.created_at,
      revokedAt: r.revoked_at || undefined,
    }));
  }

  public revokeDeveloperKey(keyId: string, orgId: string): void {
    const now = new Date().toISOString();
    this.db.execute(
      `UPDATE developer_keys SET is_active = 0, revoked_at = ? WHERE id = ? AND organization_id = ?`,
      [now, keyId, orgId]
    );
  }

  // Webhooks
  public migrateLegacyWebhookSecrets(encryptSecret: (secret: string) => string): number {
    const legacyRows = this.db.query<any>(
      `SELECT id, secret FROM webhook_subscriptions WHERE secret NOT LIKE 'inklly:enc:v1:webhook:%'`
    );
    if (!legacyRows.length) return 0;
    this.db.transaction(() => {
      for (const row of legacyRows) {
        const encrypted = encryptSecret(String(row.secret));
        this.db.execute(
          `UPDATE webhook_subscriptions SET secret = ?, updated_at = ? WHERE id = ? AND secret = ?`,
          [encrypted, new Date().toISOString(), row.id, row.secret]
        );
      }
    });
    return legacyRows.length;
  }

  public createWebhookSubscription(sub: WebhookSubscriptionRecord): void {
    this.db.execute(
      `INSERT INTO webhook_subscriptions (id, organization_id, target_url, secret, event_types, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sub.id,
        sub.organizationId,
        sub.targetUrl,
        sub.secret,
        JSON.stringify(sub.eventTypes),
        sub.isActive ? 1 : 0,
        sub.createdAt,
        sub.updatedAt,
      ]
    );
  }

  public rotateWebhookSecret(subscriptionId: string, orgId: string, encryptedSecret: string): 'ROTATED' | 'IN_PROGRESS' | 'NOT_FOUND' {
    return this.db.transaction(() => {
      const subscription = this.db.queryOne<any>(
        `UPDATE webhook_subscriptions SET updated_at = updated_at
         WHERE id = ? AND organization_id = ? AND is_active = 1 RETURNING id`,
        [subscriptionId, orgId]
      );
      if (!subscription) return 'NOT_FOUND';
      const active = this.db.queryOne<any>(
        `SELECT COUNT(*) AS count FROM webhook_deliveries WHERE subscription_id = ? AND organization_id = ? AND status = 'IN_PROGRESS'`,
        [subscriptionId, orgId]
      );
      if (Number(active?.count || 0) > 0) return 'IN_PROGRESS';
      this.db.execute(
        `UPDATE webhook_subscriptions SET secret = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND is_active = 1`,
        [encryptedSecret, new Date().toISOString(), subscriptionId, orgId]
      );
      return 'ROTATED';
    });
  }

  public revokeWebhookSubscription(subscriptionId: string, orgId: string): boolean {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const revoked = this.db.queryOne<any>(
        `UPDATE webhook_subscriptions SET is_active = 0, updated_at = ?
         WHERE id = ? AND organization_id = ? AND is_active = 1 RETURNING id`,
        [now, subscriptionId, orgId]
      );
      if (!revoked) return false;
      this.db.execute(
        `UPDATE webhook_deliveries SET status = 'CANCELLED', lease_until = NULL, updated_at = ?
         WHERE subscription_id = ? AND organization_id = ? AND status = 'PENDING'`,
        [now, subscriptionId, orgId]
      );
      return true;
    });
  }

  public hasWebhookSubscription(subscriptionId: string, orgId: string): boolean {
    return Boolean(this.db.queryOne<any>(
      `SELECT id FROM webhook_subscriptions WHERE id = ? AND organization_id = ?`, [subscriptionId, orgId]
    ));
  }

  public getWebhooksByOrg(orgId: string): WebhookSubscriptionRecord[] {
    const rows = this.db.query<any>(
      `SELECT * FROM webhook_subscriptions WHERE organization_id = ? ORDER BY is_active DESC, created_at DESC`,
      [orgId]
    );
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      targetUrl: r.target_url,
      secret: r.secret,
      eventTypes: JSON.parse(r.event_types),
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /** Persist an event and fan it out once to subscriptions active at event time. */
  public enqueueWebhookEvent(organizationId: string, eventType: string, idempotencyKey: string, payload: unknown): string {
    const now = new Date().toISOString();
    const eventId = `evt-${crypto.randomUUID()}`;
    const payloadJson = JSON.stringify(payload);
    if (typeof payloadJson !== 'string') throw new Error('Webhook event payload must be JSON serializable.');
    return this.db.transaction(() => {
      this.db.execute(
        `INSERT INTO webhook_events (id, organization_id, event_type, idempotency_key, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (organization_id, idempotency_key) DO NOTHING`,
        [eventId, organizationId, eventType, idempotencyKey, payloadJson, now]
      );
      const event = this.db.queryOne<any>(
        `SELECT id FROM webhook_events WHERE organization_id = ? AND idempotency_key = ?`,
        [organizationId, idempotencyKey]
      );
      if (!event) throw new Error('Webhook event could not be persisted.');
      const subscriptions = this.db.query<any>(
        `SELECT id, event_types FROM webhook_subscriptions WHERE organization_id = ? AND is_active = 1`,
        [organizationId]
      );
      for (const subscription of subscriptions) {
        let eventTypes: unknown;
        try { eventTypes = JSON.parse(String(subscription.event_types)); } catch { continue; }
        if (!Array.isArray(eventTypes) || !eventTypes.includes(eventType)) continue;
        const deliveryId = `whd-${crypto.randomUUID()}`;
        this.db.execute(
          `INSERT INTO webhook_deliveries (id, organization_id, subscription_id, event_id, status, attempt_count, next_attempt_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'PENDING', 0, ?, ?, ?) ON CONFLICT (subscription_id, event_id) DO NOTHING`,
          [deliveryId, organizationId, subscription.id, event.id, now, now, now]
        );
      }
      return String(event.id);
    });
  }

  /** Atomically lease due records so multiple server workers do not send the same delivery. */
  public claimDueWebhookDeliveries(limit: number, leaseMs: number): WebhookDeliveryLease[] {
    const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const boundedLeaseMs = Math.max(5_000, Math.min(300_000, Math.floor(leaseMs)));
    const now = new Date();
    const nowIso = now.toISOString();
    const leaseUntil = new Date(now.getTime() + boundedLeaseMs).toISOString();
    return this.db.transaction(() => {
      const candidates = this.db.query<any>(
        `SELECT id, status, lease_until FROM webhook_deliveries
         WHERE (status = 'PENDING' AND next_attempt_at <= ?)
            OR (status = 'IN_PROGRESS' AND lease_until IS NOT NULL AND lease_until <= ?)
         ORDER BY next_attempt_at ASC, created_at ASC LIMIT ?`,
        [nowIso, nowIso, boundedLimit]
      );
      const claimed: WebhookDeliveryLease[] = [];
      for (const candidate of candidates) {
        const oldStatus = String(candidate.status);
        const oldLease = candidate.lease_until === null ? null : String(candidate.lease_until);
        const leasePredicate = oldLease === null ? 'lease_until IS NULL' : 'lease_until = ?';
        const updateParams: Array<string | number | null> = [leaseUntil, nowIso, candidate.id, oldStatus];
        if (oldLease !== null) updateParams.push(oldLease);
        const updated = this.db.queryOne<any>(
          `UPDATE webhook_deliveries SET status = 'IN_PROGRESS', lease_until = ?, attempt_count = attempt_count + 1, updated_at = ?
           WHERE id = ? AND status = ? AND ${leasePredicate}
           RETURNING id, organization_id, subscription_id, event_id, attempt_count`,
          updateParams
        );
        if (!updated) continue;
        const joined = this.db.queryOne<any>(
          `SELECT wd.id AS delivery_id, wd.organization_id, wd.subscription_id, wd.event_id, wd.attempt_count,
          ws.target_url, ws.secret, we.event_type, we.payload_json, we.created_at AS event_created_at
           FROM webhook_deliveries wd
           JOIN webhook_subscriptions ws ON ws.id = wd.subscription_id AND ws.organization_id = wd.organization_id AND ws.is_active = 1
           JOIN webhook_events we ON we.id = wd.event_id AND we.organization_id = wd.organization_id
           WHERE wd.id = ? AND wd.status = 'IN_PROGRESS' AND wd.lease_until = ?`,
          [updated.id, leaseUntil]
        );
        if (!joined) {
          this.db.execute(`UPDATE webhook_deliveries SET status = 'FAILED', lease_until = NULL, last_error = ?, updated_at = ? WHERE id = ?`,
            ['Webhook subscription or event is no longer available.', nowIso, updated.id]);
          continue;
        }
        this.db.execute(
          `INSERT INTO webhook_delivery_attempts (id, delivery_id, attempt_number, started_at)
           VALUES (?, ?, ?, ?)`,
          [`wha-${crypto.randomUUID()}`, joined.delivery_id, Number(joined.attempt_count), nowIso]
        );
        claimed.push({
          deliveryId: String(joined.delivery_id), organizationId: String(joined.organization_id),
          subscriptionId: String(joined.subscription_id), targetUrl: String(joined.target_url),
          encryptedSecret: String(joined.secret), eventId: String(joined.event_id),
          eventType: String(joined.event_type), eventCreatedAt: String(joined.event_created_at), payloadJson: String(joined.payload_json),
          attemptCount: Number(joined.attempt_count),
        });
      }
      return claimed;
    });
  }

  /** Finish one leased attempt. Retry timing and terminal classification are chosen by the worker. */
  public recordWebhookDeliveryResult(
    deliveryId: string,
    success: boolean,
    statusCode: number | null,
    safeError: string | null,
    nextAttemptAt: string | null,
    permanentlyFailed = false
  ): void {
    const now = new Date().toISOString();
    const boundedStatus = statusCode !== null && Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599 ? statusCode : null;
    const boundedError = safeError ? String(safeError).slice(0, 500) : null;
    this.db.transaction(() => {
      const row = this.db.queryOne<any>(
        `SELECT attempt_count FROM webhook_deliveries WHERE id = ? AND status = 'IN_PROGRESS'`, [deliveryId]
      );
      if (!row) return;
      this.db.execute(
        `UPDATE webhook_delivery_attempts SET status_code = ?, error = ?, completed_at = ?
         WHERE delivery_id = ? AND attempt_number = ? AND completed_at IS NULL`,
        [boundedStatus, boundedError, now, deliveryId, Number(row.attempt_count)]
      );
      const status = success ? 'DELIVERED' : permanentlyFailed ? 'FAILED' : 'PENDING';
      const deliveredAt = success ? now : null;
      this.db.execute(
        `UPDATE webhook_deliveries SET status = ?, next_attempt_at = ?, lease_until = NULL,
         last_status_code = ?, last_error = ?, delivered_at = ?, updated_at = ?
         WHERE id = ? AND status = 'IN_PROGRESS'`,
        [status, nextAttemptAt || now, boundedStatus, success ? null : boundedError, deliveredAt, now, deliveryId]
      );
    });
  }

  /** Tenant-scoped delivery history. Encrypted subscription secrets are never returned. */
  public listWebhookDeliveries(orgId: string, subscriptionId?: string, limit = 50, offset = 0): WebhookDeliveryHistoryRecord[] {
    const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const boundedOffset = Math.max(0, Math.floor(offset));
    const filter = subscriptionId ? ' AND wd.subscription_id = ?' : '';
    const params: Array<string | number | null> = [orgId];
    if (subscriptionId) params.push(subscriptionId);
    params.push(boundedLimit, boundedOffset);
    const rows = this.db.query<any>(
      `SELECT wd.id AS delivery_id, wd.subscription_id, wd.event_id, we.event_type, we.payload_json,
              wd.status, wd.attempt_count, wd.next_attempt_at, wd.last_status_code, wd.last_error,
              wd.delivered_at, wd.created_at
       FROM webhook_deliveries wd JOIN webhook_events we ON we.id = wd.event_id AND we.organization_id = wd.organization_id
       WHERE wd.organization_id = ?${filter}
       ORDER BY wd.created_at DESC, wd.id DESC LIMIT ? OFFSET ?`, params
    );
    return rows.map((row) => {
      const attempts = this.db.query<any>(
        `SELECT attempt_number, status_code, error, started_at, completed_at FROM webhook_delivery_attempts
         WHERE delivery_id = ? ORDER BY attempt_number ASC`, [row.delivery_id]
      );
      return {
        deliveryId: String(row.delivery_id), subscriptionId: String(row.subscription_id), eventId: String(row.event_id),
        eventType: String(row.event_type), payloadJson: String(row.payload_json), status: String(row.status),
        attemptCount: Number(row.attempt_count), nextAttemptAt: String(row.next_attempt_at),
        lastStatusCode: row.last_status_code === null ? null : Number(row.last_status_code),
        lastError: row.last_error === null ? null : String(row.last_error),
        deliveredAt: row.delivered_at === null ? null : String(row.delivered_at), createdAt: String(row.created_at),
        attempts: attempts.map((attempt) => ({
          attemptNumber: Number(attempt.attempt_number),
          statusCode: attempt.status_code === null ? null : Number(attempt.status_code),
          error: attempt.error === null ? null : String(attempt.error),
          startedAt: String(attempt.started_at), completedAt: attempt.completed_at === null ? null : String(attempt.completed_at),
        })),
      };
    });
  }
}
