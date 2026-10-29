/** Run the real local-agent and shop-printer checks without treating either as proof of physical output. */
export async function checkMerchantConnections(checkLocalAgent, refreshShopPrinters) {
  const [agentResult, printerResult] = await Promise.allSettled([
    Promise.resolve().then(checkLocalAgent),
    Promise.resolve().then(refreshShopPrinters),
  ]);

  return {
    localAgentResponding: agentResult.status === 'fulfilled' && agentResult.value === true,
    printerInventoryAvailable: printerResult.status === 'fulfilled' && printerResult.value === true,
  };
}

export function formatMerchantConnectionResult(result) {
  if (result.localAgentResponding && result.printerInventoryAvailable) {
    return 'The local agent responded and the shop printer inventory loaded. This does not confirm cloud heartbeat, printer readiness, or physical output.';
  }
  if (result.localAgentResponding) {
    return 'The local agent responded, but the shop printer inventory could not be loaded. Physical printer readiness is not confirmed.';
  }
  if (result.printerInventoryAvailable) {
    return 'The shop printer inventory loaded, but no paired local agent responded on this computer. Physical printer readiness is not confirmed.';
  }
  return 'The local agent did not respond and the shop printer inventory could not be loaded.';
}
