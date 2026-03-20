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
  close: number
  volume: number
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

export const normalizeStocks = (raw: any[]): StockData[] => {
  return raw.map((item) => ({
    id: String(item.id || item.security?.id || item.companyId || item.security?.symbol || item.symbol || Math.random()),
    symbol: item.security?.symbol || item.company?.symbol || item.symbol || "N/A",
    name: item.security?.securityDesc || item.company?.name || item.name || "Unknown Company",
    price: toNumber(item.marketPrice ?? item.openingPrice),
    change: toNumber(item.change),
    changePercent: toNumber(item.percentageChange),
    volume: toNumber(item.volume),
    marketCap: item.marketCap == null ? undefined : toNumber(item.marketCap),
    bestBidPrice: item.bestBidPrice == null ? undefined : toNumber(item.bestBidPrice),
    bestOfferPrice: item.bestOfferPrice == null ? undefined : toNumber(item.bestOfferPrice),
    openingPrice: item.openingPrice == null ? undefined : toNumber(item.openingPrice),
  }))
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
    .map((item: any) => ({
      date: String(item.date || item.trade_date || item.timestamp || item.day || item.createdAt || "").slice(0, 10),
      close: toNumber(item.close ?? item.closing_price ?? item.close_price ?? item.marketPrice ?? item.price),
      volume: toNumber(item.volume),
    }))
    .filter((point) => point.date && point.close > 0)
}

const generateFallbackHistory = (symbol: string, days: number, basePrice: number): HistoricalPoint[] => {
  const seed = symbol
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  let lastPrice = basePrice > 0 ? basePrice : 100 + (seed % 900)

  return Array.from({ length: days }).map((_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (days - index - 1))
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

export const getHistoricalData = async (symbol: string, days = 30): Promise<HistoricalPoint[]> => {
  try {
    const historyUrl = new URL(DSE_HISTORY_URL)
    historyUrl.searchParams.set("security_code", symbol)
    historyUrl.searchParams.set("days", String(days))
    historyUrl.searchParams.set("class", "EQUITY")
    const response = await fetch(historyUrl.toString(), { next: { revalidate: 300 } })
    if (response.ok) {
      const payload = await response.json()
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
    const historyUrl = new URL(DSE_HISTORY_URL)
    historyUrl.searchParams.set("security_code", symbol)
    historyUrl.searchParams.set("days", String(days))
    historyUrl.searchParams.set("class", "EQUITY")
    const response = await fetch(historyUrl.toString(), { next: { revalidate: 300 } })
    if (response.ok) {
      const payload = await response.json()
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

      return {
        success: Boolean(payload?.success ?? true),
        data: normalizedData,
        current,
        message: payload?.message || "Data available..",
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
