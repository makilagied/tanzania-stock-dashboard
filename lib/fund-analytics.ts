import type { ITrustFundRecord } from "@/lib/itrust-funds"

/** Period presets for fund performance analytics */
export type FundAnalyticsPeriod = "1w" | "1m" | "qtd" | "mtd" | "ytd"

export type FundPeriodAnalytics = {
  period: FundAnalyticsPeriod
  /** Human-readable range label */
  rangeLabel: string
  startDate: string | null
  endDate: string | null
  observations: number
  navStart: number | null
  navEnd: number | null
  /** Simple total return over the window: (end/start - 1) × 100 */
  totalReturnPct: number | null
  /** Annualized return from total return (may be noisy for very short windows) */
  annualizedReturnPct: number | null
  /** Sample std dev of daily simple returns, annualized (√252) */
  volatilityAnnualizedPct: number | null
  /** Max peak-to-trough decline on NAV within the window */
  maxDrawdownPct: number | null
  bestDayPct: number | null
  worstDayPct: number | null
  periodHighNav: number | null
  periodLowNav: number | null
  /** Latest sale vs repurchase spread as % of NAV (liquidity / transaction cost signal) */
  latestSpreadPct: number | null
}

const MS_DAY = 86_400_000

function startOfMonth(ts: number) {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}

function startOfQuarter(ts: number) {
  const d = new Date(ts)
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3, 1).getTime()
}

function startOfYear(ts: number) {
  const d = new Date(ts)
  return new Date(d.getFullYear(), 0, 1).getTime()
}

/**
 * Window start timestamp (inclusive) for the latest observation at `latestTs`.
 */
export function getAnalyticsWindowStart(period: FundAnalyticsPeriod, latestTs: number): number {
  switch (period) {
    case "1w":
      return latestTs - 7 * MS_DAY
    case "1m":
      return latestTs - 30 * MS_DAY
    case "mtd":
      return startOfMonth(latestTs)
    case "qtd":
      return startOfQuarter(latestTs)
    case "ytd":
      return startOfYear(latestTs)
  }
}

export const ANALYTICS_PERIOD_LABELS: Record<FundAnalyticsPeriod, string> = {
  "1w": "1 week",
  "1m": "1 month",
  qtd: "Quarter (calendar)",
  mtd: "Month to date",
  ytd: "Year to date",
}

/** Buttons for the analytics period selector (short labels) */
export const ANALYTICS_PERIOD_OPTIONS: { id: FundAnalyticsPeriod; short: string }[] = [
  { id: "1w", short: "1W" },
  { id: "1m", short: "1M" },
  { id: "qtd", short: "Quarter" },
  { id: "mtd", short: "MTD" },
  { id: "ytd", short: "YTD" },
]

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

/**
 * `rows` must be sorted ascending by `dateSort` (oldest → newest).
 */
export function computeFundPeriodAnalytics(
  rowsAscending: ITrustFundRecord[],
  period: FundAnalyticsPeriod,
): FundPeriodAnalytics | null {
  if (rowsAscending.length === 0) return null

  const latest = rowsAscending[rowsAscending.length - 1]
  const latestTs = latest.dateSort
  const windowStart = getAnalyticsWindowStart(period, latestTs)

  const slice = rowsAscending.filter((r) => r.dateSort >= windowStart)
  if (slice.length < 2) {
    return {
      period,
      rangeLabel: ANALYTICS_PERIOD_LABELS[period],
      startDate: slice[0]?.date ?? null,
      endDate: latest.date,
      observations: slice.length,
      navStart: slice[0]?.navPerUnit ?? null,
      navEnd: latest.navPerUnit,
      totalReturnPct: null,
      annualizedReturnPct: null,
      volatilityAnnualizedPct: null,
      maxDrawdownPct: null,
      bestDayPct: null,
      worstDayPct: null,
      periodHighNav: slice[0]?.navPerUnit ?? null,
      periodLowNav: slice[0]?.navPerUnit ?? null,
      latestSpreadPct:
        latest.navPerUnit > 0
          ? ((latest.salePricePerUnit - latest.repurchasePricePerUnit) / latest.navPerUnit) * 100
          : null,
    }
  }

  const start = slice[0]
  const end = slice[slice.length - 1]
  const nav0 = start.navPerUnit
  const nav1 = end.navPerUnit

  const totalReturnPct = nav0 > 0 ? ((nav1 / nav0 - 1) * 100) : null

  const daysSpan = Math.max(1, (end.dateSort - start.dateSort) / MS_DAY)
  const years = daysSpan / 365.25
  let annualizedReturnPct: number | null = null
  if (totalReturnPct != null && nav0 > 0 && years > 0) {
    const factor = nav1 / nav0
    if (factor > 0) {
      annualizedReturnPct = (Math.pow(factor, 1 / years) - 1) * 100
    }
  }

  const dailyReturns: number[] = []
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1].navPerUnit
    const cur = slice[i].navPerUnit
    if (prev > 0) dailyReturns.push((cur - prev) / prev)
  }

  const volDaily = stdSample(dailyReturns)
  const volatilityAnnualizedPct = dailyReturns.length >= 2 ? volDaily * Math.sqrt(252) * 100 : null

  let peak = slice[0].navPerUnit
  let maxDd = 0
  let periodHigh = slice[0].navPerUnit
  let periodLow = slice[0].navPerUnit
  for (const r of slice) {
    const n = r.navPerUnit
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

  const latestSpreadPct =
    latest.navPerUnit > 0
      ? ((latest.salePricePerUnit - latest.repurchasePricePerUnit) / latest.navPerUnit) * 100
      : null

  return {
    period,
    rangeLabel: ANALYTICS_PERIOD_LABELS[period],
    startDate: start.date,
    endDate: end.date,
    observations: slice.length,
    navStart: nav0,
    navEnd: nav1,
    totalReturnPct,
    annualizedReturnPct,
    volatilityAnnualizedPct,
    maxDrawdownPct,
    bestDayPct,
    worstDayPct,
    periodHighNav: periodHigh,
    periodLowNav: periodLow,
    latestSpreadPct,
  }
}
