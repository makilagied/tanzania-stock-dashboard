import type { HistoricalPoint } from "@/lib/market-data"
import {
  ANALYTICS_PERIOD_LABELS,
  type FundAnalyticsPeriod,
  getAnalyticsWindowStart,
} from "@/lib/fund-analytics"

const MS_DAY = 86_400_000

/** Parse history date strings (ISO, DD/MM/YYYY, etc.) to a stable UTC-noon timestamp for sorting/filtering. */
export function parseStockHistoryDateTs(dateStr: string): number {
  const s = String(dateStr ?? "").trim()
  if (!s) return 0
  const isoHead = s.slice(0, 10)
  let ts = Date.parse(`${isoHead}T12:00:00Z`)
  if (Number.isFinite(ts)) return ts
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s)
  if (m) {
    const day = Number(m[1])
    const month = Number(m[2]) - 1
    const year = Number(m[3])
    const dt = new Date(Date.UTC(year, month, day, 12, 0, 0))
    return Number.isFinite(dt.getTime()) ? dt.getTime() : 0
  }
  ts = Date.parse(s)
  return Number.isFinite(ts) ? ts : 0
}

export type StockHistoryRow = HistoricalPoint & { dateSort: number }

export type StockChartRow = StockHistoryRow & {
  sma20?: number
  sma50?: number
}

export type StockPeriodAnalytics = {
  period: FundAnalyticsPeriod
  rangeLabel: string
  startDate: string | null
  endDate: string | null
  observations: number
  closeStart: number | null
  closeEnd: number | null
  totalReturnPct: number | null
  annualizedReturnPct: number | null
  volatilityAnnualizedPct: number | null
  maxDrawdownPct: number | null
  bestDayPct: number | null
  worstDayPct: number | null
  periodHighClose: number | null
  periodLowClose: number | null
  avgVolume: number | null
  latestVolume: number | null
  volumeVsAvgPct: number | null
  sma20: number | null
  sma50: number | null
  lastClose: number | null
  maTrendNote: string | null
}

