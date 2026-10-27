import * as fs from 'node:fs';
import * as path from 'node:path';

export interface AgentConfig {
  serverUrl: string;
  localPort: number;
  shopId: string;
  shopCode?: string;
  agentId?: string;
  secretKey?: string;
  pairingCode?: string;
  isPaired: boolean;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  offlineQueuePath: string;
}

const DEFAULT_CONFIG: AgentConfig = {
  serverUrl: process.env.INKLLY_SERVER_URL || 'http://localhost:4000/api/v1',
  localPort: Number(process.env.INKLLY_AGENT_PORT) || 8765,
  shopId: process.env.INKLLY_SHOP_ID || '',
  pairingCode: process.env.INKLLY_PAIRING_CODE,
  shopCode: 'campus1',
  isPaired: false,
  pollIntervalMs: 5000,
  heartbeatIntervalMs: 15000,
  offlineQueuePath: path.join(process.cwd(), 'data', 'agent_queue.db'),
};

export class ConfigManager {
  private configPath: string;
  private currentConfig: AgentConfig;

  constructor(customPath?: string) {
    this.configPath = customPath || path.join(process.cwd(), 'data', 'agent-config.json');
    this.currentConfig = this.load();
  }

  public get(): AgentConfig {
    return { ...this.currentConfig };
  }

  public update(updates: Partial<AgentConfig>): AgentConfig {
    const next = { ...this.currentConfig, ...updates };
    next.serverUrl = this.validateServerUrl(next.serverUrl);
    this.currentConfig = next;
    this.save();
    return this.get();
  }

  private load(): AgentConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
        config.serverUrl = this.validateServerUrl(config.serverUrl);
        if (config.isPaired) config.pairingCode = undefined;
        return config;
      }
    } catch {
      // Fallback to default
    }
    return { ...DEFAULT_CONFIG };
  }

  private validateServerUrl(value: string): string {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('The Inklly server URL is invalid.'); }
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHost))) {
      throw new Error('The Inklly server URL must use HTTPS. HTTP is allowed only for localhost development.');
    }
    return url.toString().replace(/\/$/, '');
  }

  private save(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.currentConfig, null, 2), { encoding: 'utf-8', mode: 0o600 });
      if (process.platform !== 'win32') fs.chmodSync(this.configPath, 0o600);
    } catch (err) {
      console.error('[Agent Config] Failed to save config file:', err);
    }
  }
}
