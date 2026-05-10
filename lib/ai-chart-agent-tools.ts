import { z } from "zod"
import { parseFlexibleDateTs } from "@/lib/date-parse"
import {
  computeFundPeriodAnalytics,
  computeFundPeriodAnalyticsForYmdRange,
  type FundAnalyticsPeriod,
} from "@/lib/fund-analytics"
import { ALL_FUNDS, getFundMeta, type FundMeta } from "@/lib/funds-catalog"
import { resolveFundCatalogId } from "@/lib/fund-catalog-resolve"
import { getCachedFundRecords } from "@/lib/funds-data-cached"
import type { ITrustFundRecord } from "@/lib/itrust-funds"
import {
  getCachedHistoricalDataWithMeta,
  getCachedLiveStocks,
  getCachedMarketOrders,
  getCachedShareIndices,
  getCachedTopMovers,
} from "@/lib/market-data-cached"
import {
  addMovingAverages,
  computeStockPeriodAnalytics,
  computeStockPeriodAnalyticsForYmdRange,
  historyToAscending,
} from "@/lib/stock-analytics"

/** Matches client `STOCK_ANALYTICS_MAX_DAYS` for consistent analytics windows. */
const HISTORY_DAYS_FOR_ANALYTICS = 4000

const periodSchema = z.enum(["1w", "1m", "1y", "qtd", "mtd", "ytd", "all"])

const isoYmd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")

function refinePeriodOrRange(
  v: { period?: FundAnalyticsPeriod; range_start?: string; range_end?: string },
  ctx: z.RefinementCtx,
) {
  const fullRange = v.range_start != null && v.range_end != null
  const halfRange = (v.range_start != null) !== (v.range_end != null)
  const hasPeriod = v.period != null
  if (halfRange) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "range_start and range_end must both be provided.",
    })
  }
  if (fullRange && hasPeriod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Use either period or range_start/range_end, not both.",
    })
  }
  if (!fullRange && !hasPeriod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide period or both range_start and range_end.",
    })
  }
}

export type ChartDashboardPatch = {
  /** Stocks dashboard */
  symbol?: string
  period?: FundAnalyticsPeriod
  chartType?: "line" | "candlestick"
  /** Funds dashboard */
  fundId?: string
  fundPeriod?: FundAnalyticsPeriod
  /** Compare dashboard */
  leftKind?: "stock" | "fund"
  rightKind?: "stock" | "fund"
  leftStock?: string
  rightStock?: string
  leftFund?: string
  rightFund?: string
  comparePeriod?: FundAnalyticsPeriod
}

export type ChartAgentToolResult = {
  result: unknown
  dashboardPatch?: ChartDashboardPatch
  navigationPath?: string
}

function defaultIndicesFromDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1)
  }
  return date.toISOString().slice(0, 10)
}

function mergePatch(base: ChartDashboardPatch, next: ChartDashboardPatch): ChartDashboardPatch {
  return { ...base, ...next }
}

const liveStocksArgs = z.object({ limit: z.number().int().min(1).max(200).optional() })
const snapshotArgs = z.object({ symbol: z.string().min(1).max(16) })
const metricsArgs = z
  .object({
    symbol: z.string().min(1).max(16),
    period: periodSchema.optional(),
    range_start: isoYmd.optional(),
    range_end: isoYmd.optional(),
  })
  .superRefine(refinePeriodOrRange)
const orderBookArgs = z.object({ symbol: z.string().min(1).max(16) })
const setChartArgs = z.object({
  symbol: z.string().min(1).max(16).optional(),
  analytics_period: periodSchema.optional(),
  chart_type: z.enum(["line", "candlestick"]).optional(),
  reason: z.string().max(500).optional(),
})

const setFundPageArgs = z.object({
  fund_id: z.string().min(1).max(80).optional(),
  analytics_period: periodSchema.optional(),
  reason: z.string().max(500).optional(),
})

