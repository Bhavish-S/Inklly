import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
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
    assert.equal(queue.getNextPending(), null, 'A command cannot run before server acknowledgement.');
    assert.deepEqual(queue.getPendingAcknowledgements(), [{ commandId: ticket.commandId, attemptId: ticket.attemptId }]);
    assert.equal(queue.markServerAcknowledged(ticket.commandId, ticket.attemptId), true);

    const pending = queue.getNextPending();
    assert.ok(pending);
    assert.equal(pending.commandId, 'cmd-test-1');
    assert.equal(pending.fileName, 'sample.pdf');
    assert.equal(pending.status, 'PENDING');
    assert.equal(pending.serverAcknowledged, true);
  });

  it('atomically claims an acknowledged spool command once across shared queue connections', () => {
    const queuePath = path.join(os.tmpdir(), `inklly-atomic-claim-${Date.now()}-${Math.random()}.db`);
    const firstAgentQueue = new LocalOfflineQueue(queuePath);
    const secondAgentQueue = new LocalOfflineQueue(queuePath);
    const ticket: PrintCommandTicket = {
      commandId: 'cmd-atomic-claim', jobId: 'job-atomic-claim', attemptId: 'att-atomic-claim',
      shopId: 'shop-campus-1', printerId: 'printer-test',
      documentUrl: 'https://api.inklly.example/api/v1/agent/files/file-atomic-claim', fileName: 'claim.pdf',
      options: { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', orientation: 'portrait', copies: 1, fitMode: 'fit', pagesPerSheet: 1, collation: true },
      expiresAt: new Date(Date.now() + 60_000).toISOString(), correlationId: 'corr-atomic-claim',
    };
    try {
      assert.equal(firstAgentQueue.enqueue(ticket), true);
      assert.equal(firstAgentQueue.markServerAcknowledged(ticket.commandId, ticket.attemptId), true);

      const winningClaim = firstAgentQueue.claimNextPending();
      const duplicateClaim = secondAgentQueue.claimNextPending();
      assert.equal(winningClaim?.commandId, ticket.commandId);
      assert.equal(winningClaim?.status, 'DISPATCHED_TO_SPOOLER');
      assert.equal(duplicateClaim, null, 'a second process cannot claim a command already entering the spooler');
    } finally {
      secondAgentQueue.close();
      firstAgentQueue.close();
      fs.rmSync(queuePath, { force: true });
    }
  });

  it('migrates an existing SQLite queue and leaves old pending work gated until it is re-acknowledged', () => {
    const queuePath = path.join(os.tmpdir(), `inklly-ack-migration-${Date.now()}-${Math.random()}.db`);
    const legacyDb = new DatabaseSync(queuePath);
    legacyDb.exec(`
      CREATE TABLE local_commands (
        command_id TEXT PRIMARY KEY, job_id TEXT NOT NULL, attempt_id TEXT NOT NULL,
        printer_id TEXT NOT NULL, document_url TEXT NOT NULL, file_name TEXT NOT NULL,
        options TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
        result_json TEXT, error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO local_commands (command_id, job_id, attempt_id, printer_id, document_url, file_name, options, expires_at, status, created_at, updated_at)
      VALUES ('cmd-legacy', 'job-legacy', 'att-legacy', 'printer-legacy', 'https://api.inklly.example/api/v1/agent/files/file-legacy', 'legacy.pdf', '{}', '2099-01-01T00:00:00.000Z', 'PENDING', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    `);
    legacyDb.close();

    const migratedQueue = new LocalOfflineQueue(queuePath);
    try {
      assert.deepEqual(migratedQueue.getPendingAcknowledgements(), [{ commandId: 'cmd-legacy', attemptId: 'att-legacy' }]);
      assert.equal(migratedQueue.getNextPending(), null);
      assert.equal(migratedQueue.markServerAcknowledged('cmd-legacy', 'att-legacy'), true);
      assert.equal(migratedQueue.getNextPending()?.commandId, 'cmd-legacy');
    } finally {
      migratedQueue.close();
      fs.rmSync(queuePath, { force: true });
    }
  });

  it('never invokes the spooler after a rejected, failed, or lost dispatch acknowledgement; retries a lost 2xx idempotently', async () => {
    const originalFetch = globalThis.fetch;
    const originalExecute = SpoolerExecutor.executeTicket;
    let spoolCalls = 0;
    SpoolerExecutor.executeTicket = async (ticket) => {
      spoolCalls++;
      return { attemptId: ticket.attemptId, jobId: ticket.jobId, status: 'SUBMITTED_TO_SPOOLER', timestamp: new Date().toISOString() };
    };

    const ticket: PrintCommandTicket = {
      commandId: 'cmd-ack-gate', jobId: 'job-ack-gate', attemptId: 'att-ack-gate', shopId: 'shop-campus-1',
      printerId: 'printer-test', documentUrl: 'https://api.inklly.example/api/v1/agent/files/file-ack-gate', fileName: 'ack.pdf',
      options: { colorMode: 'bw', duplexMode: 'simplex', paperSize: 'A4', orientation: 'portrait', copies: 1, fitMode: 'fit', pagesPerSheet: 1, collation: true },
      expiresAt: new Date(Date.now() + 60_000).toISOString(), correlationId: 'corr-ack-gate',
    };

    try {
      for (const failureMode of ['conflict', 'network'] as const) {
        spoolCalls = 0;
        const queueUnderTest = new LocalOfflineQueue(':memory:');
        const configPath = path.join(os.tmpdir(), `inklly-ack-${failureMode}-${Date.now()}.json`);
        const configManager = new ConfigManager(configPath);
        configManager.update({ shopId: 'shop-campus-1', agentId: 'agent-ack-test', secretKey: 'agent-ack-test-secret', serverUrl: 'http://127.0.0.1:1/api/v1' });
        const daemon = new AgentDaemon(configManager, queueUnderTest);
        (daemon as any).isRunning = true;
        globalThis.fetch = (async (input: string | URL | Request) => {
          const url = String(input);
          if (url.endsWith('/agent/poll-commands')) return new Response(JSON.stringify([ticket]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          if (url.endsWith('/agent/acknowledge-command')) {
            if (failureMode === 'conflict') return new Response('{}', { status: 409 });
            throw new Error('ack network unavailable');
          }
          throw new Error(`Unexpected request ${url}`);
        }) as typeof fetch;
        try {
          await daemon.pollServerCommands();
          await daemon.processPendingAcknowledgements();
          assert.equal(await daemon.processNextQueueItem(), null, `${failureMode} acknowledgement must keep the ticket gated`);
          assert.equal(spoolCalls, 0, `${failureMode} acknowledgement must not invoke the spooler`);
        } finally {
          queueUnderTest.close();
          fs.rmSync(configPath, { force: true });
        }
      }

      spoolCalls = 0;
      const retryQueue = new LocalOfflineQueue(':memory:');
      const retryConfigPath = path.join(os.tmpdir(), `inklly-ack-lost-${Date.now()}.json`);
      const retryConfig = new ConfigManager(retryConfigPath);
      retryConfig.update({ shopId: 'shop-campus-1', agentId: 'agent-ack-retry', secretKey: 'agent-ack-retry-secret', serverUrl: 'http://127.0.0.1:1/api/v1' });
      const retryDaemon = new AgentDaemon(retryConfig, retryQueue);
      (retryDaemon as any).isRunning = true;
      let serverAccepted = false;
      let lostAckResponse = false;
      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/agent/poll-commands')) {
          return new Response(JSON.stringify(serverAccepted ? [] : [ticket]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (url.endsWith('/agent/acknowledge-command')) {
          if (init?.method !== 'POST') throw new Error('Expected POST acknowledgement');
          serverAccepted = true;
          if (!lostAckResponse) {
            lostAckResponse = true;
            throw new Error('server committed ack but client lost response');
          }
          return new Response('{"acknowledged":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (url.endsWith('/agent/command-result')) return new Response('{"success":true}', { status: 200 });
        throw new Error(`Unexpected request ${url}`);
      }) as typeof fetch;
      try {
        await retryDaemon.pollServerCommands();
        assert.equal(await retryDaemon.processNextQueueItem(), null, 'lost acknowledgement response must leave persisted ticket gated');
        assert.equal(spoolCalls, 0);

        await retryDaemon.pollServerCommands();
        assert.equal(retryQueue.getQueueDepth(), 1, 'server need not replay after it committed the lost acknowledgement');
        await retryDaemon.processPendingAcknowledgements();
        assert.equal(retryQueue.getPendingAcknowledgements().length, 0);
        const result = await retryDaemon.processNextQueueItem();
        assert.equal(result?.status, 'SUBMITTED_TO_SPOOLER');
        assert.equal(spoolCalls, 1, 'a confirmed idempotent ack retry allows exactly one spooler invocation');
      } finally {
        retryQueue.close();
        fs.rmSync(retryConfigPath, { force: true });
      }
    } finally {
      globalThis.fetch = originalFetch;
      SpoolerExecutor.executeTicket = originalExecute;
    }
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
    workerQueue.markServerAcknowledged(ticket.commandId, ticket.attemptId);
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

      const reboundHostResponse = await new Promise<number>((resolve, reject) => {
        const request = http.request({
          hostname: '127.0.0.1',
          port: 8799,
          path: '/status',
          method: 'GET',
          headers: { Host: 'attacker.example:8799', Origin: 'https://attacker.example' },
        }, (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode || 0));
        });
        request.on('error', reject);
        request.end();
      });
      assert.equal(reboundHostResponse, 403, 'DNS-rebinding hostnames must not read loopback diagnostics');

      const hostileOriginResponse = await new Promise<number>((resolve, reject) => {
        const request = http.request({
          hostname: '127.0.0.1',
          port: 8799,
          path: '/status',
          method: 'GET',
          headers: { Origin: 'https://attacker.example' },
        }, (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode || 0));
        });
        request.on('error', reject);
        request.end();
      });
      assert.equal(hostileOriginResponse, 403, 'browser requests from untrusted origins must be rejected');
    } finally {
      await daemon.stop();
    }
  });
});
