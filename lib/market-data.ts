import { historyDateToIsoDate } from "@/lib/history-date"
import { itrustGet } from "@/lib/itrust-market-client"

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

export interface IntradayPoint {
  /** Wall-clock (EAT) time as "HH:MM". */
  time: string
  /** Epoch ms of that wall-clock time encoded as UTC, so charts render it with UTC labels. */
  t: number
  price: number
}

export interface IntradayData {
  success: boolean
  date: string
  /** True while the market is open and the series is still updating. */
  isLive: boolean
  /** Human-readable status from the source, e.g. "Showing closing data for 30 Sep 2026". */
  message: string
  open?: number
  high?: number
  low?: number
  points: IntradayPoint[]
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

/** Max history span requested from the iTrust 360 historical endpoint. */
const HISTORY_MAX_DAYS = 4000
/** Synthetic history is only for empty API responses; long spans compound noise into nonsense prices. */
const FALLBACK_HISTORY_MAX_DAYS = 120

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

type ItrustSecurity = {
  ticker?: string
  name?: string
  type?: string
  price?: number | string
  change?: number | string
  change_percent?: number | string
  volume?: number | string
}

type ItrustSecuritiesPage = { next?: string | null; results?: ItrustSecurity[] }

export const normalizeStocks = (raw: ItrustSecurity[]): StockData[] => {
  return raw
    .filter((item) => item.ticker && (item.type == null || item.type === "equity"))
    .map((item) => {
      const price = toNumber(item.price)
      const change = toNumber(item.change)
      const pct = parseOptionalPercent(item.change_percent)
      const prevClose = price - change
      return {
        id: String(item.ticker),
        symbol: String(item.ticker),
        name: item.name || String(item.ticker),
        price,
        change,
        changePercent: pct ?? (prevClose > 0 ? (change / prevClose) * 100 : 0),
        volume: toNumber(item.volume),
      }
    })
}

export const getLiveStocks = async (): Promise<StockData[]> => {
  const rows: ItrustSecurity[] = []
  let path: string | null = "/market/securities/?type=equity&page_size=100&sort=-price"
  // Follow pagination defensively (page_size is honoured today, but don't rely on it).
  for (let i = 0; path && i < 10; i++) {
    const page: ItrustSecuritiesPage = await itrustGet<ItrustSecuritiesPage>(path, 60)
    rows.push(...(Array.isArray(page?.results) ? page.results : []))
    path = page?.next ? page.next.replace(/^https?:\/\/[^/]+\/api\/client/, "") : null
  }
  return normalizeStocks(rows)
}

type ItrustBookLevel = { price?: string | number; quantity?: number | string }

/** `companyId` is the ticker symbol (StockData.id). Maps bid/ask ladders onto the UI's paired rows. */
export const getMarketOrders = async (companyId: string) => {
  const payload = await itrustGet<{
    data?: { order_book?: { best_bid?: ItrustBookLevel | null; best_ask?: ItrustBookLevel | null; bids?: ItrustBookLevel[]; asks?: ItrustBookLevel[] } }
  }>(`/market/securities/${encodeURIComponent(companyId)}/intraday/`, 60)
  const book = payload?.data?.order_book ?? {}
  const bids = Array.isArray(book.bids) ? book.bids : []
  const asks = Array.isArray(book.asks) ? book.asks : []
  const orders = Array.from({ length: Math.max(bids.length, asks.length) }, (_, i) => ({
    buyPrice: toNumber(bids[i]?.price),
    buyQuantity: toNumber(bids[i]?.quantity),
    sellPrice: toNumber(asks[i]?.price),
    sellQuantity: toNumber(asks[i]?.quantity),
  }))
  return {
    bestBuyPrice: toNumber(book.best_bid?.price ?? bids[0]?.price),
    bestSellPrice: toNumber(book.best_ask?.price ?? asks[0]?.price),
    orders,
  }
}

export const getIntradayData = async (symbol: string): Promise<IntradayData> => {
  const payload = await itrustGet<{
    meta?: { message?: string; data_date?: string }
    data?: {
      intraday_date?: string
      is_live_intraday?: boolean
      market_data?: { opening_price?: string | number; high_price?: string | number; low_price?: string | number }
      chart_data?: { price_data?: { time?: string; price?: string | number | null }[] }
    }
  }>(`/market/securities/${encodeURIComponent(symbol)}/intraday/`, 60)
  const d = payload?.data
  const date = d?.intraday_date ?? payload?.meta?.data_date ?? ""
  const points: IntradayPoint[] = (d?.chart_data?.price_data ?? [])
    .map((row) => {
      const time = String(row.time ?? "")
      const price = toNumber(row.price)
      const t = Date.parse(`${date}T${time}:00Z`)
      return /^\d{1,2}:\d{2}$/.test(time) && price > 0 && Number.isFinite(t) ? { time, t, price } : null
    })
    .filter((p): p is IntradayPoint => p != null)
  const opt = (v: unknown) => {
    const n = toNumber(v)
    return n > 0 ? n : undefined
  }
  return {
    success: points.length > 0,
    date,
    isLive: Boolean(d?.is_live_intraday),
    message: payload?.meta?.message ?? "",
    open: opt(d?.market_data?.opening_price),
    high: opt(d?.market_data?.high_price),
    low: opt(d?.market_data?.low_price),
    points,
  }
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

/** Fetches iTrust history and reshapes it as `{ data: ohlcv rows, current: [...] }` for the normalizers below. */
const fetchHistoryPayload = async (symbol: string, days: number) => {
  const span = Math.min(Math.max(7, days), HISTORY_MAX_DAYS)
  const from = new Date(Date.now() - span * 86_400_000).toISOString().slice(0, 10)
  const payload = await itrustGet<{
    data?: { ohlcv?: unknown[]; market_cap?: number | string | null; stats?: { period_close?: number; period_low?: number; period_high?: number } }
  }>(`/market/securities/${encodeURIComponent(symbol)}/historical/?from=${from}`, 300)
  const d = payload?.data
  const ohlcv = Array.isArray(d?.ohlcv) ? d.ohlcv : []
  const last = ohlcv[ohlcv.length - 1] as { date?: string; close?: number; low?: number; high?: number } | undefined
  return {
    success: true,
    message: "Data available..",
    data: ohlcv,
    current: last
      ? [
          {
            company: symbol,
            price: last.close ?? d?.stats?.period_close,
            low: last.low,
            high: last.high,
            market_cap: d?.market_cap ?? undefined,
            trade_date: last.date,
          },
        ]
      : [],
  }
}

export const getHistoricalData = async (symbol: string, days = 30): Promise<HistoricalPoint[]> => {
  try {
    const payload = await fetchHistoryPayload(symbol, days)
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
    const payload = await fetchHistoryPayload(symbol, days)
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

/** The iTrust 360 API exposes no index series, so this reports "unavailable" (UI hides the strip). */
export const getShareIndices = async (_fromDate: string): Promise<{ success: boolean; data: ShareIndexPoint[] }> => {
  return { success: false, data: [] }
}

type ItrustMover = { ticker?: string; price?: number | string; change?: number | string; volume?: number | string }

export const getGainersLosers = async (): Promise<{ success: boolean; data: MoverPoint[] }> => {
  const payload = await itrustGet<{ data?: { top_gainers?: ItrustMover[]; top_losers?: ItrustMover[] } }>(
    "/market/movers/",
    120,
  )
  const rows = [...(payload?.data?.top_gainers ?? []), ...(payload?.data?.top_losers ?? [])]
  const data: MoverPoint[] = rows.map((item) => ({
    company: String(item.ticker || ""),
    change: toNumber(item.change),
    price: toNumber(item.price),
    volume: toNumber(item.volume),
  }))
  return { success: true, data }
}

/** Most-traded equities by volume (the old DSE "movers" feed was volume-led). */
export const getTopMovers = async (): Promise<{ success: boolean; data: LiveMoverPoint[] }> => {
  const stocks = await getLiveStocks()
  const data: LiveMoverPoint[] = stocks
    .filter((s) => s.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 10)
    .map((s) => ({ company: s.symbol, price: s.price, volume: s.volume }))
  return { success: true, data }
}

export const getWatchlistSymbols = (stocks: StockData[]) => {
  if (stocks.length === 0) return SAMPLE_SYMBOLS
  return stocks.slice(0, 8).map((stock) => stock.symbol)
}
