import { DatabaseService } from '../database';
import { PaperTray, PrinterDevice } from '@inklly/shared';

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
    const rows = this.db.query<any>(`SELECT * FROM printers WHERE shop_id = ?`, [shopId]);
    return rows.map((r) => {
      const trays = this.db
        .query<any>(`SELECT * FROM paper_trays WHERE printer_id = ?`, [r.id])
        .map((t) => ({
          id: t.id,
          name: t.name,
          supportedSizes: JSON.parse(t.supported_sizes),
          isDefault: Boolean(t.is_default),
        }));

      return {
        id: r.id,
        shopId: r.shop_id,
        name: r.name,
        systemDriverName: r.system_driver_name,
        isOnline: Boolean(r.is_online),
        isDefault: Boolean(r.is_default),
        supportsColor: Boolean(r.supports_color),
        supportsDuplex: Boolean(r.supports_duplex),
        trays,
        lastHeartbeat: r.last_heartbeat,
      };
    });
  }

  public updatePrinterHeartbeat(printerId: string, isOnline: boolean): void {
    const now = new Date().toISOString();
    this.db.execute(
      `UPDATE printers SET is_online = ?, last_heartbeat = ?, updated_at = ? WHERE id = ?`,
      [isOnline ? 1 : 0, now, now, printerId]
    );
  }
}
