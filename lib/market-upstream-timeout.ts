/** Max wait for third-party DSE/market HTTP responses before falling back to last-good cache (ms). */
export const MARKET_UPSTREAM_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.MARKET_UPSTREAM_TIMEOUT_MS) || 20_000, 5_000),
  120_000,
)
