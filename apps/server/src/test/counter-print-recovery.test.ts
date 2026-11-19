import { after, before, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { DatabaseService } from '@inklly/db';
import { createApp } from '../index';

/**
 * The shopkeeper's half of the loop: make a discovered printer usable, print,
 * recover from a failed dispatch, and finish an order that was printed by hand.
 */
describe('counter print setup and recovery', { concurrency: false }, () => {
  let db: DatabaseService;
  let server: http.Server;
  let baseUrl: string;
  let merchantHeaders: Record<string, string>;
  let agentHeaders: Record<string, string>;
  let printerId: string;
  const orderId = 'order-demo-001';

  const post = (path: string, headers: Record<string, string>, body?: unknown) =>
    fetch(`${baseUrl}/api/v1${path}`, { method: 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const heartbeat = () => post('/agent/heartbeat', agentHeaders, {
    status: 'ONLINE', physicalPrintingEnabled: true, activePrintersCount: 1, localQueueDepth: 0,
    printers: [{ name: 'Counter Laser', driverName: 'Real OS Driver v3', isOnline: true, isDefault: true }],
  });
  const jobState = () => db.queryOne<any>(`SELECT id, status, printer_id FROM print_jobs WHERE order_id = ?`, [orderId]);
  const pollTicket = async () => {
    const response = await fetch(`${baseUrl}/api/v1/agent/poll-commands`, { headers: agentHeaders });
    assert.equal(response.status, 200);
    const tickets = await response.json() as Array<{ jobId: string; attemptId: string; commandId: string; documentUrl: string }>;
    return tickets.find((ticket) => ticket.jobId === jobState().id);
  };
  const failAttempt = async (ticket: { jobId: string; attemptId: string; commandId: string }) => {
    assert.equal((await post('/agent/acknowledge-command', agentHeaders, { commandId: ticket.commandId, attemptId: ticket.attemptId })).status, 200);
    const result = await post('/agent/command-result', agentHeaders, {
      jobId: ticket.jobId, attemptId: ticket.attemptId, status: 'FAILED', errorMessage: 'Printer driver rejected the job.', timestamp: new Date().toISOString(),
    });
    assert.equal(result.status, 200);
  };

  before(async () => {
    db = new DatabaseService(':memory:');
    const app = createApp(db);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
        resolve();
      });
    });
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@campusprint.in', password: 'DemoOwnerPassword123!' }),
    });
    assert.equal(login.status, 200);
    merchantHeaders = { Authorization: `Bearer ${(await login.json() as { token: string }).token}`, 'Content-Type': 'application/json' };

    const pairing = await post('/merchant/agents/pairing-code', merchantHeaders);
    assert.equal(pairing.status, 201);
    const enroll = await post('/agent/enroll', { 'Content-Type': 'application/json' }, {
      shopId: 'shop-campus-1', pairingCode: (await pairing.json() as { pairingCode: string }).pairingCode, hostname: 'COUNTER-PC',
    });
    assert.equal(enroll.status, 201);
    const agent = await enroll.json() as { agentId: string; agentSecret: string };
    agentHeaders = { 'Content-Type': 'application/json', 'X-Agent-Id': agent.agentId, Authorization: `Bearer ${agent.agentSecret}` };
    assert.equal((await heartbeat()).status, 200);
    printerId = db.queryOne<any>(`SELECT id FROM printers WHERE agent_id = ? AND name = 'Counter Laser'`, [agent.agentId]).id;
  });

  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    db?.close();
  });

  it('lets the merchant save a capability profile on an agent-discovered printer, which makes it dispatchable', async () => {
    const before = await post(`/merchant/orders/${orderId}/print`, merchantHeaders, { printerId });
    assert.equal(before.status, 409, 'a discovered queue with no profile must not be dispatchable');
    assert.match(JSON.stringify(await before.json()), /no verified paper tray profile/);
    assert.equal(jobState().printer_id, null);

    const invalid = await fetch(`${baseUrl}/api/v1/merchant/printers/${printerId}`, {
      method: 'PUT', headers: merchantHeaders, body: JSON.stringify({ supportsColor: false, supportsDuplex: false, paperSizes: ['LETTER'] }),
    });
    assert.equal(invalid.status, 400);
    const foreign = await fetch(`${baseUrl}/api/v1/merchant/printers/prn-does-not-exist`, {
      method: 'PUT', headers: merchantHeaders, body: JSON.stringify({ supportsColor: false, supportsDuplex: false, paperSizes: ['A4'] }),
    });
    assert.equal(foreign.status, 404);

    const saved = await fetch(`${baseUrl}/api/v1/merchant/printers/${printerId}`, {
      method: 'PUT', headers: merchantHeaders, body: JSON.stringify({ supportsColor: false, supportsDuplex: true, paperSizes: ['A4', 'A3'] }),
    });
    assert.equal(saved.status, 200);
    const { printer } = await saved.json() as { printer: any };
    assert.equal(printer.supportsDuplex, true);
    assert.deepEqual(printer.trays.map((tray: any) => tray.supportedSizes), [['A4', 'A3']]);

    // The profile survives the next heartbeat, and a heartbeat keeps the merchant's default choice.
    assert.equal((await heartbeat()).status, 200);
    const after = db.queryOne<any>(`SELECT supports_duplex, is_default, (SELECT COUNT(*) FROM paper_trays WHERE printer_id = printers.id) AS trays FROM printers WHERE id = ?`, [printerId]);
    assert.equal(Number(after.supports_duplex), 1);
    assert.equal(Number(after.trays), 1);
    assert.equal(Number(after.is_default), 0, 'the seeded shop default must not be taken over by the OS default');
    assert.equal(Number(db.queryOne<any>(`SELECT COUNT(*) AS count FROM audit_events WHERE action = 'MERCHANT_PRINTER_PROFILE_UPDATED' AND target_id = ?`, [printerId]).count), 1);
  });

  it('hands the agent a document URL on the server it is paired with', async () => {
    const released = await post(`/merchant/orders/${orderId}/print`, merchantHeaders, { printerId });
    assert.equal(released.status, 200, await released.clone().text());
    const ticket = await pollTicket();
    assert.ok(ticket, 'the released job must reach the agent');
    assert.ok(ticket.documentUrl.startsWith(`${baseUrl}/api/v1/agent/files/`), ticket.documentUrl);
    await failAttempt(ticket);
    assert.equal(jobState().status, 'DISPATCH_FAILED');
  });

  it('retries a failed dispatch without letting it be confirmed as agent output', async () => {
    const inspected = await post(`/merchant/orders/${orderId}/reconcile-output`, merchantHeaders, {
      physicalOutputConfirmed: true, reason: 'Trying to confirm a job the printer rejected.',
    });
    assert.equal(inspected.status, 409, 'a failed dispatch produced no output to inspect');

    const retried = await post(`/merchant/orders/${orderId}/print`, merchantHeaders, { printerId });
    assert.equal(retried.status, 200, await retried.clone().text());
    assert.equal((await retried.json() as { retriedJobs: number }).retriedJobs, 1);
    assert.deepEqual({ status: jobState().status, printer: jobState().printer_id }, { status: 'RECEIVED', printer: printerId });

    // While the job is queued for the agent it cannot also be declared printed by hand.
    const racing = await post(`/merchant/orders/${orderId}/reconcile-output`, merchantHeaders, {
      physicalOutputConfirmed: true, printedManually: true, reason: 'Printed by hand while the agent still holds the job.',
    });
    assert.equal(racing.status, 409);

    const second = await pollTicket();
    assert.ok(second, 'the retried job must be offered to the agent again');
    assert.equal(Number(db.queryOne<any>(`SELECT attempt_number FROM print_attempts WHERE id = ?`, [second.attemptId]).attempt_number), 2);
    await failAttempt(second);
    assert.equal(jobState().status, 'DISPATCH_FAILED');
  });

  it('completes an order that staff printed by hand, with its own audit source', async () => {
    const done = await post(`/merchant/orders/${orderId}/reconcile-output`, merchantHeaders, {
      physicalOutputConfirmed: true, printedManually: true, reason: 'Printed from the counter PC directly and handed over.',
    });
    assert.equal(done.status, 200, await done.clone().text());
    const body = await done.json() as { orderComplete: boolean; order: { status: string } };
    assert.equal(body.orderComplete, true);
    assert.equal(body.order.status, 'READY_FOR_COLLECTION');
    assert.equal(jobState().status, 'PRINT_CONFIRMED');
    assert.equal(db.queryOne<any>(`SELECT confirmation_source FROM subscription_usage_events WHERE order_id = ?`, [orderId]).confirmation_source, 'OPERATOR_MANUAL_PRINT');

    // A never-dispatched cash order can be finished the same way, and without the flag it cannot.
    const cashOrder = db.queryOne<any>(
      `SELECT o.id FROM orders o JOIN print_jobs pj ON pj.order_id = o.id
       WHERE o.shop_id = 'shop-campus-1' AND o.id <> ? AND o.status IN ('AWAITING_REVIEW', 'READY_FOR_PRINT') AND pj.status = 'RECEIVED' AND pj.printer_id IS NULL
         AND (o.payment_method <> 'ONLINE_RAZORPAY' OR o.payment_status = 'VERIFIED') LIMIT 1`, [orderId]
    );
    if (cashOrder) {
      const strict = await post(`/merchant/orders/${cashOrder.id}/reconcile-output`, merchantHeaders, {
        physicalOutputConfirmed: true, reason: 'No dispatch happened for this order at all.',
      });
      assert.equal(strict.status, 409);
      const manual = await post(`/merchant/orders/${cashOrder.id}/reconcile-output`, merchantHeaders, {
        physicalOutputConfirmed: true, printedManually: true, reason: 'Printed by hand at the counter for the customer.',
      });
      assert.equal(manual.status, 200, await manual.clone().text());
    }
  });
});
