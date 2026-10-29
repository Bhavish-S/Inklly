import { DatabaseService } from '../database';
import * as crypto from 'node:crypto';
import { User, UserRole, StaffPermission } from '@inklly/shared';

export interface MembershipRecord {
  id: string;
  userId: string;
  organizationId: string;
  shopId?: string;
  role: UserRole;
  permissions: StaffPermission[];
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BotTemplateRecord {
  id: string;
  shopId: string;
  templateKey: string;
  templateText: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  actorUserId?: string;
  actorRole?: string;
  shopId?: string;
  organizationId?: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';
  ipAddress?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export class UserRepository {
  constructor(private db: DatabaseService) {}

  public createUser(user: User, passwordHash: string): void {
    this.db.execute(
      `INSERT INTO users (id, email, phone, password_hash, full_name, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.email,
        user.phone || null,
        passwordHash,
        user.fullName,
        user.role,
        user.isActive ? 1 : 0,
        user.createdAt,
        user.updatedAt,
      ]
    );
  }

  public getUserByEmail(email: string): (User & { passwordHash: string }) | null {
    const row = this.db.queryOne<any>(`SELECT * FROM users WHERE email = ?`, [email]);
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      phone: row.phone || undefined,
      fullName: row.full_name,
      role: row.role as UserRole,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      passwordHash: row.password_hash,
    };
  }

  public getUserById(id: string): User | null {
    const row = this.db.queryOne<any>(`SELECT * FROM users WHERE id = ?`, [id]);
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      phone: row.phone || undefined,
      fullName: row.full_name,
      role: row.role as UserRole,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public updateUserProfile(userId: string, fullName: string, phone: string | null): void {
    this.db.execute(
      `UPDATE users SET full_name = ?, phone = ?, updated_at = ? WHERE id = ?`,
      [fullName, phone, new Date().toISOString(), userId]
    );
  }

  public getUserByIdWithPassword(id: string): (User & { passwordHash: string }) | null {
    const row = this.db.queryOne<any>(`SELECT * FROM users WHERE id = ?`, [id]);
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      phone: row.phone || undefined,
      fullName: row.full_name,
      role: row.role as UserRole,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      passwordHash: row.password_hash,
    };
  }

  public setUserActive(id: string, isActive: boolean): void {
    this.db.execute('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?', [
      isActive ? 1 : 0,
      new Date().toISOString(),
      id,
    ]);
  }

  public setUserPasswordHash(id: string, passwordHash: string): void {
    this.db.execute('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
      passwordHash,
      new Date().toISOString(),
      id,
    ]);
  }

  public getActivePlatformOwner(): User | null {
    const row = this.db.queryOne<any>(
      `SELECT * FROM users WHERE role = 'PLATFORM_OWNER' AND is_active = 1 ORDER BY created_at ASC LIMIT 1`
    );
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      phone: row.phone || undefined,
      fullName: row.full_name,
      role: row.role as UserRole,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public createMembership(membership: MembershipRecord): void {
    this.db.execute(
      `INSERT INTO memberships (id, user_id, organization_id, shop_id, role, permissions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        membership.id,
        membership.userId,
        membership.organizationId,
        membership.shopId || null,
        membership.role,
        JSON.stringify(membership.permissions),
        membership.createdAt,
        membership.updatedAt,
      ]
    );
  }

  public getMembershipsByUser(userId: string): MembershipRecord[] {
    const rows = this.db.query<any>(`SELECT * FROM memberships WHERE user_id = ? AND is_active = 1`, [userId]);
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      organizationId: r.organization_id,
      shopId: r.shop_id || undefined,
      role: r.role as UserRole,
      permissions: JSON.parse(r.permissions),
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public getStaffByShop(shopId: string): Array<{ user: User; membership: MembershipRecord }> {
    const rows = this.db.query<any>(
      `SELECT u.*, m.id as membership_id, m.organization_id as member_organization_id, m.role as member_role, m.permissions, m.is_active as member_active, m.created_at as member_created_at, m.updated_at as member_updated_at
       FROM memberships m
       JOIN users u ON m.user_id = u.id
       WHERE m.shop_id = ?`,
      [shopId]
    );

    return rows.map((r) => ({
      user: {
        id: r.id,
        email: r.email,
        phone: r.phone || undefined,
        fullName: r.full_name,
        role: r.role as UserRole,
        isActive: Boolean(r.is_active),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
      membership: {
        id: r.membership_id,
        userId: r.id,
        organizationId: r.member_organization_id,
        shopId: r.shop_id,
        role: r.member_role as UserRole,
        permissions: JSON.parse(r.permissions),
        isActive: Boolean(r.member_active),
        createdAt: r.member_created_at,
        updatedAt: r.member_updated_at,
      },
    }));
  }

  public updateStaffMembership(input: {
    userId: string;
    organizationId: string;
    shopId: string;
    permissions: StaffPermission[];
    isActive: boolean;
    updatedAt: string;
  }): boolean {
    const updated = this.db.queryOne<{ id: string }>(
      `UPDATE memberships SET permissions = ?, is_active = ?, updated_at = ?
       WHERE user_id = ? AND organization_id = ? AND shop_id = ? AND role = 'SHOP_STAFF'
       RETURNING id`,
      [JSON.stringify(input.permissions), input.isActive ? 1 : 0, input.updatedAt, input.userId, input.organizationId, input.shopId]
    );
    return Boolean(updated);
  }

  public upsertBotTemplate(shopId: string, templateKey: string, templateText: string, isEnabled: boolean): void {
    const now = new Date().toISOString();
    const existing = this.db.queryOne<any>(
      `SELECT id FROM bot_templates WHERE shop_id = ? AND template_key = ?`,
      [shopId, templateKey]
    );

    if (existing) {
      this.db.execute(
        `UPDATE bot_templates SET template_text = ?, is_enabled = ?, updated_at = ? WHERE id = ?`,
        [templateText, isEnabled ? 1 : 0, now, existing.id]
      );
    } else {
      const id = `bot-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      this.db.execute(
        `INSERT INTO bot_templates (id, shop_id, template_key, template_text, is_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, shopId, templateKey, templateText, isEnabled ? 1 : 0, now, now]
      );
    }
  }

  public getBotTemplates(shopId: string): BotTemplateRecord[] {
    const rows = this.db.query<any>(`SELECT * FROM bot_templates WHERE shop_id = ?`, [shopId]);
    return rows.map((r) => ({
      id: r.id,
      shopId: r.shop_id,
      templateKey: r.template_key,
      templateText: r.template_text,
      isEnabled: Boolean(r.is_enabled),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public logAuditEvent(audit: AuditRecord): void {
    this.db.execute(
      `INSERT INTO audit_events (id, actor_user_id, actor_role, shop_id, organization_id, action, target_type, target_id, outcome, ip_address, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        audit.id,
        audit.actorUserId || null,
        audit.actorRole || null,
        audit.shopId || null,
        audit.organizationId || null,
        audit.action,
        audit.targetType,
        audit.targetId,
        audit.outcome,
        audit.ipAddress || null,
        audit.details ? JSON.stringify(audit.details) : null,
        audit.createdAt,
      ]
    );
  }

  public getAuditEvents(
    limit: number = 50,
    shopId?: string,
    cursor?: { createdAt: string; id: string }
  ): AuditRecord[] {
    let sql = `SELECT * FROM audit_events`;
    const params: any[] = [];
    const filters: string[] = [];
    if (shopId) {
      filters.push(`shop_id = ?`);
      params.push(shopId);
    }
    if (cursor) {
      filters.push(`(created_at < ? OR (created_at = ? AND id < ?))`);
      params.push(cursor.createdAt, cursor.createdAt, cursor.id);
    }
    if (filters.length) sql += ` WHERE ${filters.join(' AND ')}`;
    sql += ` ORDER BY created_at DESC, id DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.query<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      actorUserId: r.actor_user_id || undefined,
      actorRole: r.actor_role || undefined,
      shopId: r.shop_id || undefined,
      organizationId: r.organization_id || undefined,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      outcome: r.outcome,
      ipAddress: r.ip_address || undefined,
      details: r.details ? JSON.parse(r.details) : undefined,
      createdAt: r.created_at,
    }));
  }

  public getUserPreferences(userId: string) {
    const row = this.db.queryOne<any>(
      `SELECT * FROM user_preferences WHERE user_id = ?`,
      [userId]
    );
    if (!row) {
      return {
        userId,
        theme: 'light',
        language: 'en-IN',
        emailNotifications: true,
        smsNotifications: false,
      };
    }
    return {
      userId: row.user_id,
      theme: row.theme,
      language: row.language,
      emailNotifications: Boolean(row.email_notifications),
      smsNotifications: Boolean(row.sms_notifications),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public upsertUserPreferences(userId: string, preferences: { theme?: string; language?: string; emailNotifications?: boolean; smsNotifications?: boolean }) {
    const now = new Date().toISOString();
    const existing = this.db.queryOne<any>(
      `SELECT id FROM user_preferences WHERE user_id = ?`,
      [userId]
    );

    if (existing) {
      const updates: string[] = [];
      const params: any[] = [];
      if (preferences.theme !== undefined) { updates.push(`theme = ?`); params.push(preferences.theme); }
      if (preferences.language !== undefined) { updates.push(`language = ?`); params.push(preferences.language); }
      if (preferences.emailNotifications !== undefined) { updates.push(`email_notifications = ?`); params.push(preferences.emailNotifications ? 1 : 0); }
      if (preferences.smsNotifications !== undefined) { updates.push(`sms_notifications = ?`); params.push(preferences.smsNotifications ? 1 : 0); }
      if (updates.length > 0) {
        updates.push(`updated_at = ?`);
        params.push(now, existing.id);
        this.db.execute(`UPDATE user_preferences SET ${updates.join(', ')} WHERE id = ?`, params);
      }
      return this.getUserPreferences(userId);
    }

    const id = `pref-${crypto.randomUUID()}`;
    this.db.execute(
      `INSERT INTO user_preferences (id, user_id, theme, language, email_notifications, sms_notifications, created_at, updated_at)
       VALUES (?, ?, 'light', 'en-IN', 1, 0, ?, ?)`,
      [id, userId, now, now]
    );
    return this.getUserPreferences(userId);
  }

  public getUserSessions(userId: string) {
    const rows = this.db.query<any>(
      `SELECT id, device_info, ip_address, created_at, last_used_at, expires_at, revoked_at FROM user_sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map((r) => ({
      id: r.id,
      deviceInfo: r.device_info,
      ipAddress: r.ip_address,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      expiresAt: r.expires_at,
      isCurrent: false,
    }));
  }

  public createUserSession(session: { id: string; userId: string; tokenHash: string; deviceInfo?: string; ipAddress?: string; expiresAt: string }) {
    const now = new Date().toISOString();
    this.db.execute(
      `INSERT INTO user_sessions (id, user_id, token_hash, device_info, ip_address, created_at, last_used_at, expires_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [session.id, session.userId, session.tokenHash, session.deviceInfo || null, session.ipAddress || null, now, now, session.expiresAt]
    );
  }

  public isUserSessionActive(sessionId: string, userId: string, tokenHash: string): boolean {
    return Boolean(this.db.queryOne<any>(
      `SELECT id FROM user_sessions WHERE id = ? AND user_id = ? AND token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
      [sessionId, userId, tokenHash, new Date().toISOString()]
    ));
  }

  public revokeUserSession(sessionId: string, userId: string): boolean {
    return Boolean(this.db.queryOne<any>(
      `UPDATE user_sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL RETURNING id`,
      [new Date().toISOString(), sessionId, userId]
    ));
  }

  public revokeOtherUserSessions(userId: string, currentSessionId: string): number {
    const rows = this.db.query<any>(
      `UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL RETURNING id`,
      [new Date().toISOString(), userId, currentSessionId]
    );
    return rows.length;
  }
}
