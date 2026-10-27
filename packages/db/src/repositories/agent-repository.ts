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
      `SELECT id, shop_id, secret_key_hash FROM agent_registrations WHERE id = ? AND is_active = 1`,
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
    // Only RECEIVED jobs can be claimed. The conditional update below arbitrates concurrent polls.
    const rows = this.db.query<any>(
      `SELECT pj.id as job_id, pj.order_id, pj.order_file_id, pj.printer_id, of.id as file_id,
              of.file_name, of.storage_key, of.print_options,
              p.id as target_printer_id
       FROM print_jobs pj
       JOIN orders o ON pj.order_id = o.id
       JOIN order_files of ON pj.order_file_id = of.id
       LEFT JOIN printers p ON pj.printer_id = p.id
       WHERE o.shop_id = ? AND pj.status = 'RECEIVED'
       ORDER BY pj.created_at ASC`,
      [shopId]
    );

    return this.db.transaction(() => rows.flatMap((r): PrintCommandTicket[] => {
      const claimed = this.db.queryOne<any>(
        `UPDATE print_jobs SET status = 'DISPATCHED', updated_at = ? WHERE id = ? AND status = 'RECEIVED' RETURNING id`,
        [new Date().toISOString(), r.job_id]
      );
      if (!claimed) return [];

      const attemptId = `att-${crypto.randomUUID()}`;
      const commandId = `cmd-${crypto.randomUUID()}`;

      // Insert print attempt
      this.db.execute(
        `INSERT INTO print_attempts (id, print_job_id, printer_id, agent_id, attempt_number, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, 'DISPATCHED_TO_AGENT', ?, ?)`,
        [
          attemptId,
          r.job_id,
          r.target_printer_id || 'printer-hp-laserjet',
          agentId,
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      const cleanBase = (process.env.SERVER_BASE_URL || process.env.INKLLY_SERVER_URL || 'https://inklly.onrender.com').replace(/\/api\/v1\/?$/, '');
      const docUrl = `${cleanBase}/api/v1/agent/files/${encodeURIComponent(r.file_id)}`;

      return [{
        commandId,
        jobId: r.job_id,
        attemptId,
        shopId,
        printerId: r.target_printer_id || 'printer-hp-laserjet',
        documentUrl: docUrl,
        storageKey: r.storage_key,
        fileName: r.file_name,
        options: JSON.parse(r.print_options),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        correlationId: `corr-${r.order_id}`,
      }];
    }));
  }

  public recordCommandResult(result: SpoolerResult, agentId: string, shopId: string): boolean {
    const now = new Date().toISOString();

    if (!['SUBMITTED_TO_SPOOLER', 'PRINT_CONFIRMED', 'OUTPUT_UNCERTAIN', 'FAILED'].includes(result.status)) return false;
    return this.db.transaction(() => {
    const ownedAttempt = this.db.queryOne<any>(
      `SELECT pa.status AS attempt_status
       FROM print_attempts pa
       JOIN print_jobs pj ON pj.id = pa.print_job_id
       JOIN orders o ON o.id = pj.order_id
       WHERE pa.id = ? AND pj.id = ? AND pa.agent_id = ? AND o.shop_id = ?`,
      [result.attemptId, result.jobId, agentId, shopId]
    );
    if (!ownedAttempt) return false;

    // Map spooler result to PrintJobStatus
    let nextJobStatus: PrintJobStatus;
    let nextAttemptStatus: string;

    if (result.status === 'PRINT_CONFIRMED') {
      nextJobStatus = 'PRINT_CONFIRMED';
      nextAttemptStatus = 'SUCCESS';
    } else if (result.status === 'OUTPUT_UNCERTAIN') {
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

    // If all print jobs in the order are PRINT_CONFIRMED, move order to READY_FOR_COLLECTION
    const jobRow = this.db.queryOne<any>(
      `SELECT pj.order_id FROM print_jobs pj JOIN orders o ON o.id = pj.order_id WHERE pj.id = ? AND o.shop_id = ?`,
      [result.jobId, shopId]
    );
    if (jobRow && nextJobStatus === 'PRINT_CONFIRMED') {
      const remainingIncomplete = this.db.queryOne<any>(
        `SELECT COUNT(*) as cnt FROM print_jobs WHERE order_id = ? AND status != 'PRINT_CONFIRMED'`,
        [jobRow.order_id]
      );
      if (remainingIncomplete && remainingIncomplete.cnt === 0) {
        this.db.execute(
          `UPDATE orders SET status = 'READY_FOR_COLLECTION', updated_at = ? WHERE id = ?`,
          [now, jobRow.order_id]
        );
      }
    }
    return true;
    });
  }

  // Developer Keys
  public createDeveloperKey(key: DeveloperKeyRecord): void {
    this.db.execute(
      `INSERT INTO developer_keys (id, organization_id, key_name, key_prefix, secret_hash, scopes, environment, is_active, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        key.id,
        key.organizationId,
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

  public getDeveloperKeysByOrg(orgId: string): DeveloperKeyRecord[] {
    const rows = this.db.query<any>(
      `SELECT * FROM developer_keys WHERE organization_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`,
      [orgId]
    );
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
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

  public getWebhooksByOrg(orgId: string): WebhookSubscriptionRecord[] {
    const rows = this.db.query<any>(
      `SELECT * FROM webhook_subscriptions WHERE organization_id = ? AND is_active = 1`,
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
}
