export interface StockData {
  id: string
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap?: number
  bestBidPrice?: number
  bestOfferPrice?: number
  openingPrice?: number
}

export interface HistoricalPoint {
  date: string
  /** Session open when the source provides OHLC (e.g. DSE). */
  open?: number
  close: number
  volume: number
  /** Session high when the source provides OHLC (e.g. DSE). */
  high?: number
  /** Session low when the source provides OHLC (e.g. DSE). */
  low?: number
}

export interface HistoricalCurrentPoint {
  id?: number
  company?: string
  price: number
  low?: number
  high?: number
  marketCap?: number
  change?: number
  time?: string
  tradeDate?: string
  description?: string
}

export interface ShareIndexPoint {
  indexDescription: string
  closingPrice: number
  change: number
  code: string
}

export interface MoverPoint {
  company: string
  change: number
  price: number
  volume: number
}

export interface LiveMoverPoint {
  company: string
  price: number
  volume: number
}

const DSE_BASE_URL = "https://api.dse.co.tz/api"
const DSE_HISTORY_URL = "https://dse.co.tz/api/get/market/prices/for/range/duration"
/** DSE returns an empty series for very large `days` (e.g. 4500+); cap so we keep real prices, not synthetic fallback. */
const DSE_HISTORY_MAX_DAYS = 4000
/** Synthetic history is only for empty API responses; long spans compound noise into nonsense prices. */
const FALLBACK_HISTORY_MAX_DAYS = 120
const DSE_INDICES_URL = "https://dse.co.tz/get/last/traded/indices"
const DSE_MOVERS_URL = "https://dse.co.tz/get/gainers/losers"
const DSE_TOP_MOVERS_URL = "https://dse.co.tz/get/movers"

const SAMPLE_SYMBOLS = ["CRDB", "NMB", "VODA", "TCC", "SWIS", "DSE", "MBP", "DCB"]

const toNumber = (value: unknown, fallback?: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback ?? 0
}

const parseClosingPrice = (value: unknown) => {
  if (typeof value === "number") return value
  if (typeof value === "string") return toNumber(value.replace(/,/g, ""))
  return 0
}

/** Parse % from API when present; `null` if missing so we can compute a fallback. */
const parseOptionalPercent = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const s = value.replace(/%/g, "").replace(/,/g, "").trim()
    if (s === "") return null
    const parsed = Number(s)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * Prefer exchange-reported %; try several field names. If missing, or API sends 0% while
 * `change` is non-zero, fall back to (change / previousClose) × 100 with previousClose = price − change.
 */
export const resolveChangePercent = (item: any, price: number, change: number): number => {
  const candidates = [
    item.percentageChange,
    item.percentChange,
    item.percent_change,
    item.percentage_change,
    item.pctChange,
    item.security?.percentageChange,
    item.security?.percentChange,
    item.marketData?.percentageChange,
  ]

  let apiPct: number | null = null
  for (const c of candidates) {
    const n = parseOptionalPercent(c)
    if (n !== null) {
      apiPct = n
      break
    }
  }

  const prevClose = price - change
  const computed =
    prevClose > 0 && Number.isFinite(change) && Number.isFinite(price) ? (change / prevClose) * 100 : null

  if (apiPct !== null) {
    if (Math.abs(apiPct) < 1e-9 && computed != null && Math.abs(computed) > 1e-6 && Math.abs(change) > 1e-6) {
      return computed
    }
    return apiPct
  }

  return computed ?? 0
}

export const normalizeStocks = (raw: any[]): StockData[] => {
  return raw.map((item) => {
    const price = toNumber(item.marketPrice ?? item.openingPrice)
    const change = toNumber(item.change)
    return {
      id: String(item.id || item.security?.id || item.companyId || item.security?.symbol || item.symbol || Math.random()),
      symbol: item.security?.symbol || item.company?.symbol || item.symbol || "N/A",
      name: item.security?.securityDesc || item.company?.name || item.name || "Unknown Company",
      price,
      change,
      changePercent: resolveChangePercent(item, price, change),
      volume: toNumber(item.volume),
      marketCap: item.marketCap == null ? undefined : toNumber(item.marketCap),
      bestBidPrice: item.bestBidPrice == null ? undefined : toNumber(item.bestBidPrice),
      bestOfferPrice: item.bestOfferPrice == null ? undefined : toNumber(item.bestOfferPrice),
      openingPrice: item.openingPrice == null ? undefined : toNumber(item.openingPrice),
    }
  })
}