const setComparePageArgs = z.object({
  left_kind: z.enum(["stock", "fund"]).optional(),
  right_kind: z.enum(["stock", "fund"]).optional(),
  left_stock: z.string().max(16).optional(),
  right_stock: z.string().max(16).optional(),
  left_fund: z.string().max(80).optional(),
  right_fund: z.string().max(80).optional(),
  period: periodSchema.optional(),
  reason: z.string().max(500).optional(),
})

const fundMetricsArgs = z
  .object({
    fund_id: z.string().min(1).max(80),
    period: periodSchema.optional(),
    range_start: isoYmd.optional(),
    range_end: isoYmd.optional(),
  })
  .superRefine(refinePeriodOrRange)

const comparePairArgs = z
  .object({
    left_kind: z.enum(["stock", "fund"]),
    left_id: z.string().min(1).max(32),
    right_kind: z.enum(["stock", "fund"]),
    right_id: z.string().min(1).max(32),
    period: periodSchema.optional(),
    range_start: isoYmd.optional(),
    range_end: isoYmd.optional(),
  })
  .superRefine(refinePeriodOrRange)

const navigatePageArgs = z.object({
  path: z.enum(["/", "/funds", "/compare"]),
  reason: z.string().max(500).optional(),
})

function fundRowsAscendingForAnalytics(rows: ITrustFundRecord[], meta: FundMeta | null): ITrustFundRecord[] {
  const parseDateSort = (dateRaw: string) => {
    if (!meta) return parseFlexibleDateTs(dateRaw, { preference: "day-first" })
    if (meta.provider === "inuka") {
      return parseFlexibleDateTs(dateRaw, { dashPreference: "day-first", slashPreference: "month-first" })
    }
    if (meta.provider === "itrust" || meta.provider === "vertex") {
      return parseFlexibleDateTs(dateRaw, { preference: "month-first" })
    }
    return parseFlexibleDateTs(dateRaw, { preference: "day-first" })
  }
  return [...rows]
    .map((r) => ({
      ...r,
      dateSort: parseDateSort(r.date) || r.dateSort,
    }))
    .sort((a, b) => a.dateSort - b.dateSort)
}

type ChartMetricsWindow =
  | { mode: "preset"; period: FundAnalyticsPeriod }
  | { mode: "range"; range_start: string; range_end: string }

async function loadStockPeriodAnalytics(symbol: string, window: ChartMetricsWindow) {
  const upper = symbol.toUpperCase()
  const { data: hist, outage } = await getCachedHistoricalDataWithMeta(upper, HISTORY_DAYS_FOR_ANALYTICS)
  if (outage || !hist.success || !Array.isArray(hist.data) || hist.data.length === 0) {
    return {
      kind: "stock" as const,
      id: upper,
      error: hist.message || "No history",
      analytics: null,
    }
  }
  const ascending = historyToAscending(hist.data)
  const enriched = addMovingAverages(ascending)
  if (window.mode === "preset") {
    return {
      kind: "stock" as const,
      id: upper,
      error: null as string | null,
      analytics: computeStockPeriodAnalytics(enriched, window.period),
    }
  }
  const analytics = computeStockPeriodAnalyticsForYmdRange(enriched, window.range_start, window.range_end)
  if (!analytics) {
    return {
      kind: "stock" as const,
      id: upper,
      error: "No price rows in that date range.",
      analytics: null,
    }
  }
  return {
    kind: "stock" as const,
    id: upper,
    error: null as string | null,
    analytics,
  }
}

