import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as os from 'node:os';
import { LocalOfflineQueue } from '../local-queue';
import { PrinterDiscoveryService } from '../printer-discovery';
import { SpoolerExecutor } from '../spooler-executor';
import { ConfigManager } from '../config';
import { AgentDaemon } from '../agent-daemon';
import { PrintCommandTicket } from '@inklly/shared';

describe('Inklly Desktop Edge Print Agent Test Suite', () => {
  let queue: LocalOfflineQueue;

  before(() => {
    queue = new LocalOfflineQueue(':memory:');
  });

  after(() => {
    queue.close();
  });

  it('Enqueues and retrieves print command tickets idempotently', () => {
    const ticket: PrintCommandTicket = {
      commandId: 'cmd-test-1',
      jobId: 'job-1',
      attemptId: 'att-1',
      shopId: 'shop-campus-1',
      printerId: 'printer-hp-laserjet',
      documentUrl: 'https://storage.inklly.com/uploads/sample.pdf',
      fileName: 'sample.pdf',
      options: {
        colorMode: 'bw',
        duplexMode: 'simplex',
        paperSize: 'A4',
        orientation: 'portrait',
        copies: 2,
        fitMode: 'fit',
        pagesPerSheet: 1,
        collation: true,
      },
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      correlationId: 'corr-1',
    };

    const firstAdd = queue.enqueue(ticket);
    assert.equal(firstAdd, true, 'First enqueue should succeed');

    const duplicateAdd = queue.enqueue(ticket);
    assert.equal(duplicateAdd, false, 'Duplicate enqueue should be rejected');

    assert.equal(queue.getQueueDepth(), 1);

    const pending = queue.getNextPending();
    assert.ok(pending);
    assert.equal(pending.commandId, 'cmd-test-1');
    assert.equal(pending.fileName, 'sample.pdf');
    assert.equal(pending.status, 'PENDING');
  });

  it('Transitions local offline queue item statuses properly', () => {
    queue.updateStatus('cmd-test-1', 'DISPATCHED_TO_SPOOLER');
    assert.equal(queue.getQueueDepth(), 0, 'In-flight commands are not pending');

    queue.updateStatus('cmd-test-1', 'COMPLETED');
    const recent = queue.getRecent(1);
    assert.equal(recent[0].status, 'COMPLETED');
  });

  it('Rejects remote agent endpoints over unencrypted HTTP', () => {
    const configManager = new ConfigManager(path.join(os.tmpdir(), `test-agent-url-${Date.now()}.json`));
    assert.throws(() => configManager.update({ serverUrl: 'http://example.com/api/v1' }), /must use HTTPS/i);
    assert.equal(configManager.update({ serverUrl: 'http://127.0.0.1:4000/api/v1' }).serverUrl, 'http://127.0.0.1:4000/api/v1');
  });

  it('Discovers local printer capabilities including duplex and color', async () => {
    const printers = await PrinterDiscoveryService.discoverPrinters();
    assert.ok(printers.length >= 2, 'Should discover at least 2 printers');

    const bwPrinter = printers.find((p) => !p.supportsColor);
    assert.ok(bwPrinter, 'Should find high-speed B&W printer');
    assert.equal(bwPrinter.supportsDuplex, true);

    const colorPrinter = printers.find((p) => p.supportsColor);
    assert.ok(colorPrinter, 'Should find color multi-format printer');
  });

  it('SpoolerExecutor never claims success when the host has no real printing capability', async () => {
    const ticket: PrintCommandTicket = {
      commandId: 'cmd-test-2',
      jobId: 'job-2',
      attemptId: 'att-2',
      shopId: 'shop-campus-1',
      printerId: 'printer-hp-laserjet',
      documentUrl: 'https://storage.inklly.com/uploads/doc.pdf',
      fileName: 'doc.pdf',
      options: {
        colorMode: 'bw',
        duplexMode: 'simplex',
        paperSize: 'A4',
        orientation: 'portrait',
        copies: 1,
        fitMode: 'fit',
        pagesPerSheet: 1,
        collation: true,
      },
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      correlationId: 'corr-2',
    };

    const result = await SpoolerExecutor.executeTicket(ticket);
    assert.equal(result.status, 'FAILED');
    assert.match(result.errorMessage || '', /no print was submitted/i);
    assert.equal(result.driverJobId, undefined);
  });

  it('Enforces Safety Invariant: Hardware paper jam triggers OUTPUT_UNCERTAIN without auto-retry', async () => {
    const ticket: PrintCommandTicket = {
      commandId: 'cmd-test-3',
      jobId: 'job-3',
      attemptId: 'att-3',
      shopId: 'shop-campus-1',
      printerId: 'printer-canon-color',
      documentUrl: 'https://storage.inklly.com/uploads/poster.pdf',
      fileName: 'poster.pdf',
      options: {
        colorMode: 'color',
        duplexMode: 'simplex',
        paperSize: 'A3',
        orientation: 'portrait',
        copies: 1,
        fitMode: 'fit',
        pagesPerSheet: 1,
        collation: true,
      },
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      correlationId: 'corr-3',
    };

    const result = await SpoolerExecutor.executeTicket(ticket, {
      simulateFailure: 'PAPER_JAM_UNCERTAIN',
    });

    assert.equal(result.status, 'OUTPUT_UNCERTAIN');
    assert.ok(result.errorMessage?.includes('Paper jam'));
  });

  it('AgentDaemon boots diagnostics server and serves status on loopback', async () => {
    const testConfigPath = path.join(os.tmpdir(), `test-agent-config-${Date.now()}.json`);
    const configManager = new ConfigManager(testConfigPath);
    // Use ephemeral port 8799 for test isolation
    configManager.update({ localPort: 8799 });

    const daemon = new AgentDaemon(configManager, queue);
    await daemon.start();

    try {
      const res = await fetch('http://127.0.0.1:8799/status');
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.status, 'RUNNING');
      assert.equal(data.isPaired, false);
      assert.equal('discoveredPrinters' in data, false, 'local diagnostics must not expose printer inventory cross-origin');

      const queueRes = await fetch('http://127.0.0.1:8799/queue');
      assert.equal(queueRes.status, 404, 'local diagnostics must not expose or mutate print queue contents');
    } finally {
      daemon.stop();
    }
  });
});