export const getLiveStocks = async (): Promise<StockData[]> => {
  const response = await fetch(`${DSE_BASE_URL}/market-data?isBond=false`, {
    next: { revalidate: 60 },
  })
  if (!response.ok) throw new Error(`Failed to fetch live stocks: ${response.status}`)
  const data = await response.json()
  if (!Array.isArray(data)) return []
  return normalizeStocks(data)
}

export const getMarketOrders = async (companyId: string) => {
  const response = await fetch(`${DSE_BASE_URL}/market-orders/companies/${companyId}`, {
    next: { revalidate: 60 },
  })
  if (!response.ok) throw new Error(`Failed to fetch market orders: ${response.status}`)
  return response.json()
}

const normalizeHistoryPayload = (data: any): HistoricalPoint[] => {
  const arrayPayload = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data?.prices)
          ? data.prices
          : []
  return arrayPayload
    .map((item: any) => {
      const openRaw = toNumber(
        item.opening_price ??
          item.open_price ??
          item.openingPrice ??
          item.openPrice ??
          item.open ??
          item.start_price,
      )
      const close = toNumber(
        item.closing_price ??
          item.close_price ??
          item.closingPrice ??
          item.close ??
          item.marketPrice ??
          item.price,
      )
      const highRaw = toNumber(item.high ?? item.day_high ?? item.dayHigh ?? item.high_price)
      const lowRaw = toNumber(item.low ?? item.day_low ?? item.dayLow ?? item.low_price)
      const point: HistoricalPoint = {
        date: String(
          item.date ??
            item.trade_date ??
            item.tradeDate ??
            item.timestamp ??
            item.day ??
            item.createdAt ??
            item.price_date ??
            "",
        )
          .trim()
          .slice(0, 10),
        close,
        volume: toNumber(item.volume ?? item.total_volume ?? item.totalVolume),
      }
      if (openRaw > 0) point.open = openRaw
      if (highRaw > 0) point.high = highRaw
      if (lowRaw > 0) point.low = lowRaw
      return point
    })
    .filter((point) => point.date.length > 0 && point.close > 0)
}

const generateFallbackHistory = (symbol: string, days: number, basePrice: number): HistoricalPoint[] => {
  const span = Math.max(1, Math.min(days, FALLBACK_HISTORY_MAX_DAYS))
  const seed = symbol
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  let lastPrice = basePrice > 0 ? basePrice : 100 + (seed % 900)

  return Array.from({ length: span }).map((_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (span - index - 1))
    const wave = Math.sin((index + seed) / 4) * 0.012
    const trend = 0.0007
    const next = Math.max(1, lastPrice * (1 + trend + wave))
    lastPrice = next

    return {
      date: date.toISOString().slice(0, 10),
      close: Number(next.toFixed(2)),
      volume: Math.round(1200 + Math.abs(Math.cos((index + seed) / 5)) * 9000),
    }
  })
}

const fetchDseHistoryPayload = async (symbol: string, days: number) => {
  const dseDays = Math.min(Math.max(7, days), DSE_HISTORY_MAX_DAYS)
  const historyUrl = new URL(DSE_HISTORY_URL)
  historyUrl.searchParams.set("security_code", symbol)
  historyUrl.searchParams.set("days", String(dseDays))
  historyUrl.searchParams.set("class", "EQUITY")
  const response = await fetch(historyUrl.toString(), { next: { revalidate: 300 } })
  if (!response.ok) return null
  return response.json()
}

export const getHistoricalData = async (symbol: string, days = 30): Promise<HistoricalPoint[]> => {
  try {
    const payload = await fetchDseHistoryPayload(symbol, days)
    if (payload) {
      const normalized = normalizeHistoryPayload(payload)
      if (normalized.length > 0) return normalized
    }
  } catch {
    // Continue to optional custom endpoint and fallback when direct endpoint fails.
  }

  const scriptApiBase = process.env.HISTORICAL_DATA_API_BASE

  if (scriptApiBase) {
    try {
      const endpoint = `${scriptApiBase.replace(/\/$/, "")}/historical?symbol=${encodeURIComponent(symbol)}&days=${days}`
      const response = await fetch(endpoint, { next: { revalidate: 300 } })
      if (response.ok) {
        const payload = await response.json()
        const normalized = normalizeHistoryPayload(payload)
        if (normalized.length > 0) return normalized
      }
    } catch {
      // Intentionally ignored: fallback keeps dashboard alive when script service is unavailable.
    }
  }

  const stocks = await getLiveStocks().catch(() => [])
  const live = stocks.find((stock) => stock.symbol === symbol)
  const basePrice = live?.price ?? 0
  return generateFallbackHistory(symbol, days, basePrice)
}

