import { DatabaseService } from '../database';
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
        reg.secretKey, // In production this is the hash
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

  public getAgentByShop(shopId: string): AgentRegistration | null {
    const row = this.db.queryOne<any>(
      `SELECT * FROM agent_registrations WHERE shop_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1`,
      [shopId]
    );
    if (!row) return null;
    return {
      agentId: row.id,
      shopId: row.shop_id,
      secretKey: row.secret_key_hash,
      hostname: row.hostname,
      osPlatform: row.os_platform,
      osVersion: row.os_version,
      agentVersion: row.agent_version,
    };
  }

  public recordHeartbeat(hb: AgentHeartbeat): void {
    const now = new Date().toISOString();
    this.db.execute(
      `UPDATE agent_registrations SET last_heartbeat = ?, updated_at = ? WHERE id = ?`,
      [now, now, hb.agentId]
    );
  }

  public getPendingPrintTickets(shopId: string): PrintCommandTicket[] {
    // Finds orders that are QUEUED or PRINTING and have print_jobs in RECEIVED / DISPATCHED / SPOOLING
    const rows = this.db.query<any>(
      `SELECT pj.id as job_id, pj.order_id, pj.order_file_id, pj.printer_id,
              of.file_name, of.storage_key, of.print_options,
              p.id as target_printer_id
       FROM print_jobs pj
       JOIN orders o ON pj.order_id = o.id
       JOIN order_files of ON pj.order_file_id = of.id
       LEFT JOIN printers p ON pj.printer_id = p.id
       WHERE o.shop_id = ? AND pj.status IN ('RECEIVED', 'DISPATCHED')
       ORDER BY pj.created_at ASC`,
      [shopId]
    );

    return rows.map((r) => {
      const attemptId = `att-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const commandId = `cmd-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      // Insert print attempt
      this.db.execute(
        `INSERT INTO print_attempts (id, print_job_id, printer_id, attempt_number, status, created_at, updated_at)
         VALUES (?, ?, ?, 1, 'DISPATCHED_TO_AGENT', ?, ?)`,
        [
          attemptId,
          r.job_id,
          r.target_printer_id || 'printer-hp-laserjet',
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      // Advance job to DISPATCHED
      this.db.execute(
        `UPDATE print_jobs SET status = 'DISPATCHED', updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), r.job_id]
      );

      return {
        commandId,
        jobId: r.job_id,
        attemptId,
        shopId,
        printerId: r.target_printer_id || 'printer-hp-laserjet',
        documentUrl: `https://storage.inklly.com/${r.storage_key}`,
        fileName: r.file_name,
        options: JSON.parse(r.print_options),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        correlationId: `corr-${r.order_id}`,
      };
    });
  }

  public recordCommandResult(result: SpoolerResult): void {
    const now = new Date().toISOString();

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

    // Update attempt
    this.db.execute(
      `UPDATE print_attempts SET status = ?, error_details = ?, updated_at = ? WHERE id = ?`,
      [nextAttemptStatus, result.errorMessage || null, now, result.attemptId]
    );

    // Update print job
    this.db.execute(
      `UPDATE print_jobs SET status = ?, updated_at = ? WHERE id = ?`,
      [nextJobStatus, now, result.jobId]
    );

    // If all print jobs in the order are PRINT_CONFIRMED, move order to READY_FOR_COLLECTION
    const jobRow = this.db.queryOne<any>(`SELECT order_id FROM print_jobs WHERE id = ?`, [result.jobId]);
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
