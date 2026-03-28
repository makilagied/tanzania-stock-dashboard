import { historyDateToIsoDate } from "@/lib/history-date"

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

/**
 * History OHLCV numbers: thousands commas, optional European style (1.234,56).
 */
const toNumberHistory = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    let s = value.trim().replace(/\s/g, "")
    if (s === "") return 0
    // European: dot thousands + comma decimals → 1234.56
    if (/^\d{1,3}(\.\d{3})*,\d+$/.test(s)) {
      s = s.replace(/\./g, "").replace(",", ".")
    } else {
      s = s.replace(/,/g, "")
    }
    const parsed = Number(s)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

/** Prefer split-adjusted closes when the feed provides them; then official session close; avoid mistaking IDs/other fields for price. */
const HISTORY_ADJUSTED_CLOSE_KEYS = [
  "adjusted_close",
  "adj_close",
  "adjClose",
  "adjustedClose",
  "AdjClose",
] as const

const HISTORY_OFFICIAL_CLOSE_KEYS = [
  "closing_price",
  "close_price",
  "closingPrice",
  "ClosingPrice",
  "CLOSING_PRICE",
  "official_close",
  "officialClose",
  "settlement_price",
  "settlementPrice",
  "end_of_day_price",
  "endOfDayPrice",
  "daily_close",
  "dailyClose",
  "last_trade_price",
  "lastTradePrice",
  "ltp",
  "LTP",
  "lastPrice",
  "last_price",
] as const

const HISTORY_GENERIC_CLOSE_KEYS = ["close", "Close"] as const

const HISTORY_MARKET_FALLBACK_KEYS = ["marketPrice", "market_price", "price", "Price"] as const

function pickCloseFromObject(obj: any, keys: readonly string[]): number {
  if (!obj || typeof obj !== "object") return 0
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const n = toNumberHistory(obj[k])
      if (n > 0) return n
    }
  }
  return 0
}

/** Read session close from a row and common nested DSE/API shapes. */
function historyPickSessionClose(item: any): number {
  const layers = [
    item,
    item?.trade,
    item?.market_data,
    item?.marketData,
    item?.attributes,
    item?.details,
    item?.ohlc,
    item?.quote,
  ].filter((o) => o != null && typeof o === "object" && !Array.isArray(o))

  for (const layer of layers) {
    let n = pickCloseFromObject(layer, HISTORY_ADJUSTED_CLOSE_KEYS)
    if (n > 0) return n
    n = pickCloseFromObject(layer, HISTORY_OFFICIAL_CLOSE_KEYS)
    if (n > 0) return n
  }
  for (const layer of layers) {
    const n = pickCloseFromObject(layer, HISTORY_GENERIC_CLOSE_KEYS)
    if (n > 0) return n
  }
  for (const layer of layers) {
    const n = pickCloseFromObject(layer, HISTORY_MARKET_FALLBACK_KEYS)
    if (n > 0) return n
  }
  return 0
}

/** Normalize one history row: arrays like [date, o, h, l, c, vol] or { t, o, h, l, c }. */
function normalizeRawHistoryRow(item: any): Record<string, unknown> | null {
  if (item == null) return null
  if (Array.isArray(item)) {
    const d = item[0]
    if (item.length >= 5) {
      return {
        date: d,
        open: item[1],
        high: item[2],
        low: item[3],
        close: item[4],
        volume: item[5],
      }
    }
    if (item.length >= 2) {
      return { date: d, close: item[1], volume: item[2] }
    }
    return null
  }
  if (typeof item === "object") {
    const t = item.t ?? item.T ?? item.time ?? item.timestamp
    if (t != null && (item.c != null || item.C != null)) {
      return {
        ...item,
        date: t,
        close: item.c ?? item.C,
        open: item.o ?? item.O,
        high: item.h ?? item.H,
        low: item.l ?? item.L,
        volume: item.v ?? item.V ?? item.volume,
      }
    }
    return item as Record<string, unknown>
  }
  return null
}

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
    .map((raw: any): HistoricalPoint | null => {
      const item = normalizeRawHistoryRow(raw)
      if (!item) return null

      const rawDate = String(
        item.date ??
          item.trade_date ??
          item.tradeDate ??
          item.timestamp ??
          item.day ??
          item.createdAt ??
          item.price_date ??
          item.PriceDate ??
          item.t ??
          "",
      ).trim()
      const iso = historyDateToIsoDate(rawDate)
      if (!iso) return null

      const close = historyPickSessionClose(item)
      if (!(close > 0)) return null

      const openRaw = toNumberHistory(
        item.opening_price ??
          item.open_price ??
          item.openingPrice ??
          item.openPrice ??
          item.open ??
          item.start_price ??
          item.Open ??
          item.o ??
          item.O,
      )
      const highRaw = toNumberHistory(
        item.high ?? item.day_high ?? item.dayHigh ?? item.high_price ?? item.High ?? item.h ?? item.H,
      )
      const lowRaw = toNumberHistory(
        item.low ?? item.day_low ?? item.dayLow ?? item.low_price ?? item.Low ?? item.l ?? item.L,
      )
      const point: HistoricalPoint = {
        date: iso,
        close,
        volume: toNumberHistory(item.volume ?? item.total_volume ?? item.totalVolume ?? item.Volume ?? item.v ?? item.V),
      }
      if (openRaw > 0) point.open = openRaw
      if (highRaw > 0) point.high = highRaw
      if (lowRaw > 0) point.low = lowRaw
      return point
    })
    .filter((point: HistoricalPoint | null): point is HistoricalPoint => point != null && point.close > 0)
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