export const getHistoricalDataWithMeta = async (
  symbol: string,
  days = 30,
): Promise<{ success: boolean; data: HistoricalPoint[]; current: HistoricalCurrentPoint[]; message: string }> => {
  try {
    const payload = await fetchDseHistoryPayload(symbol, days)
    if (payload) {
      const normalizedData = normalizeHistoryPayload(payload)
      const currentRaw = Array.isArray(payload?.current) ? payload.current : []
      const current: HistoricalCurrentPoint[] = currentRaw.map((item: any) => ({
        id: item.id,
        company: item.company,
        price: toNumber(item.price),
        low: item.low == null ? undefined : toNumber(item.low),
        high: item.high == null ? undefined : toNumber(item.high),
        marketCap: item.market_cap == null ? undefined : toNumber(item.market_cap),
        change: item.change == null ? undefined : toNumber(item.change),
        time: item.time,
        tradeDate: item.trade_date,
        description: item.description,
      }))

      // Only return when we actually parsed rows. Otherwise fall through so getHistoricalData
      // can retry / use alternate sources (large `days` sometimes returns OK with empty/unmapped shape).
      if (normalizedData.length > 0) {
        return {
          success: Boolean(payload?.success ?? true),
          data: normalizedData,
          current,
          message: payload?.message || "Data available..",
        }
      }
    }
  } catch {
    // Fallback to normalized historical-only response.
  }

  const data = await getHistoricalData(symbol, days)
  return { success: data.length > 0, data, current: [], message: data.length > 0 ? "Data available.." : "No data available." }
}

export const getShareIndices = async (fromDate: string): Promise<{ success: boolean; data: ShareIndexPoint[] }> => {
  const url = new URL(DSE_INDICES_URL)
  url.searchParams.set("from", fromDate)
  const response = await fetch(url.toString(), { next: { revalidate: 300 } })
  if (!response.ok) throw new Error(`Failed to fetch share indices: ${response.status}`)
  const payload = await response.json()
  const rows = Array.isArray(payload?.data) ? payload.data : []
  const data: ShareIndexPoint[] = rows.map((item: any) => ({
    indexDescription: String(item.IndexDescription || ""),
    closingPrice: parseClosingPrice(item.ClosingPrice),
    change: toNumber(item.Change),
    code: String(item.Code || ""),
  }))
  return { success: Boolean(payload?.success ?? true), data }
}

export const getGainersLosers = async (): Promise<{ success: boolean; data: MoverPoint[] }> => {
  const response = await fetch(DSE_MOVERS_URL, { next: { revalidate: 120 } })
  if (!response.ok) throw new Error(`Failed to fetch gainers/losers: ${response.status}`)
  const payload = await response.json()
  const rows = Array.isArray(payload?.gainers_and_losers) ? payload.gainers_and_losers : []
  const data: MoverPoint[] = rows.map((item: any) => ({
    company: String(item.company || ""),
    change: toNumber(item.change),
    price: toNumber(item.price),
    volume: toNumber(item.volume),
  }))
  return { success: Boolean(payload?.success ?? true), data }
}

export const getTopMovers = async (): Promise<{ success: boolean; data: LiveMoverPoint[] }> => {
  const response = await fetch(DSE_TOP_MOVERS_URL, { next: { revalidate: 120 } })
  if (!response.ok) throw new Error(`Failed to fetch movers: ${response.status}`)
  const payload = await response.json()
  const rows = Array.isArray(payload?.movers) ? payload.movers : []
  const data: LiveMoverPoint[] = rows.map((item: any) => ({
    company: String(item.company || ""),
    price: toNumber(item.price),
    volume: toNumber(item.volume),
  }))
  return { success: Boolean(payload?.success ?? true), data }
}

export const getWatchlistSymbols = (stocks: StockData[]) => {
  if (stocks.length === 0) return SAMPLE_SYMBOLS
  return stocks.slice(0, 8).map((stock) => stock.symbol)
}
