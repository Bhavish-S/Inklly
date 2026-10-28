import { AgentDaemon } from './agent-daemon';

async function main() {
  console.log('🖨️  [Inklly Agent] Initializing desktop edge print daemon...');
  const daemon = new AgentDaemon();
  await daemon.start();

  process.on('SIGINT', () => {
    console.log('\n[Inklly Agent] Shutting down...');
    void daemon.stop().then(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void daemon.stop().then(() => process.exit(0));
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[Inklly Agent Fatal Error]:', err);
    process.exit(1);
  });
}

export * from './config';
export * from './local-queue';
export * from './printer-discovery';
export * from './spooler-executor';
export * from './agent-daemon';