async function loadFundPeriodAnalytics(rawFundId: string, window: ChartMetricsWindow) {
  const fundId = resolveFundCatalogId(rawFundId) ?? rawFundId.trim()
  const meta = getFundMeta(fundId)
  if (!meta) {
    return { kind: "fund" as const, id: fundId, error: "Unknown fund id.", analytics: null, meta: null }
  }
  const { data: rows, outage } = await getCachedFundRecords(fundId, meta)
  if (outage || rows.length === 0) {
    return {
      kind: "fund" as const,
      id: fundId,
      error: "No NAV rows.",
      analytics: null,
      meta: meta.shortLabel,
    }
  }
  const asc = fundRowsAscendingForAnalytics(rows, meta)
  if (window.mode === "preset") {
    return {
      kind: "fund" as const,
      id: fundId,
      error: null as string | null,
      meta: meta.shortLabel,
      analytics: computeFundPeriodAnalytics(asc, window.period),
    }
  }
  const analytics = computeFundPeriodAnalyticsForYmdRange(asc, window.range_start, window.range_end)
  if (!analytics) {
    return {
      kind: "fund" as const,
      id: fundId,
      error: "No NAV rows in that date range.",
      analytics: null,
      meta: meta.shortLabel,
    }
  }
  return {
    kind: "fund" as const,
    id: fundId,
    error: null as string | null,
    meta: meta.shortLabel,
    analytics,
  }
}

export type ToolName =
  | "get_live_stocks"
  | "get_stock_snapshot"
  | "get_stock_period_metrics"
  | "get_market_indices"
  | "get_top_movers"
  | "get_order_book_levels"
  | "set_chart_view"
  | "list_funds_catalog"
  | "get_fund_period_metrics"
  | "get_compare_pair_metrics"
  | "set_fund_page_view"
  | "set_compare_page_view"
  | "navigate_to_page"

function metricsWindowFromParsed<T extends { period?: FundAnalyticsPeriod; range_start?: string; range_end?: string }>(
  parsed: T,
): ChartMetricsWindow {
  if (parsed.period != null) return { mode: "preset", period: parsed.period }
  return { mode: "range", range_start: parsed.range_start!, range_end: parsed.range_end! }
}

