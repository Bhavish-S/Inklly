import * as fs from 'node:fs';
import * as path from 'node:path';

export interface AgentConfig {
  serverUrl: string;
  localPort: number;
  shopId: string;
  shopCode?: string;
  agentId?: string;
  secretKey?: string;
  isPaired: boolean;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  offlineQueuePath: string;
}

const DEFAULT_CONFIG: AgentConfig = {
  serverUrl: process.env.INKLLY_SERVER_URL || 'http://localhost:4000/api/v1',
  localPort: Number(process.env.INKLLY_AGENT_PORT) || 8765,
  shopId: process.env.INKLLY_SHOP_ID || 'shop-campus-1',
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
    this.currentConfig = { ...this.currentConfig, ...updates };
    this.save();
    return this.get();
  }

  private load(): AgentConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch {
      // Fallback to default
    }
    return { ...DEFAULT_CONFIG };
  }

  private save(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.currentConfig, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Agent Config] Failed to save config file:', err);
    }
  }
}