function mean(xs: number[]) {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function stdSample(xs: number[]) {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(v)
}

/** Parse YYYY-MM-DD to sortable UTC noon timestamp */
export function historyToAscending(points: HistoricalPoint[]): StockHistoryRow[] {
  return points
    .map((p) => {
      const ts = parseStockHistoryDateTs(p.date)
      return { ...p, dateSort: ts }
    })
    .filter((p) => p.dateSort > 0 && p.close > 0)
    .sort((a, b) => a.dateSort - b.dateSort)
}

export function filterStockHistoryByPeriod(
  rowsAscending: StockHistoryRow[],
  period: FundAnalyticsPeriod,
): StockHistoryRow[] {
  if (rowsAscending.length === 0) return []
  if (period === "all") return rowsAscending
  const latestTs = rowsAscending[rowsAscending.length - 1].dateSort
  const windowStart = getAnalyticsWindowStart(period, latestTs)
  return rowsAscending.filter((r) => r.dateSort >= windowStart)
}

/** Rolling SMAs on full sorted history (for chart + signals). */
export function addMovingAverages(rowsAscending: StockHistoryRow[]): StockChartRow[] {
  return rowsAscending.map((row, i) => {
    let sma20: number | undefined
    if (i >= 19) {
      sma20 = mean(rowsAscending.slice(i - 19, i + 1).map((x) => x.close))
    }
    let sma50: number | undefined
    if (i >= 49) {
      sma50 = mean(rowsAscending.slice(i - 49, i + 1).map((x) => x.close))
    }
    return { ...row, sma20, sma50 }
  })
}

export function buildChartSeriesForPeriod(
  enrichedAscending: StockChartRow[],
  period: FundAnalyticsPeriod,
): StockChartRow[] {
  return filterStockHistoryByPeriod(enrichedAscending, period)
}

function buildMaNote(
  lastClose: number | null,
  sma20: number | null,
  sma50: number | null,
): string | null {
  if (lastClose == null) return null
  if (sma20 == null && sma50 == null) {
    return "Need at least 50 price sessions in history for 20/50-day averages."
  }
  const parts: string[] = []
  if (sma20 != null) {
    parts.push(
      lastClose >= sma20
        ? "Price is at or above the 20-day average."
        : "Price is below the 20-day average.",
    )
  }
  if (sma50 != null) {
    parts.push(
      lastClose >= sma50
        ? "At or above the 50-day average."
        : "Below the 50-day average.",
    )
  }
  if (sma20 != null && sma50 != null) {
    if (sma20 > sma50) parts.push("20-day average above 50-day (short-term vs medium-term strength).")
    else if (sma20 < sma50) parts.push("20-day average below 50-day (short-term weaker than medium-term trend).")
  }
  return parts.join(" ")
}

/**
 * Period analytics on the window slice; MA levels from the latest row of **full** enriched history.
 */
export function computeStockPeriodAnalytics(
  fullEnrichedAscending: StockChartRow[],
  period: FundAnalyticsPeriod,
): StockPeriodAnalytics | null {
  if (fullEnrichedAscending.length === 0) return null

  const latestRow = fullEnrichedAscending[fullEnrichedAscending.length - 1]
  const latestTs = latestRow.dateSort
  const windowStart = getAnalyticsWindowStart(period, latestTs)
  const slice =
    period === "all"
      ? fullEnrichedAscending
      : fullEnrichedAscending.filter((r) => r.dateSort >= windowStart)

  const sma20 = latestRow.sma20 ?? null
  const sma50 = latestRow.sma50 ?? null
  const lastClose = latestRow.close

  if (slice.length < 2) {
    return {
      period,
      rangeLabel: ANALYTICS_PERIOD_LABELS[period],
      startDate: slice[0]?.date ?? null,
      endDate: latestRow.date,
      observations: slice.length,
      closeStart: slice[0]?.close ?? null,
      closeEnd: lastClose,
      totalReturnPct: null,
      annualizedReturnPct: null,
      volatilityAnnualizedPct: null,
      maxDrawdownPct: null,
      bestDayPct: null,
      worstDayPct: null,
      periodHighClose: slice[0]?.close ?? null,
      periodLowClose: slice[0]?.close ?? null,
      avgVolume: null,
      latestVolume: slice[slice.length - 1]?.volume ?? null,
      volumeVsAvgPct: null,
      sma20,
      sma50,
      lastClose,
      maTrendNote: buildMaNote(lastClose, sma20, sma50),
    }
  }

  const start = slice[0]
  const end = slice[slice.length - 1]
  const c0 = start.close
  const c1 = end.close
  const totalReturnPct = c0 > 0 ? ((c1 / c0 - 1) * 100) : null

  const daysSpan = Math.max(1, (end.dateSort - start.dateSort) / MS_DAY)
  const years = daysSpan / 365.25
  let annualizedReturnPct: number | null = null
  if (totalReturnPct != null && c0 > 0 && years > 0) {
    const factor = c1 / c0
    if (factor > 0) {
      annualizedReturnPct = (Math.pow(factor, 1 / years) - 1) * 100
    }
  }

  const dailyReturns: number[] = []
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1].close
    const cur = slice[i].close
    if (prev > 0) dailyReturns.push((cur - prev) / prev)
  }

  const volDaily = stdSample(dailyReturns)
  const volatilityAnnualizedPct = dailyReturns.length >= 2 ? volDaily * Math.sqrt(252) * 100 : null

  let peak = slice[0].close
  let maxDd = 0
  let periodHigh = slice[0].close
  let periodLow = slice[0].close
  for (const r of slice) {
    const n = r.close
    if (n > periodHigh) periodHigh = n
    if (n < periodLow) periodLow = n
    if (n > peak) peak = n
    if (peak > 0) {
      const dd = (n - peak) / peak
      if (dd < maxDd) maxDd = dd
    }
  }
  const maxDrawdownPct = maxDd * 100

  let bestDayPct: number | null = null
  let worstDayPct: number | null = null
  for (const d of dailyReturns) {
    const pct = d * 100
    if (bestDayPct === null || pct > bestDayPct) bestDayPct = pct
    if (worstDayPct === null || pct < worstDayPct) worstDayPct = pct
  }

  const vols = slice.map((r) => r.volume).filter((v) => v > 0)
  const avgVolume = vols.length > 0 ? mean(vols) : null
  const latestVolume = end.volume
  const volumeVsAvgPct =
    avgVolume != null && avgVolume > 0 ? ((latestVolume / avgVolume - 1) * 100) : null

  return {
    period,
    rangeLabel: ANALYTICS_PERIOD_LABELS[period],
    startDate: start.date,
    endDate: end.date,
    observations: slice.length,
    closeStart: c0,
    closeEnd: c1,
    totalReturnPct,
    annualizedReturnPct,
    volatilityAnnualizedPct,
    maxDrawdownPct,
    bestDayPct,
    worstDayPct,
    periodHighClose: periodHigh,
    periodLowClose: periodLow,
    avgVolume,
    latestVolume,
    volumeVsAvgPct,
    sma20,
    sma50,
    lastClose,
    maTrendNote: buildMaNote(lastClose, sma20, sma50),
  }
}