async function runChartAgentToolBody(name: ToolName, rawArgs: unknown): Promise<ChartAgentToolResult> {
  switch (name) {
    case "get_live_stocks": {
      const args = liveStocksArgs.parse(rawArgs ?? {})
      const { data: rows, stale, outage } = await getCachedLiveStocks()
      const limit = args.limit ?? 100
      const slim = rows.slice(0, limit).map((r) => ({
        symbol: r.symbol,
        name: r.name,
        price: r.price,
        change: r.change,
        changePercent: r.changePercent,
        volume: r.volume,
        id: r.id,
      }))
      return {
        result: {
          outage,
          stale,
          count: rows.length,
          stocks: slim,
        },
      }
    }
    case "get_stock_snapshot": {
      const { symbol } = snapshotArgs.parse(rawArgs)
      const upper = symbol.toUpperCase()
      const { data: rows, outage } = await getCachedLiveStocks()
      const row = rows.find((r) => r.symbol.toUpperCase() === upper)
      if (!row) {
        return { result: { found: false, symbol: upper, outage, hint: "Use get_live_stocks to list tickers." } }
      }
      return {
        result: {
          found: true,
          symbol: row.symbol,
          name: row.name,
          price: row.price,
          change: row.change,
          changePercent: row.changePercent,
          volume: row.volume,
          marketCap: row.marketCap,
          id: row.id,
        },
      }
    }
    case "get_stock_period_metrics": {
      const parsed = metricsArgs.parse(rawArgs)
      const window = metricsWindowFromParsed(parsed)
      const upper = parsed.symbol.toUpperCase()
      const { data: hist, outage } = await getCachedHistoricalDataWithMeta(upper, HISTORY_DAYS_FOR_ANALYTICS)
      if (outage || !hist.success || !Array.isArray(hist.data) || hist.data.length === 0) {
        return {
          result: {
            symbol: upper,
            window,
            error: hist.message || "No history",
            outage: Boolean(outage),
          },
        }
      }
      const ascending = historyToAscending(hist.data)
      const enriched = addMovingAverages(ascending)
      const analytics =
        window.mode === "preset"
          ? computeStockPeriodAnalytics(enriched, window.period)
          : computeStockPeriodAnalyticsForYmdRange(enriched, window.range_start, window.range_end)
      if (!analytics) {
        return {
          result: {
            symbol: upper,
            window,
            error: "No price rows in that date range.",
            outage: Boolean(outage),
          },
        }
      }
      const tail = enriched.slice(-8).map((r) => ({
        date: r.date,
        close: r.close,
        volume: r.volume,
      }))
      return {
        result: {
          symbol: upper,
          window,
          analytics,
          recentSessions: tail,
          historySessions: enriched.length,
        },
      }
    }
    case "get_market_indices": {
      const from = defaultIndicesFromDate()
      const { data: payload, stale, outage } = await getCachedShareIndices(from)
      return {
        result: {
          from,
          outage,
          stale,
          success: payload.success,
          indices: (payload.data ?? []).map((i) => ({
            code: i.code,
            description: i.indexDescription,
            closingPrice: i.closingPrice,
            change: i.change,
          })),
        },
      }
    }
    case "get_top_movers": {
      const { data: payload, stale, outage } = await getCachedTopMovers()
      return {
        result: {
          outage,
          stale,
          success: payload.success,
          movers: (payload.data ?? []).slice(0, 25).map((m) => ({
            company: m.company,
            price: m.price,
            volume: m.volume,
          })),
        },
      }
    }
    case "get_order_book_levels": {
      const { symbol } = orderBookArgs.parse(rawArgs)
      const upper = symbol.toUpperCase()
      const { data: rows } = await getCachedLiveStocks()
      const row = rows.find((r) => r.symbol.toUpperCase() === upper)
      if (!row) {
        return { result: { found: false, symbol: upper } }
      }
      const { data: book, outage } = await getCachedMarketOrders(row.id)
      const orders = Array.isArray((book as { orders?: unknown }).orders)
        ? (book as { orders: { buyPrice?: number; sellPrice?: number; buyQuantity?: number; sellQuantity?: number }[] })
            .orders
        : []
      const topBuy = orders.slice(0, 6).map((o) => ({
        buyPrice: o.buyPrice,
        buyQuantity: o.buyQuantity,
      }))
      const topSell = orders.slice(0, 6).map((o) => ({
        sellPrice: o.sellPrice,
        sellQuantity: o.sellQuantity,
      }))
      return {
        result: {
          symbol: row.symbol,
          bestBuyPrice: (book as { bestBuyPrice?: number }).bestBuyPrice ?? 0,
          bestSellPrice: (book as { bestSellPrice?: number }).bestSellPrice ?? 0,
          outage,
          sampleBuyLevels: topBuy,
          sampleSellLevels: topSell,
          depthRows: orders.length,
        },
      }
    }
    case "set_chart_view": {
      const args = setChartArgs.parse(rawArgs)
      const patch: ChartDashboardPatch = {}
      if (args.symbol) patch.symbol = args.symbol.toUpperCase()
      if (args.analytics_period) patch.period = args.analytics_period
      if (args.chart_type) patch.chartType = args.chart_type
      return {
        result: {
          ok: true,
          applied: patch,
          reason: args.reason ?? null,
        },
        dashboardPatch: Object.keys(patch).length ? patch : undefined,
      }
    }
    case "list_funds_catalog": {
      const slim = ALL_FUNDS.map((f) => ({
        id: f.id,
        shortLabel: f.shortLabel,
        label: f.label,
        provider: f.provider,
        currency: "currency" in f && f.currency ? f.currency : "TZS",
      }))
      return { result: { count: slim.length, funds: slim } }
    }
    case "get_fund_period_metrics": {
      const parsed = fundMetricsArgs.parse(rawArgs)
      const window = metricsWindowFromParsed(parsed)
      const { fund_id } = parsed
      const resolved = resolveFundCatalogId(fund_id)
      if (!resolved) {
        return { result: { fund_id, error: "Unknown fund. Use list_funds_catalog for ids and labels." } }
      }
      const meta = getFundMeta(resolved)
      if (!meta) {
        return { result: { fund_id, resolved, error: "Catalog mismatch after resolve." } }
      }
      const { data: rows, outage } = await getCachedFundRecords(resolved, meta)
      if (outage || rows.length === 0) {
        return { result: { fund_id, label: meta.shortLabel, error: "No NAV data", outage: Boolean(outage) } }
      }
      const asc = fundRowsAscendingForAnalytics(rows, meta)
      const analytics =
        window.mode === "preset"
          ? computeFundPeriodAnalytics(asc, window.period)
          : computeFundPeriodAnalyticsForYmdRange(asc, window.range_start, window.range_end)
      if (!analytics) {
        return {
          result: {
            fund_id: resolved,
            queriedAs: fund_id,
            label: meta.shortLabel,
            window,
            error: "No NAV observations in that date range.",
            outage: Boolean(outage),
          },
        }
      }
      const tail = asc.slice(-5).map((r) => ({ date: r.date, navPerUnit: r.navPerUnit }))
      return {
        result: {
          fund_id: resolved,
          queriedAs: fund_id,
          label: meta.shortLabel,
          provider: meta.provider,
          window,
          analytics,
          recentNav: tail,
          sessions: asc.length,
        },
      }
    }
    case "get_compare_pair_metrics": {
      const parsed = comparePairArgs.parse(rawArgs)
      const { left_kind, left_id, right_kind, right_id } = parsed
      const window = metricsWindowFromParsed(parsed)
      const leftKey =
        left_kind === "stock" ? left_id.trim().toUpperCase() : (resolveFundCatalogId(left_id) ?? left_id.trim())
      const rightKey =
        right_kind === "stock"
          ? right_id.trim().toUpperCase()
          : (resolveFundCatalogId(right_id) ?? right_id.trim())
      const [left, right] = await Promise.all([
        left_kind === "stock" ? loadStockPeriodAnalytics(leftKey, window) : loadFundPeriodAnalytics(leftKey, window),
        right_kind === "stock"
          ? loadStockPeriodAnalytics(rightKey, window)
          : loadFundPeriodAnalytics(rightKey, window),
      ])
      const ltr = left.analytics && "totalReturnPct" in left.analytics ? left.analytics.totalReturnPct : null
      const rtr = right.analytics && "totalReturnPct" in right.analytics ? right.analytics.totalReturnPct : null
      const spread =
        ltr != null && rtr != null && !Number.isNaN(ltr) && !Number.isNaN(rtr) ? ltr - rtr : null
      return {
        result: {
          window,
          left,
          right,
          spreadTotalReturnPctPoints: spread,
        },
      }
    }
    case "set_fund_page_view": {
      const args = setFundPageArgs.parse(rawArgs)
      const patch: ChartDashboardPatch = {}
      if (args.fund_id) {
        const resolved = resolveFundCatalogId(args.fund_id)
        if (resolved) patch.fundId = resolved
      }
      if (args.analytics_period) patch.fundPeriod = args.analytics_period
      return {
        result: {
          ok: true,
          applied: patch,
          resolvedFundId: patch.fundId ?? null,
          reason: args.reason ?? null,
        },
        dashboardPatch: Object.keys(patch).length ? patch : undefined,
      }
    }
    case "set_compare_page_view": {
      const args = setComparePageArgs.parse(rawArgs)
      const patch: ChartDashboardPatch = {}
      if (args.left_stock?.trim()) patch.leftStock = args.left_stock.trim().toUpperCase()
      if (args.right_stock?.trim()) patch.rightStock = args.right_stock.trim().toUpperCase()
      if (args.left_fund?.trim()) {
        const id = resolveFundCatalogId(args.left_fund)
        if (id) patch.leftFund = id
      }
      if (args.right_fund?.trim()) {
        const id = resolveFundCatalogId(args.right_fund)
        if (id) patch.rightFund = id
      }
      if (args.left_kind) patch.leftKind = args.left_kind
      else if (patch.leftFund && patch.leftStock) patch.leftKind = "fund"
      else if (patch.leftFund) patch.leftKind = "fund"
      else if (patch.leftStock) patch.leftKind = "stock"

      if (args.right_kind) patch.rightKind = args.right_kind
      else if (patch.rightFund && patch.rightStock) patch.rightKind = "fund"
      else if (patch.rightFund) patch.rightKind = "fund"
      else if (patch.rightStock) patch.rightKind = "stock"

      if (args.period) patch.comparePeriod = args.period
      return {
        result: {
          ok: true,
          applied: patch,
          reason: args.reason ?? null,
        },
        dashboardPatch: Object.keys(patch).length ? patch : undefined,
      }
    }
    case "navigate_to_page": {
      const args = navigatePageArgs.parse(rawArgs)
      return {
        result: { ok: true, path: args.path, reason: args.reason ?? null },
        navigationPath: args.path,
      }
    }
    default:
      return { result: { error: `Unknown tool: ${String(name)}` } }
  }
}

