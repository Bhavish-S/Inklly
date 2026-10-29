import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMerchantConnections, formatMerchantConnectionResult } from '../src/merchant-health-check.mjs';

test('checks the local agent and shop printer API independently', async () => {
  let agentCalls = 0;
  let printerCalls = 0;
  const result = await checkMerchantConnections(
    async () => { agentCalls += 1; return true; },
    async () => { printerCalls += 1; return false; },
  );

  assert.deepEqual(result, { localAgentResponding: true, printerInventoryAvailable: false });
  assert.equal(agentCalls, 1);
  assert.equal(printerCalls, 1);
  assert.match(formatMerchantConnectionResult(result), /Physical printer readiness is not confirmed/);
});

test('reports failed connection checks without claiming either system is ready', async () => {
  const result = await checkMerchantConnections(
    async () => { throw new Error('local agent unavailable'); },
    async () => { throw new Error('printer API unavailable'); },
  );

  assert.deepEqual(result, { localAgentResponding: false, printerInventoryAvailable: false });
  assert.equal(formatMerchantConnectionResult(result), 'The local agent did not respond and the shop printer inventory could not be loaded.');
});

test('distinguishes shop API availability from local agent availability', async () => {
  const result = await checkMerchantConnections(async () => false, async () => true);

  assert.deepEqual(result, { localAgentResponding: false, printerInventoryAvailable: true });
  assert.match(formatMerchantConnectionResult(result), /no paired local agent responded/);
});
