// server/utils/fee-config.ts
// Fee amount and platform bank details come from server config (brief §18),
// never from the client.
import type { FeeConfig } from '../services/fees'

export function feeConfig(): FeeConfig {
  const config = useRuntimeConfig()
  return {
    amountKobo: Number(config.managementFeeKobo) || 370000,
    bank: {
      name: String(config.platformBank?.name ?? ''),
      accountNumber: String(config.platformBank?.accountNumber ?? ''),
      accountName: String(config.platformBank?.accountName ?? '')
    }
  }
}
