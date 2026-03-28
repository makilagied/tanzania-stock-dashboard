import type { HistoricalPoint, HistoricalCurrentPoint, LiveMoverPoint, MoverPoint, ShareIndexPoint, StockData } from "@/lib/market-data"
import {
  getGainersLosers,
  getHistoricalDataWithMeta,
  getLiveStocks,
  getMarketOrders,
  getShareIndices,
  getTopMovers,
} from "@/lib/market-data"
import { MARKET_UPSTREAM_TIMEOUT_MS } from "@/lib/market-upstream-timeout"
import { type StaleFetchResult, withStaleFallback } from "@/lib/stale-cache"

export type HistoricalWithMeta = {
  success: boolean
  data: HistoricalPoint[]
  current: HistoricalCurrentPoint[]
  message: string
}

const HISTORY_OUTAGE: HistoricalWithMeta = {
  success: false,
  data: [],
  current: [],
  message: "Market data temporarily unavailable.",
}

const INDICES_OUTAGE = { success: false as const, data: [] as ShareIndexPoint[] }
const MOVERS_OUTAGE = { success: false as const, data: [] as MoverPoint[] }
const TOP_MOVERS_OUTAGE = { success: false as const, data: [] as LiveMoverPoint[] }

/** Order book JSON shape returned to clients */
const ORDERS_OUTAGE: Record<string, unknown> = { bestSellPrice: 0, bestBuyPrice: 0, orders: [] }

export function getCachedLiveStocks(): Promise<StaleFetchResult<StockData[]>> {
  return withStaleFallback({
    key: "market:live-stocks",
    fetch: () => getLiveStocks(),
    isHealthy: (rows) => Array.isArray(rows) && rows.length > 0,
    emptyValue: [],
    timeoutMs: MARKET_UPSTREAM_TIMEOUT_MS,
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
    emptyValue: HISTORY_OUTAGE,
    timeoutMs: MARKET_UPSTREAM_TIMEOUT_MS,
  })
}

export function getCachedShareIndices(from: string): Promise<StaleFetchResult<{ success: boolean; data: ShareIndexPoint[] }>> {
  return withStaleFallback({
    key: `market:indices:${from}`,
    fetch: () => getShareIndices(from),
    isHealthy: (p) => p.success !== false && Array.isArray(p.data) && p.data.length > 0,
    emptyValue: INDICES_OUTAGE,
    timeoutMs: MARKET_UPSTREAM_TIMEOUT_MS,
  })
}

export function getCachedTopMovers(): Promise<StaleFetchResult<{ success: boolean; data: LiveMoverPoint[] }>> {
  return withStaleFallback({
    key: "market:top-movers",
    fetch: () => getTopMovers(),
    isHealthy: (p) => p.success !== false && Array.isArray(p.data) && p.data.length > 0,
    emptyValue: TOP_MOVERS_OUTAGE,
    timeoutMs: MARKET_UPSTREAM_TIMEOUT_MS,
  })
}

export function getCachedGainersLosers(): Promise<StaleFetchResult<{ success: boolean; data: MoverPoint[] }>> {
  return withStaleFallback({
    key: "market:gainers-losers",
    fetch: () => getGainersLosers(),
    isHealthy: (p) => p.success !== false && Array.isArray(p.data) && p.data.length > 0,
    emptyValue: MOVERS_OUTAGE,
    timeoutMs: MARKET_UPSTREAM_TIMEOUT_MS,
  })
}

export function getCachedMarketOrders(companyId: string): Promise<StaleFetchResult<Record<string, unknown>>> {
  return withStaleFallback({
    key: `market:orders:${companyId}`,
    fetch: () => getMarketOrders(companyId) as Promise<Record<string, unknown>>,
    isHealthy: (o) =>
      o != null &&
      typeof o === "object" &&
      "orders" in o &&
      Array.isArray((o as { orders?: unknown }).orders),
    emptyValue: ORDERS_OUTAGE,
    timeoutMs: MARKET_UPSTREAM_TIMEOUT_MS,
  })
}
