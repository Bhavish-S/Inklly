import { DatabaseService } from '../database';
import { PaperTray, PrinterDevice } from '@inklly/shared';
import * as crypto from 'node:crypto';

export class PrinterRepository {
  constructor(private db: DatabaseService) {}

  public registerPrinter(printer: PrinterDevice): void {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.execute(
        `INSERT INTO printers (id, shop_id, name, system_driver_name, is_online, is_default, supports_color, supports_duplex, last_heartbeat, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          printer.id,
          printer.shopId,
          printer.name,
          printer.systemDriverName,
          printer.isOnline ? 1 : 0,
          printer.isDefault ? 1 : 0,
          printer.supportsColor ? 1 : 0,
          printer.supportsDuplex ? 1 : 0,
          printer.lastHeartbeat,
          now,
          now,
        ]
      );

      const traysList = printer.trays || [];
      for (let i = 0; i < traysList.length; i++) {
        const tray = traysList[i];
        const trayId = tray.id || `tray-${printer.id}-${i + 1}`;
        this.db.execute(
          `INSERT INTO paper_trays (id, printer_id, name, supported_sizes, is_default)
           VALUES (?, ?, ?, ?, ?)`,
          [
            trayId,
            printer.id,
            tray.name || `Tray ${i + 1}`,
            JSON.stringify(tray.supportedSizes || ['A4', 'PLAIN']),
            tray.isDefault ? 1 : 0,
          ]
        );
      }
    });
  }

  public getPrintersByShop(shopId: string): PrinterDevice[] {
    const rows = this.db.query<any>(
      `SELECT p.*, t.id AS tray_id, t.name AS tray_name, t.supported_sizes AS tray_supported_sizes,
              t.is_default AS tray_is_default
       FROM printers p LEFT JOIN paper_trays t ON t.printer_id = p.id
       WHERE p.shop_id = ? ORDER BY p.id, t.id`,
      [shopId]
    );
    const printers = new Map<string, PrinterDevice>();
    for (const row of rows) {
      let printer = printers.get(row.id);
      if (!printer) {
        printer = {
          id: row.id,
          shopId: row.shop_id,
          agentId: row.agent_id || undefined,
          name: row.name,
          systemDriverName: row.system_driver_name,
          isOnline: Boolean(row.is_online),
          isDefault: Boolean(row.is_default),
          supportsColor: Boolean(row.supports_color),
          supportsDuplex: Boolean(row.supports_duplex),
          trays: [],
          lastHeartbeat: row.last_heartbeat,
        };
        printers.set(row.id, printer);
      }
      if (row.tray_id !== null && row.tray_id !== undefined) {
        printer.trays.push({
          id: row.tray_id,
          name: row.tray_name,
          supportedSizes: JSON.parse(row.tray_supported_sizes),
          isDefault: Boolean(row.tray_is_default),
        });
      }
    }
    return [...printers.values()];
  }

  public getPrinterHealthRowsByShop(shopId: string): Array<{ isOnline: boolean; lastHeartbeat: string | null }> {
    return this.db.query<any>(
      `SELECT is_online, last_heartbeat FROM printers WHERE shop_id = ? ORDER BY id`,
      [shopId]
    ).map((row) => ({ isOnline: Boolean(row.is_online), lastHeartbeat: row.last_heartbeat || null }));
  }

  public hasPrinterForShop(shopId: string, printerId: string): boolean {
    return Boolean(this.db.queryOne<any>(
      `SELECT 1 AS found FROM printers WHERE id = ? AND shop_id = ? LIMIT 1`,
      [printerId, shopId]
    ));
  }

  public hasPrintersByShop(shopId: string): boolean {
    return Boolean(this.db.queryOne<any>(
      `SELECT 1 AS found FROM printers WHERE shop_id = ? LIMIT 1`,
      [shopId]
    ));
  }

  public updatePrinterHeartbeat(printerId: string, isOnline: boolean): void {
    const now = new Date().toISOString();
    this.db.execute(
      `UPDATE printers SET is_online = ?, last_heartbeat = ?, updated_at = ? WHERE id = ?`,
      [isOnline ? 1 : 0, now, now, printerId]
    );
  }

  /** Set exactly one shop-owned printer as the preferred queue. */
  public setDefaultPrinter(shopId: string, printerId: string): boolean {
    let updated = false;
    this.db.transaction(() => {
      const printer = this.db.queryOne<any>(`SELECT id FROM printers WHERE id = ? AND shop_id = ?`, [printerId, shopId]);
      if (!printer) return;
      const now = new Date().toISOString();
      this.db.execute(`UPDATE printers SET is_default = 0, updated_at = ? WHERE shop_id = ?`, [now, shopId]);
      this.db.execute(`UPDATE printers SET is_default = 1, updated_at = ? WHERE id = ? AND shop_id = ?`, [now, printerId, shopId]);
      updated = true;
    });
    return updated;
  }

  /** Replace a shop's live queue inventory from an authenticated desktop agent. */
  public syncAgentInventory(shopId: string, agentId: string, queues: Array<{ name: string; driverName: string; isOnline: boolean; isDefault: boolean }>): void {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.execute(`UPDATE printers SET is_online = 0, updated_at = ? WHERE shop_id = ? AND agent_id = ?`, [now, shopId, agentId]);
      for (const queue of queues) {
        const name = queue.name.trim();
        if (!name || name.length > 256) continue;
        // Preserve a merchant-configured capability profile when the paired
        // agent reports the exact same queue identity. A display name alone is
        // insufficient: the system driver name must also match and the profile
        // must not already belong to another agent.
        const assigned = this.db.query<any>(
          `SELECT id FROM printers WHERE shop_id = ? AND agent_id = ? AND name = ? AND system_driver_name = ? ORDER BY id LIMIT 2`,
          [shopId, agentId, name, queue.driverName.slice(0, 256)]
        );
        const candidates = this.db.query<any>(
          `SELECT id FROM printers WHERE shop_id = ? AND agent_id IS NULL AND name = ? AND system_driver_name = ? ORDER BY id LIMIT 2`,
          [shopId, name, queue.driverName.slice(0, 256)]
        );
        const configuredId = assigned.length === 1
          ? String(assigned[0].id)
          : candidates.length === 1 ? String(candidates[0].id) : null;
        const id = configuredId || `prn-${crypto.createHash('sha256').update(`${shopId}\0${agentId}\0${name}`).digest('hex').slice(0, 24)}`;
        this.db.execute(
          `INSERT INTO printers (id, shop_id, name, system_driver_name, is_online, is_default, supports_color, supports_duplex, last_heartbeat, created_at, updated_at, agent_id)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, system_driver_name = excluded.system_driver_name,
             is_online = excluded.is_online, is_default = excluded.is_default, last_heartbeat = excluded.last_heartbeat, updated_at = excluded.updated_at, agent_id = excluded.agent_id`,
          [id, shopId, name, queue.driverName.slice(0, 256), queue.isOnline ? 1 : 0, queue.isDefault ? 1 : 0, now, now, now, agentId]
        );
      }
    });
  }
}
