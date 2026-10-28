import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { LocalOfflineQueue } from '../local-queue';
import { PrinterDiscoveryService } from '../printer-discovery';
import { SpoolerExecutor, downloadTicketDocument } from '../spooler-executor';
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

  it('persists spool outcomes for retry after the agent restarts', () => {
    const queuePath = path.join(os.tmpdir(), `inklly-outbox-${Date.now()}-${Math.random()}.db`);
    const firstQueue = new LocalOfflineQueue(queuePath);
    const ticket: PrintCommandTicket = {
      commandId: 'cmd-outbox-restart', jobId: 'job-outbox-restart', attemptId: 'att-outbox-restart',
      shopId: 'shop-campus-1', printerId: 'printer-hp-laserjet',
      documentUrl: 'https://storage.inklly.com/uploads/outbox.pdf', fileName: 'outbox.pdf',
      options: { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', orientation: 'portrait', copies: 1, fitMode: 'fit', pagesPerSheet: 1, collation: true },
      expiresAt: new Date(Date.now() + 60000).toISOString(), correlationId: 'corr-outbox-restart',
    };
    firstQueue.enqueue(ticket);
    firstQueue.saveResult(ticket.commandId, {
      attemptId: ticket.attemptId, jobId: ticket.jobId, status: 'FAILED',
      errorMessage: 'Pilot printing is disabled.', timestamp: new Date().toISOString(),
    });
    firstQueue.close();

    const restartedQueue = new LocalOfflineQueue(queuePath);
    try {
      const pending = restartedQueue.getPendingReports();
      assert.equal(pending.length, 1);
      assert.equal(pending[0].result?.attemptId, ticket.attemptId);
      assert.equal(pending[0].result?.status, 'FAILED');
      restartedQueue.completeReport(ticket.commandId, pending[0].result!);
      assert.equal(restartedQueue.getPendingReports().length, 0);
      assert.equal(restartedQueue.getRecent(1)[0].status, 'FAILED');
    } finally {
      restartedQueue.close();
      fs.rmSync(queuePath, { force: true });
    }
  });

  it('converts a job interrupted during spooler dispatch into a reportable uncertain outcome', () => {
    const queuePath = path.join(os.tmpdir(), `inklly-interrupted-${Date.now()}-${Math.random()}.db`);
    const firstQueue = new LocalOfflineQueue(queuePath);
    const ticket: PrintCommandTicket = {
      commandId: 'cmd-interrupted', jobId: 'job-interrupted', attemptId: 'att-interrupted',
      shopId: 'shop-campus-1', printerId: 'printer-hp-laserjet',
      documentUrl: 'https://api.inklly.example/api/v1/agent/files/file-1', fileName: '../unsafe.pdf',
      options: { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', orientation: 'portrait', copies: 1, fitMode: 'fit', pagesPerSheet: 1, collation: true },
      expiresAt: new Date(Date.now() + 60000).toISOString(), correlationId: 'corr-interrupted',
    };
    firstQueue.enqueue(ticket);
    firstQueue.updateStatus(ticket.commandId, 'DISPATCHED_TO_SPOOLER');
    firstQueue.close();

    const restartedQueue = new LocalOfflineQueue(queuePath);
    try {
      const reports = restartedQueue.getPendingReports();
      assert.equal(reports.length, 1);
      assert.equal(reports[0].result?.status, 'OUTPUT_UNCERTAIN');
      assert.match(reports[0].result?.errorMessage || '', /not retried/i);
      assert.equal(restartedQueue.getNextPending(), null);
    } finally {
      restartedQueue.close();
      fs.rmSync(queuePath, { force: true });
    }
  });

  it('persists an unexpected spooler exception as OUTPUT_UNCERTAIN without losing the queue report', async () => {
    const configPath = path.join(os.tmpdir(), `test-agent-worker-${Date.now()}.json`);
    const configManager = new ConfigManager(configPath);
    configManager.update({
      shopId: 'shop-campus-1', agentId: 'agent-worker-test', secretKey: 'test-agent-secret',
      serverUrl: 'http://127.0.0.1:1/api/v1',
    });
    const workerQueue = new LocalOfflineQueue(':memory:');
    const ticket: PrintCommandTicket = {
      commandId: 'cmd-worker-exception', jobId: 'job-worker-exception', attemptId: 'att-worker-exception',
      shopId: 'shop-campus-1', printerId: 'printer-test',
      documentUrl: 'https://api.inklly.example/api/v1/agent/files/file-worker', fileName: 'worker.pdf',
      options: { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', orientation: 'portrait', copies: 1, fitMode: 'fit', pagesPerSheet: 1, collation: true },
      expiresAt: new Date(Date.now() + 60000).toISOString(), correlationId: 'corr-worker-exception',
    };
    workerQueue.enqueue(ticket);
    const originalExecute = SpoolerExecutor.executeTicket;
    SpoolerExecutor.executeTicket = async () => { throw new Error('unexpected worker failure'); };
    try {
      const daemon = new AgentDaemon(configManager, workerQueue);
      const result = await daemon.processNextQueueItem();
      assert.equal(result?.status, 'OUTPUT_UNCERTAIN');
      assert.match(result?.errorMessage || '', /inspect the printer before retrying/i);
      const pending = workerQueue.getPendingReports();
      assert.equal(pending.length, 1);
      assert.equal(pending[0].result?.status, 'OUTPUT_UNCERTAIN');
      assert.equal(workerQueue.getNextPending(), null, 'uncertain jobs must never be requeued for blind retry');
    } finally {
      SpoolerExecutor.executeTicket = originalExecute;
      workerQueue.close();
      fs.rmSync(configPath, { force: true });
    }
  });

  it('restricts ticket downloads to the paired agent-file route and prevents redirects', async () => {
    const originalFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (async () => {
      requests++;
      return new Response(new Uint8Array([37, 80, 68, 70, 45, 49]), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf', 'Content-Length': '6' },
      });
    }) as typeof fetch;
    let downloaded = '';
    try {
      await assert.rejects(() => downloadTicketDocument(
        'http://127.0.0.1:4000/admin/metadata',
        'https://api.inklly.example/api/v1',
        { Authorization: 'Bearer test' }
      ), /does not match/i);
      assert.equal(requests, 0, 'untrusted URL must be rejected before credentials are sent');
      downloaded = await downloadTicketDocument(
        'https://api.inklly.example/api/v1/agent/files/file-1',
        'https://api.inklly.example/api/v1',
        { Authorization: 'Bearer test' }
      );
      assert.equal(fs.readFileSync(downloaded).subarray(0, 5).toString('ascii'), '%PDF-');
      assert.equal(fs.statSync(downloaded).mode & 0o777, 0o600);
    } finally {
      globalThis.fetch = originalFetch;
      if (downloaded) await fs.promises.rm(path.dirname(downloaded), { recursive: true, force: true });
    }
  });

  it('rejects a redirect when downloading a customer document', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1:80/' } })) as typeof fetch;
    try {
      await assert.rejects(() => downloadTicketDocument(
        'https://api.inklly.example/api/v1/agent/files/file-1',
        'https://api.inklly.example/api/v1',
        { Authorization: 'Bearer test' }
      ), /redirects are not allowed/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('Rejects remote agent endpoints over unencrypted HTTP', () => {
    const configManager = new ConfigManager(path.join(os.tmpdir(), `test-agent-url-${Date.now()}.json`));
    assert.throws(() => configManager.update({ serverUrl: 'http://example.com/api/v1' }), /must use HTTPS/i);
    assert.equal(configManager.update({ serverUrl: 'http://127.0.0.1:4000/api/v1' }).serverUrl, 'http://127.0.0.1:4000/api/v1');
  });

  it('reports only locally discovered printers and does not invent live hardware', async () => {
    const printers = await PrinterDiscoveryService.discoverPrinters();
    assert.ok(printers.every((p) => p.name && p.driverName), 'Every result must come from a local queue');
    assert.equal(printers.some((p) => /HP LaserJet Pro M401dne|Canon imageRUNNER ADVANCE C3530i/.test(p.name)), false);
    if (process.platform !== 'win32') assert.deepEqual(printers, []);
  });

  it('SpoolerExecutor refuses physical printing during the pilot', async () => {
    const previousPrintMode = process.env.INKLLY_ENABLE_PHYSICAL_PRINTING;
    process.env.INKLLY_ENABLE_PHYSICAL_PRINTING = 'false';
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
    assert.match(result.errorMessage || '', /physical printing is disabled for this pilot/i);
    assert.equal(result.driverJobId, undefined);
    if (previousPrintMode === undefined) delete process.env.INKLLY_ENABLE_PHYSICAL_PRINTING;
    else process.env.INKLLY_ENABLE_PHYSICAL_PRINTING = previousPrintMode;
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
      await daemon.stop();
    }
  });
});
