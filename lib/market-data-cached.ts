import type { HistoricalPoint, HistoricalCurrentPoint, LiveMoverPoint, MoverPoint, ShareIndexPoint, StockData } from "@/lib/market-data"
import {
  getGainersLosers,
  getHistoricalDataWithMeta,
  getLiveStocks,
  getMarketOrders,
  getShareIndices,
  getTopMovers,
} from "@/lib/market-data"
import { type StaleFetchResult, withStaleFallback } from "@/lib/stale-cache"

export type HistoricalWithMeta = {
  success: boolean
  data: HistoricalPoint[]
  current: HistoricalCurrentPoint[]
  message: string
}

export function getCachedLiveStocks(): Promise<StaleFetchResult<StockData[]>> {
  return withStaleFallback({
    key: "market:live-stocks",
    fetch: () => getLiveStocks(),
    isHealthy: (rows) => Array.isArray(rows) && rows.length > 0,
  })
}

export function getCachedHistoricalDataWithMeta(
  symbol: string,
  days: number,
): Promise<StaleFetchResult<HistoricalWithMeta>> {
  return withStaleFallback({
    key: `market:history:${symbol}:${days}`,
    fetch: () => getHistoricalDataWithMeta(symbol, days),
    isHealthy: (h) => Array.isArray(h.data) && h.data.length > 0,
  })
}

export function getCachedShareIndices(from: string): Promise<StaleFetchResult<{ success: boolean; data: ShareIndexPoint[] }>> {
  return withStaleFallback({
    key: `market:indices:${from}`,
    fetch: () => getShareIndices(from),
    isHealthy: (p) => p.success !== false && Array.isArray(p.data) && p.data.length > 0,
  })
}

export function getCachedTopMovers(): Promise<StaleFetchResult<{ success: boolean; data: LiveMoverPoint[] }>> {
  return withStaleFallback({
    key: "market:top-movers",
    fetch: () => getTopMovers(),
    isHealthy: (p) => p.success !== false && Array.isArray(p.data) && p.data.length > 0,
  })
}

export function getCachedGainersLosers(): Promise<StaleFetchResult<{ success: boolean; data: MoverPoint[] }>> {
  return withStaleFallback({
    key: "market:gainers-losers",
    fetch: () => getGainersLosers(),
    isHealthy: (p) => p.success !== false && Array.isArray(p.data) && p.data.length > 0,
  })
}

/** Any JSON object from the order book endpoint counts as a successful refresh. */
export function getCachedMarketOrders(companyId: string): Promise<StaleFetchResult<unknown>> {
  return withStaleFallback({
    key: `market:orders:${companyId}`,
    fetch: () => getMarketOrders(companyId),
    isHealthy: (o) => o != null && typeof o === "object",
  })
}