const TOOL_PARAM_GUIDANCE =
  "Use a preset period: 1w, 1m, 1y, qtd, mtd, ytd, or all. For a custom calendar window (e.g. all of 2025), pass range_start and range_end as YYYY-MM-DD together (example: 2025-01-01 and 2025-12-31). Do not pass a bare year as period."

export async function executeChartAgentTool(
  name: ToolName,
  rawArgs: unknown,
): Promise<ChartAgentToolResult> {
  try {
    return await runChartAgentToolBody(name, rawArgs)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { result: { ok: false, guidance: TOOL_PARAM_GUIDANCE } }
    }
    return {
      result: {
        ok: false,
        guidance: "That request could not be completed. Try a preset period or a valid YYYY-MM-DD range.",
      },
    }
  }
}

export function mergeDashboardPatches(patches: ChartDashboardPatch[]): ChartDashboardPatch {
  return patches.reduce((acc, p) => mergePatch(acc, p), {} as ChartDashboardPatch)
}

/** OpenAI / Chat Completions function definitions */
export const CHART_AGENT_OPENAI_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_live_stocks",
      description:
        "List DSE equities with latest price, day change, volume. Use to discover tickers or compare breadth.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max rows (1–200), default 100" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_stock_snapshot",
      description: "Latest quote for one listed symbol (price, change%, volume).",
      parameters: {
        type: "object",
        properties: { symbol: { type: "string", description: "Ticker e.g. CRDB, NMB" } },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_stock_period_metrics",
      description:
        "Historical analytics for one stock: total return, volatility, max drawdown, MA trend note, volume vs average. Either pass period (same as chart buttons) OR range_start and range_end (YYYY-MM-DD) for a custom inclusive window (e.g. full calendar 2025: 2025-01-01 and 2025-12-31). Never pass a year alone as period.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          period: {
            type: "string",
            enum: ["1w", "1m", "1y", "qtd", "mtd", "ytd", "all"],
            description: "Preset window; omit when using range_start + range_end",
          },
          range_start: {
            type: "string",
            description: "Inclusive start YYYY-MM-DD; must be used with range_end",
          },
          range_end: { type: "string", description: "Inclusive end YYYY-MM-DD" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_market_indices",
      description: "DSE share indices snapshot (levels and day change).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_top_movers",
      description: "Top movers by volume / activity from the exchange feed.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_order_book_levels",
      description: "Best bid/ask and a short depth sample for one symbol.",
      parameters: {
        type: "object",
        properties: { symbol: { type: "string" } },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_chart_view",
      description:
        "Stocks home page only: change DSE chart ticker, analytics period, or line vs candlesticks. For funds or compare pages use set_fund_page_view or set_compare_page_view.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "DSE ticker to show" },
          analytics_period: {
            type: "string",
            enum: ["1w", "1m", "1y", "qtd", "mtd", "ytd", "all"],
          },
          chart_type: { type: "string", enum: ["line", "candlestick"] },
          reason: { type: "string", description: "Brief note for the user (optional)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_funds_catalog",
      description:
        "List mutual funds and ETFs available on the dashboard (id, labels, provider, currency). Use before picking fund_id.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_fund_period_metrics",
      description:
        "NAV-based analytics for one fund: total return, volatility, max drawdown, spread, highs/lows. fund_id accepts catalog id, short label, or scheme name (e.g. iGrowth). Either pass period OR range_start + range_end (YYYY-MM-DD) for a custom window (e.g. Jan–Dec 2025). Never pass a bare year as period.",
      parameters: {
        type: "object",
        properties: {
          fund_id: { type: "string", description: "Catalog id or human name; resolved server-side" },
          period: {
            type: "string",
            enum: ["1w", "1m", "1y", "qtd", "mtd", "ytd", "all"],
            description: "Preset window; omit when using range_start + range_end",
          },
          range_start: { type: "string", description: "YYYY-MM-DD inclusive; use with range_end" },
          range_end: { type: "string", description: "YYYY-MM-DD inclusive" },
        },
        required: ["fund_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_compare_pair_metrics",
      description:
        "Side-by-side analytics for stock vs stock, fund vs fund, or stock vs fund (total return spread, etc.). Either pass period OR range_start + range_end (YYYY-MM-DD) for the same calendar window on both legs.",
      parameters: {
        type: "object",
        properties: {
          left_kind: { type: "string", enum: ["stock", "fund"] },
          left_id: { type: "string", description: "Ticker if stock; fund id or name if fund (resolved)" },
          right_kind: { type: "string", enum: ["stock", "fund"] },
          right_id: { type: "string" },
          period: {
            type: "string",
            enum: ["1w", "1m", "1y", "qtd", "mtd", "ytd", "all"],
            description: "Preset window; omit when using range_start + range_end",
          },
          range_start: { type: "string", description: "YYYY-MM-DD inclusive" },
          range_end: { type: "string", description: "YYYY-MM-DD inclusive" },
        },
        required: ["left_kind", "left_id", "right_kind", "right_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_fund_page_view",
      description:
        "Funds page only: change which fund’s NAV chart is shown and/or the chart period (1W, 1M, etc.). fund_id may be catalog id or scheme short/full name.",
      parameters: {
        type: "object",
        properties: {
          fund_id: { type: "string", description: "Catalog id or resolvable fund name" },
          analytics_period: {
            type: "string",
            enum: ["1w", "1m", "1y", "qtd", "mtd", "ytd", "all"],
          },
          reason: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_compare_page_view",
      description:
        "Compare page only: switch left and/or right series on the indexed chart—DSE ticker (left_stock/right_stock) or fund (left_fund/right_fund as id or name). Optional left_kind/right_kind; if omitted, inferred from which fields you set. period updates the compare window.",
      parameters: {
        type: "object",
        properties: {
          left_kind: { type: "string", enum: ["stock", "fund"], description: "Optional; defaults from left_stock vs left_fund" },
          right_kind: { type: "string", enum: ["stock", "fund"] },
          left_stock: { type: "string", description: "DSE ticker for left side" },
          right_stock: { type: "string" },
          left_fund: { type: "string", description: "Fund id or resolvable name" },
          right_fund: { type: "string" },
          period: {
            type: "string",
            enum: ["1w", "1m", "1y", "qtd", "mtd", "ytd", "all"],
            description: "Indexed chart period",
          },
          reason: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "navigate_to_page",
      description:
        "In-app navigation only: go to DSE stocks dashboard (/), funds & NAV (/funds), or indexed compare (/compare). Use when the user asks to open or switch to another section.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", enum: ["/", "/funds", "/compare"] },
          reason: { type: "string" },
        },
        required: ["path"],
      },
    },
  },
]

export function toAnthropicToolSpecs() {
  return CHART_AGENT_OPENAI_TOOLS.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: {
      type: "object" as const,
      properties: t.function.parameters.properties ?? {},
      required: (t.function.parameters as { required?: string[] }).required ?? [],
    },
  }))
}
