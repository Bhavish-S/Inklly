export interface MerchantConnectionCheckResult {
  localAgentResponding: boolean;
  printerInventoryAvailable: boolean;
}

export function checkMerchantConnections(
  checkLocalAgent: () => Promise<boolean> | boolean,
  refreshShopPrinters: () => Promise<boolean> | boolean,
): Promise<MerchantConnectionCheckResult>;

export function formatMerchantConnectionResult(result: MerchantConnectionCheckResult): string;
