"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { ApexOptions } from "apexcharts"
import { ChevronDown, GitCompareArrows, Moon, RefreshCw, Search, Sun } from "lucide-react"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { parseFlexibleDateTs } from "@/lib/date-parse"
import {
  ANALYTICS_PERIOD_OPTIONS,
  computeFundPeriodAnalytics,
  filterFundRowsByPeriod,
  type FundAnalyticsPeriod,
} from "@/lib/fund-analytics"
import { ALL_FUNDS, type FundMeta } from "@/lib/funds-catalog"
import type { ITrustFundRecord } from "@/lib/itrust-funds"
import type { HistoricalPoint } from "@/lib/market-data"
import {
  addMovingAverages,
  computeStockPeriodAnalytics,
  filterStockHistoryByPeriod,
  historyToAscending,
  type StockChartRow,
} from "@/lib/stock-analytics"
import { cn } from "@/lib/utils"

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false })

const STOCK_HISTORY_DAYS = 4000

type StockRow = {
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

type SideKind = "stock" | "fund"

type Perspective = "performance" | "snapshot" | "context"

type ApiHistoryResponse = {
  success: boolean
  data: HistoricalPoint[]
  message?: string
}

type ApiFundResponse = {
  success: boolean
  fundId: string
  meta: FundMeta | null
  data: ITrustFundRecord[]
  error?: string
}

const formatPriceTzs = (value: number) =>
  new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(value)

const formatFundMoney = (value: number, currency: "TZS" | "USD") =>
  new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 4 : 2,
  }).format(value)

const formatCompact = (value: number) => {
  if (Math.abs(value) < 100_000) return new Intl.NumberFormat("en-TZ").format(value)
  return new Intl.NumberFormat("en-TZ", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

const formatPct = (value: number | null, digits = 2) => {
  if (value == null || Number.isNaN(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(digits)}%`
}

function fundProviderLabel(meta: FundMeta): string {
  switch (meta.provider) {
    case "itrust":
      return "iTrust"
    case "utt":
      return "UTT AMIS"
    case "faida":
      return "Faida"
    case "inuka":
      return "Inuka / Orbit"
    case "vertex":
      return "Vertex"
    case "zan":
      return "ZAN Securities"
    default:
      return "Fund"
  }
}

function fundRowsAscending(rows: ITrustFundRecord[], meta: FundMeta | null): ITrustFundRecord[] {
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

function normalizedFromCloses(slice: StockChartRow[]): { x: number; y: number }[] {
  if (slice.length === 0) return []
  const base = slice[0].close
  if (!(base > 0)) return slice.map((r) => ({ x: r.dateSort, y: 100 }))
  return slice.map((r) => ({ x: r.dateSort, y: (r.close / base) * 100 }))
}

function normalizedFromNav(slice: ITrustFundRecord[]): { x: number; y: number }[] {
  if (slice.length === 0) return []
  const base = slice[0].navPerUnit
  if (!(base > 0)) return slice.map((r) => ({ x: r.dateSort, y: 100 }))
  return slice.map((r) => ({ x: r.dateSort, y: (r.navPerUnit / base) * 100 }))
}

function SidePicker({
  label,
  kind,
  onKind,
  stockSymbol,
  onStockSymbol,
  fundId,
  onFundId,
  stocks,
  stockQuery,
  onStockQuery,
  fundQuery,
  onFundQuery,
  disabled,
}: {
  label: string
  kind: SideKind
  onKind: (k: SideKind) => void
  stockSymbol: string
  onStockSymbol: (s: string) => void
  fundId: string
  onFundId: (id: string) => void
  stocks: StockRow[]
  stockQuery: string
  onStockQuery: (q: string) => void
  fundQuery: string
  onFundQuery: (q: string) => void
  disabled?: boolean
}) {
  const filteredStocks = useMemo(() => {
    const t = stockQuery.trim().toLowerCase()
    if (!t) return stocks.slice(0, 12)
    return stocks
      .filter((s) => s.symbol.toLowerCase().includes(t) || s.name.toLowerCase().includes(t))
      .slice(0, 20)
  }, [stocks, stockQuery])

  const filteredFunds = useMemo(() => {
    const t = fundQuery.trim().toLowerCase()
    if (!t) return ALL_FUNDS.slice(0, 12)
    return ALL_FUNDS.filter(
      (f) =>
        f.label.toLowerCase().includes(t) ||
        f.shortLabel.toLowerCase().includes(t) ||
        f.id.toLowerCase().includes(t),
    ).slice(0, 20)
  }, [fundQuery])

  const selectedFundMeta = ALL_FUNDS.find((f) => f.id === fundId)

  return (
    <div className="rounded-xl border border-border/80 bg-card/40 p-3 shadow-sm sm:p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mb-3 flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5">
        {(["stock", "fund"] as const).map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => onKind(k)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              kind === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "stock" ? "Stock" : "Fund / ETF"}
          </button>
        ))}
      </div>

      {kind === "stock" ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={stockQuery}
              onChange={(e) => onStockQuery(e.target.value)}
              placeholder="Search listed company…"
              className="h-9 pl-8 text-sm"
              disabled={disabled}
            />
          </div>
          <div className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-background/80">
            {filteredStocks.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No matches</p>
            ) : (
              filteredStocks.map((s) => (
                <button
                  key={s.symbol}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onStockSymbol(s.symbol)
                    onStockQuery("")
                  }}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 border-b border-border/40 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50",
                    s.symbol === stockSymbol && "bg-muted/70",
                  )}
                >
                  <span className="font-semibold">{s.symbol}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">{s.name}</span>
                </button>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Selected: <span className="font-medium text-foreground">{stockSymbol}</span>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={fundQuery}
              onChange={(e) => onFundQuery(e.target.value)}
              placeholder="Search fund…"
              className="h-9 pl-8 text-sm"
              disabled={disabled}
            />
          </div>
          <div className="max-h-40 overflow-y-auto rounded-md border border-border/60 bg-background/80">
            {filteredFunds.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No matches</p>
            ) : (
              filteredFunds.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onFundId(f.id)
                    onFundQuery("")
                  }}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 border-b border-border/40 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50",
                    f.id === fundId && "bg-muted/70",
                  )}
                >
                  <span className="font-semibold">{f.shortLabel}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">{f.label}</span>
                </button>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Selected:{" "}
            <span className="font-medium text-foreground">
              {selectedFundMeta?.shortLabel ?? fundId}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

export default function ComparePageClient() {
  const [stocks, setStocks] = useState<StockRow[]>([])
  const [stocksLoading, setStocksLoading] = useState(true)
  const [stocksError, setStocksError] = useState<string | null>(null)

  const [leftKind, setLeftKind] = useState<SideKind>("stock")
  const [rightKind, setRightKind] = useState<SideKind>("fund")
  const [leftStock, setLeftStock] = useState("CRDB")
  const [rightStock, setRightStock] = useState("NMB")
  const [leftFund, setLeftFund] = useState("iGrowth")
  const [rightFund, setRightFund] = useState("iGrowth")
  const [leftStockQ, setLeftStockQ] = useState("")
  const [rightStockQ, setRightStockQ] = useState("")
  const [leftFundQ, setLeftFundQ] = useState("")
  const [rightFundQ, setRightFundQ] = useState("")

  const [period, setPeriod] = useState<FundAnalyticsPeriod>("1y")
  const [perspective, setPerspective] = useState<Perspective>("performance")
  const [isDarkMode, setIsDarkMode] = useState(false)

  const [leftLoading, setLeftLoading] = useState(false)
  const [rightLoading, setRightLoading] = useState(false)
  const [leftError, setLeftError] = useState<string | null>(null)
  const [rightError, setRightError] = useState<string | null>(null)
  const [leftHistory, setLeftHistory] = useState<HistoricalPoint[]>([])
  const [rightHistory, setRightHistory] = useState<HistoricalPoint[]>([])
  const [leftFundRows, setLeftFundRows] = useState<ITrustFundRecord[]>([])
  const [rightFundRows, setRightFundRows] = useState<ITrustFundRecord[]>([])
  const [leftFundMeta, setLeftFundMeta] = useState<FundMeta | null>(null)
  const [rightFundMeta, setRightFundMeta] = useState<FundMeta | null>(null)

  const leftKeyRef = useRef("")
  const rightKeyRef = useRef("")

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    if (saved === "dark" || (!saved && prefersDark)) {
      setIsDarkMode(true)
      document.documentElement.classList.add("dark")
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("theme", isDarkMode ? "dark" : "light")
  }, [isDarkMode])

  const toggleDarkMode = () => {
    setIsDarkMode((d) => !d)
    document.documentElement.classList.toggle("dark")
  }

  const loadStocks = useCallback(async () => {
    setStocksLoading(true)
    setStocksError(null)
    try {
      const res = await fetch("/api/market/stocks")
      const json = await res.json()
      const rows: StockRow[] = Array.isArray(json.data) ? json.data : []
      setStocks(rows)
      if (rows.length > 0) {
        setLeftStock((s) => (rows.some((r) => r.symbol === s) ? s : rows[0].symbol))
        setRightStock((s) => (rows.some((r) => r.symbol === s) ? s : rows[0].symbol))
      }
    } catch {
      setStocksError("Could not load stock list.")
      setStocks([])
    } finally {
      setStocksLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStocks()
  }, [loadStocks])

  useEffect(() => {
    const key = `${leftKind}:${leftKind === "stock" ? leftStock : leftFund}`
    leftKeyRef.current = key
    setLeftLoading(true)
    setLeftError(null)

    const run = async () => {
      try {
        if (leftKind === "stock") {
          const sym = leftStock.trim().toUpperCase()
          if (!sym) {
            setLeftHistory([])
            setLeftLoading(false)
            return
          }
          const res = await fetch(`/api/market/history/${encodeURIComponent(sym)}?days=${STOCK_HISTORY_DAYS}`)
          const json: ApiHistoryResponse = await res.json()
          if (leftKeyRef.current !== key) return
          if (!json.success || !Array.isArray(json.data)) {
            setLeftError(json.message || "No price history for this symbol.")
            setLeftHistory([])
          } else {
            setLeftHistory(json.data)
            setLeftError(null)
          }
        } else {
          const id = leftFund
          if (!id) {
            setLeftFundRows([])
            setLeftFundMeta(null)
            setLeftLoading(false)
            return
          }
          const res = await fetch(`/api/funds/${encodeURIComponent(id)}`)
          const json: ApiFundResponse = await res.json()
          if (leftKeyRef.current !== key) return
          if (!json.meta || json.data.length === 0) {
            setLeftError(json.error || "No NAV history for this fund.")
            setLeftFundRows([])
            setLeftFundMeta(json.meta)
          } else {
            setLeftFundRows(json.data)
            setLeftFundMeta(json.meta)
            setLeftError(null)
          }
        }
      } catch {
        if (leftKeyRef.current === key) {
          setLeftError("Request failed.")
          setLeftHistory([])
          setLeftFundRows([])
        }
      } finally {
        if (leftKeyRef.current === key) setLeftLoading(false)
      }
    }
    void run()
  }, [leftKind, leftStock, leftFund])

  useEffect(() => {
    const key = `${rightKind}:${rightKind === "stock" ? rightStock : rightFund}`
    rightKeyRef.current = key
    setRightLoading(true)
    setRightError(null)

    const run = async () => {
      try {
        if (rightKind === "stock") {
          const sym = rightStock.trim().toUpperCase()
          if (!sym) {
            setRightHistory([])
            setRightLoading(false)
            return
          }
          const res = await fetch(`/api/market/history/${encodeURIComponent(sym)}?days=${STOCK_HISTORY_DAYS}`)
          const json: ApiHistoryResponse = await res.json()
          if (rightKeyRef.current !== key) return
          if (!json.success || !Array.isArray(json.data)) {
            setRightError(json.message || "No price history for this symbol.")
            setRightHistory([])
          } else {
            setRightHistory(json.data)
            setRightError(null)
          }
        } else {
          const id = rightFund
          if (!id) {
            setRightFundRows([])
            setRightFundMeta(null)
            setRightLoading(false)
            return
          }
          const res = await fetch(`/api/funds/${encodeURIComponent(id)}`)
          const json: ApiFundResponse = await res.json()
          if (rightKeyRef.current !== key) return
          if (!json.meta || json.data.length === 0) {
            setRightError(json.error || "No NAV history for this fund.")
            setRightFundRows([])
            setRightFundMeta(json.meta)
          } else {
            setRightFundRows(json.data)
            setRightFundMeta(json.meta)
            setRightError(null)
          }
        }
      } catch {
        if (rightKeyRef.current === key) {
          setRightError("Request failed.")
          setRightHistory([])
          setRightFundRows([])
        }
      } finally {
        if (rightKeyRef.current === key) setRightLoading(false)
      }
    }
    void run()
  }, [rightKind, rightStock, rightFund])

  const leftStockLive = useMemo(() => {
    if (leftKind !== "stock") return null
    return stocks.find((s) => s.symbol === leftStock) ?? null
  }, [leftKind, leftStock, stocks])

  const rightStockLive = useMemo(() => {
    if (rightKind !== "stock") return null
    return stocks.find((s) => s.symbol === rightStock) ?? null
  }, [rightKind, rightStock, stocks])

  const leftStockAnalytics = useMemo(() => {
    if (leftKind !== "stock" || leftHistory.length === 0) return null
    const asc = historyToAscending(leftHistory)
    const enriched = addMovingAverages(asc)
    return computeStockPeriodAnalytics(enriched, period)
  }, [leftKind, leftHistory, period])

  const rightStockAnalytics = useMemo(() => {
    if (rightKind !== "stock" || rightHistory.length === 0) return null
    const asc = historyToAscending(rightHistory)
    const enriched = addMovingAverages(asc)
    return computeStockPeriodAnalytics(enriched, period)
  }, [rightKind, rightHistory, period])

  const leftFundAsc = useMemo(
    () => (leftKind === "fund" ? fundRowsAscending(leftFundRows, leftFundMeta) : []),
    [leftKind, leftFundRows, leftFundMeta],
  )
  const rightFundAsc = useMemo(
    () => (rightKind === "fund" ? fundRowsAscending(rightFundRows, rightFundMeta) : []),
    [rightKind, rightFundRows, rightFundMeta],
  )

  const leftFundAnalytics = useMemo(() => {
    if (leftKind !== "fund" || leftFundAsc.length === 0) return null
    return computeFundPeriodAnalytics(leftFundAsc, period)
  }, [leftKind, leftFundAsc, period])

  const rightFundAnalytics = useMemo(() => {
    if (rightKind !== "fund" || rightFundAsc.length === 0) return null
    return computeFundPeriodAnalytics(rightFundAsc, period)
  }, [rightKind, rightFundAsc, period])

  const chartSeries = useMemo(() => {
    const series: { name: string; data: { x: number; y: number }[] }[] = []

    if (leftKind === "stock" && leftHistory.length > 0) {
      const asc = addMovingAverages(historyToAscending(leftHistory))
      const slice = filterStockHistoryByPeriod(asc, period)
      const pts = normalizedFromCloses(slice)
      if (pts.length > 0) {
        series.push({
          name: `${leftStock} (price, indexed)`,
          data: pts,
        })
      }
    } else if (leftKind === "fund" && leftFundAsc.length > 0) {
      const slice = filterFundRowsByPeriod(leftFundAsc, period)
      const pts = normalizedFromNav(slice)
      if (pts.length > 0) {
        series.push({
          name: `${leftFundMeta?.shortLabel ?? leftFund} (NAV, indexed)`,
          data: pts,
        })
      }
    }

    if (rightKind === "stock" && rightHistory.length > 0) {
      const asc = addMovingAverages(historyToAscending(rightHistory))
      const slice = filterStockHistoryByPeriod(asc, period)
      const pts = normalizedFromCloses(slice)
      if (pts.length > 0) {
        series.push({
          name: `${rightStock} (price, indexed)`,
          data: pts,
        })
      }
    } else if (rightKind === "fund" && rightFundAsc.length > 0) {
      const slice = filterFundRowsByPeriod(rightFundAsc, period)
      const pts = normalizedFromNav(slice)
      if (pts.length > 0) {
        series.push({
          name: `${rightFundMeta?.shortLabel ?? rightFund} (NAV, indexed)`,
          data: pts,
        })
      }
    }

    return series
  }, [
    leftKind,
    rightKind,
    leftHistory,
    rightHistory,
    leftFundAsc,
    rightFundAsc,
    leftStock,
    rightStock,
    leftFund,
    rightFund,
    leftFundMeta,
    rightFundMeta,
    period,
  ])

  const apexOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: "compare-indexed",
        type: "line",
        background: "transparent",
        toolbar: { tools: { download: false } },
        zoom: { enabled: true },
        animations: { enabled: false },
      },
      stroke: { curve: "smooth", width: 2.5 },
      colors: [isDarkMode ? "#34d399" : "#059669", isDarkMode ? "#60a5fa" : "#2563eb"],
      grid: { borderColor: isDarkMode ? "rgba(148,163,184,0.15)" : "rgba(15,23,42,0.08)" },
      xaxis: { type: "datetime", labels: { datetimeUTC: false } },
      yaxis: {
        title: { text: "Indexed (start = 100)" },
        labels: { formatter: (v) => Number(v).toFixed(1) },
      },
      legend: { position: "top", horizontalAlign: "left", fontSize: "12px" },
      tooltip: {
        x: { format: "dd MMM yyyy" },
        y: { formatter: (v) => `${Number(v).toFixed(2)}` },
      },
      theme: { mode: isDarkMode ? "dark" : "light" },
    }),
    [isDarkMode],
  )

  const leftTitle =
    leftKind === "stock" ? leftStock : (leftFundMeta?.shortLabel ?? leftFund)
  const rightTitle =
    rightKind === "stock" ? rightStock : (rightFundMeta?.shortLabel ?? rightFund)

  const busy = stocksLoading || leftLoading || rightLoading

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader
        title="Uwekezaji Online"
        subtitle="Compare stocks and funds side by side"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => loadStocks()}
          disabled={stocksLoading}
          aria-label="Refresh market list"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", stocksLoading && "animate-spin")} />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={toggleDarkMode}
          aria-label={isDarkMode ? "Light mode" : "Dark mode"}
        >
          {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>
      </SiteHeader>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 lg:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GitCompareArrows className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Compare</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Put any two instruments next to each other: listed DSE stocks or mutual funds/ETFs from the catalog.
                Metrics use the same date window as elsewhere on the site; the chart rebases each series to 100 at the
                start of the selected period so different price levels are comparable.
              </p>
            </div>
          </div>
        </div>

        <details className="group mb-6 rounded-xl border border-border/80 bg-muted/20 shadow-sm open:bg-muted/30">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground outline-offset-2 marker:hidden [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden
            />
            Methodology
          </summary>
          <div className="space-y-3 border-t border-border/60 px-4 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Each side is calculated on its own: we do not blend two instruments into one model. For a period such as
              &quot;1 year&quot;, the window is counted backward from that instrument&apos;s{" "}
              <strong className="font-medium text-foreground">latest available date</strong> (last session for a stock,
              last published NAV for a fund). If those dates differ, the calendar span is not identical on both sides.
            </p>
            <p>
              <strong className="font-medium text-foreground">Indexed chart:</strong> within the period you pick, the
              first point is set to 100. Stocks use daily <strong className="font-medium text-foreground">closing
              prices</strong>; funds use <strong className="font-medium text-foreground">NAV per unit</strong>. The
              lines show relative change from the start of that window, not raw price levels. Dates on each line follow
              that instrument&apos;s own series.
            </p>
            <p>
              <strong className="font-medium text-foreground">Performance table:</strong>{" "}
              <em className="not-italic">Total return</em> is the percentage change from the first to the last
              observation in the window. <em className="not-italic">Annualized return</em> spreads that same total
              return over the length of the window in years (a simple average pace, not compound &quot;CAGR&quot;).{" "}
              <em className="not-italic">Volatility</em> summarizes how much day-to-day percentage moves varied, then
              scales that to a rough yearly figure using about 252 trading days. <em className="not-italic">Max
              drawdown</em> is the largest peak-to-trough drop over the window. <em className="not-italic">Best /
              worst day</em> are the largest single-day up and down moves in that window.
            </p>
            <p>
              <strong className="font-medium text-foreground">Stocks vs funds:</strong> metrics use the same ideas, but
              stocks and unit trusts/ETFs are different products (liquidity, fees, risk). These numbers are descriptive
              only and are not investment advice.
            </p>
          </div>
        </details>

        {stocksError ? (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {stocksError}
          </p>
        ) : null}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-xs font-medium text-muted-foreground">Period</span>
          <div className="flex flex-wrap gap-1">
            {ANALYTICS_PERIOD_OPTIONS.map((o) => (
              <Button
                key={o.id}
                type="button"
                size="sm"
                variant={period === o.id ? "default" : "outline"}
                className="h-8 min-w-[2.5rem] px-2 text-xs"
                onClick={() => setPeriod(o.id)}
              >
                {o.short}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <SidePicker
            label="Instrument A"
            kind={leftKind}
            onKind={setLeftKind}
            stockSymbol={leftStock}
            onStockSymbol={setLeftStock}
            fundId={leftFund}
            onFundId={setLeftFund}
            stocks={stocks}
            stockQuery={leftStockQ}
            onStockQuery={setLeftStockQ}
            fundQuery={leftFundQ}
            onFundQuery={setLeftFundQ}
            disabled={stocksLoading && stocks.length === 0}
          />
          <SidePicker
            label="Instrument B"
            kind={rightKind}
            onKind={setRightKind}
            stockSymbol={rightStock}
            onStockSymbol={setRightStock}
            fundId={rightFund}
            onFundId={setRightFund}
            stocks={stocks}
            stockQuery={rightStockQ}
            onStockQuery={setRightStockQ}
            fundQuery={rightFundQ}
            onFundQuery={setRightFundQ}
            disabled={stocksLoading && stocks.length === 0}
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-1 border-b border-border/60 pb-3">
          {(
            [
              ["performance", "Performance"],
              ["snapshot", "Snapshot"],
              ["context", "Context"],
            ] as const
          ).map(([id, lab]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={perspective === id ? "secondary" : "ghost"}
              className="h-8 text-xs"
              onClick={() => setPerspective(id)}
            >
              {lab}
            </Button>
          ))}
        </div>

        {(leftError || rightError) && (
          <div className="mb-4 space-y-1 text-sm">
            {leftError ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-800 dark:text-amber-200">
                A: {leftError}
              </p>
            ) : null}
            {rightError ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-800 dark:text-amber-200">
                B: {rightError}
              </p>
            ) : null}
          </div>
        )}

        <section className="mb-8 rounded-xl border border-border/80 bg-card/30 p-4 shadow-sm">
          <h2 className="mb-1 font-semibold">Indexed performance ({period.toUpperCase()})</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Each line starts at 100 on the first date in the window. Stocks use closing prices; funds use NAV per unit.
          </p>
          {busy && chartSeries.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading series…</div>
          ) : chartSeries.length < 2 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Select two instruments with history to see the chart.
            </div>
          ) : (
            <div className="min-h-[280px] w-full">
              <ReactApexChart options={apexOptions} series={chartSeries} type="line" height={320} />
            </div>
          )}
        </section>

        {perspective === "performance" && (
          <section className="mb-8 overflow-x-auto rounded-xl border border-border/80 bg-card/30 shadow-sm">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-3 py-2.5 font-semibold">Metric</th>
                  <th className="px-3 py-2.5 font-semibold">{leftTitle}</th>
                  <th className="px-3 py-2.5 font-semibold">{rightTitle}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <MetricRow
                  label="Total return"
                  a={leftKind === "stock" ? leftStockAnalytics?.totalReturnPct : leftFundAnalytics?.totalReturnPct}
                  b={rightKind === "stock" ? rightStockAnalytics?.totalReturnPct : rightFundAnalytics?.totalReturnPct}
                />
                <MetricRow
                  label="Annualized return (simple)"
                  a={
                    leftKind === "stock"
                      ? leftStockAnalytics?.annualizedReturnPct
                      : leftFundAnalytics?.annualizedReturnPct
                  }
                  b={
                    rightKind === "stock"
                      ? rightStockAnalytics?.annualizedReturnPct
                      : rightFundAnalytics?.annualizedReturnPct
                  }
                />
                <MetricRow
                  label="Volatility (ann., sample)"
                  a={
                    leftKind === "stock"
                      ? leftStockAnalytics?.volatilityAnnualizedPct
                      : leftFundAnalytics?.volatilityAnnualizedPct
                  }
                  b={
                    rightKind === "stock"
                      ? rightStockAnalytics?.volatilityAnnualizedPct
                      : rightFundAnalytics?.volatilityAnnualizedPct
                  }
                />
                <MetricRow
                  label="Max drawdown"
                  a={leftKind === "stock" ? leftStockAnalytics?.maxDrawdownPct : leftFundAnalytics?.maxDrawdownPct}
                  b={rightKind === "stock" ? rightStockAnalytics?.maxDrawdownPct : rightFundAnalytics?.maxDrawdownPct}
                />
                <MetricRow
                  label="Best day"
                  a={leftKind === "stock" ? leftStockAnalytics?.bestDayPct : leftFundAnalytics?.bestDayPct}
                  b={rightKind === "stock" ? rightStockAnalytics?.bestDayPct : rightFundAnalytics?.bestDayPct}
                />
                <MetricRow
                  label="Worst day"
                  a={leftKind === "stock" ? leftStockAnalytics?.worstDayPct : leftFundAnalytics?.worstDayPct}
                  b={rightKind === "stock" ? rightStockAnalytics?.worstDayPct : rightFundAnalytics?.worstDayPct}
                />
                <tr className="bg-muted/20">
                  <td className="px-3 py-2 text-muted-foreground" colSpan={3}>
                    Observations in window:{" "}
                    <strong className="text-foreground">
                      {leftKind === "stock"
                        ? (leftStockAnalytics?.observations ?? "—")
                        : (leftFundAnalytics?.observations ?? "—")}
                    </strong>{" "}
                    vs{" "}
                    <strong className="text-foreground">
                      {rightKind === "stock"
                        ? (rightStockAnalytics?.observations ?? "—")
                        : (rightFundAnalytics?.observations ?? "—")}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {perspective === "snapshot" && (
          <section className="mb-8 overflow-x-auto rounded-xl border border-border/80 bg-card/30 shadow-sm">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-3 py-2.5 font-semibold">Field</th>
                  <th className="px-3 py-2.5 font-semibold">{leftTitle}</th>
                  <th className="px-3 py-2.5 font-semibold">{rightTitle}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Type</td>
                  <td className="px-3 py-2">{leftKind === "stock" ? "Listed stock (DSE)" : "Fund / ETF"}</td>
                  <td className="px-3 py-2">{rightKind === "stock" ? "Listed stock (DSE)" : "Fund / ETF"}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Latest level</td>
                  <td className="px-3 py-2">
                    {leftKind === "stock"
                      ? leftStockLive
                        ? formatPriceTzs(leftStockLive.price)
                        : "—"
                      : leftFundAsc.length > 0 && leftFundMeta
                        ? formatFundMoney(
                            leftFundAsc[leftFundAsc.length - 1].navPerUnit,
                            leftFundMeta.currency,
                          )
                        : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {rightKind === "stock"
                      ? rightStockLive
                        ? formatPriceTzs(rightStockLive.price)
                        : "—"
                      : rightFundAsc.length > 0 && rightFundMeta
                        ? formatFundMoney(
                            rightFundAsc[rightFundAsc.length - 1].navPerUnit,
                            rightFundMeta.currency,
                          )
                        : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Session / latest change</td>
                  <td className="px-3 py-2">
                    {leftKind === "stock"
                      ? leftStockLive
                        ? formatPct(leftStockLive.changePercent)
                        : "—"
                      : leftFundAnalytics?.totalReturnPct != null
                        ? `Window: ${formatPct(leftFundAnalytics.totalReturnPct)}`
                        : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {rightKind === "stock"
                      ? rightStockLive
                        ? formatPct(rightStockLive.changePercent)
                        : "—"
                      : rightFundAnalytics?.totalReturnPct != null
                        ? `Window: ${formatPct(rightFundAnalytics.totalReturnPct)}`
                        : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Market cap (live)</td>
                  <td className="px-3 py-2">
                    {leftKind === "stock" && leftStockLive?.marketCap != null
                      ? formatCompact(leftStockLive.marketCap)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {rightKind === "stock" && rightStockLive?.marketCap != null
                      ? formatCompact(rightStockLive.marketCap)
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Spread vs NAV (funds)</td>
                  <td className="px-3 py-2">
                    {leftKind === "fund" ? formatPct(leftFundAnalytics?.latestSpreadPct) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {rightKind === "fund" ? formatPct(rightFundAnalytics?.latestSpreadPct) : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Bid / ask (live)</td>
                  <td className="px-3 py-2">
                    {leftKind === "stock" && leftStockLive?.bestBidPrice != null && leftStockLive?.bestOfferPrice != null
                      ? `${formatPriceTzs(leftStockLive.bestBidPrice)} / ${formatPriceTzs(leftStockLive.bestOfferPrice)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {rightKind === "stock" &&
                    rightStockLive?.bestBidPrice != null &&
                    rightStockLive?.bestOfferPrice != null
                      ? `${formatPriceTzs(rightStockLive.bestBidPrice)} / ${formatPriceTzs(rightStockLive.bestOfferPrice)}`
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {perspective === "context" && (
          <section className="mb-8 overflow-x-auto rounded-xl border border-border/80 bg-card/30 shadow-sm">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-3 py-2.5 font-semibold">Detail</th>
                  <th className="px-3 py-2.5 font-semibold">{leftTitle}</th>
                  <th className="px-3 py-2.5 font-semibold">{rightTitle}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Name</td>
                  <td className="px-3 py-2">
                    {leftKind === "stock"
                      ? (leftStockLive?.name ?? leftStock)
                      : (leftFundMeta?.label ?? leftFund)}
                  </td>
                  <td className="px-3 py-2">
                    {rightKind === "stock"
                      ? (rightStockLive?.name ?? rightStock)
                      : (rightFundMeta?.label ?? rightFund)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Provider / venue</td>
                  <td className="px-3 py-2">
                    {leftKind === "stock"
                      ? "Dar es Salaam Stock Exchange"
                      : leftFundMeta
                        ? fundProviderLabel(leftFundMeta)
                        : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {rightKind === "stock"
                      ? "Dar es Salaam Stock Exchange"
                      : rightFundMeta
                        ? fundProviderLabel(rightFundMeta)
                        : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Category</td>
                  <td className="px-3 py-2">{leftKind === "stock" ? "Equity (listed)" : (leftFundMeta?.category ?? "—")}</td>
                  <td className="px-3 py-2">
                    {rightKind === "stock" ? "Equity (listed)" : (rightFundMeta?.category ?? "—")}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Currency</td>
                  <td className="px-3 py-2">{leftKind === "stock" ? "TZS (price)" : (leftFundMeta?.currency ?? "—")}</td>
                  <td className="px-3 py-2">{rightKind === "stock" ? "TZS (price)" : (rightFundMeta?.currency ?? "—")}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Volume (avg in window)</td>
                  <td className="px-3 py-2">
                    {leftKind === "stock" && leftStockAnalytics?.avgVolume != null
                      ? formatCompact(leftStockAnalytics.avgVolume)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {rightKind === "stock" && rightStockAnalytics?.avgVolume != null
                      ? formatCompact(rightStockAnalytics.avgVolume)
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">Volume vs average</td>
                  <td className="px-3 py-2">
                    {leftKind === "stock" ? formatPct(leftStockAnalytics?.volumeVsAvgPct) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {rightKind === "stock" ? formatPct(rightStockAnalytics?.volumeVsAvgPct) : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 align-top text-muted-foreground">Trend (moving averages)</td>
                  <td className="px-3 py-2 align-top text-xs leading-relaxed">
                    {leftKind === "stock" ? leftStockAnalytics?.maTrendNote ?? "—" : "Funds use NAV series; MA trend is not shown here."}
                  </td>
                  <td className="px-3 py-2 align-top text-xs leading-relaxed">
                    {rightKind === "stock" ? rightStockAnalytics?.maTrendNote ?? "—" : "Funds use NAV series; MA trend is not shown here."}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        <p className="mb-8 text-xs leading-relaxed text-muted-foreground">
          Analytics are descriptive, not advice. Stock metrics use DSE history (~{STOCK_HISTORY_DAYS} days max); fund NAV
          comes from each provider&apos;s published series. Cross-type comparisons mix different instruments and
          liquidity rules—use them as a starting point for your own research.
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}

function MetricRow({
  label,
  a,
  b,
}: {
  label: string
  a: number | null | undefined
  b: number | null | undefined
}) {
  return (
    <tr>
      <td className="px-3 py-2 text-muted-foreground">{label}</td>
      <td className="px-3 py-2 font-medium tabular-nums">{formatPct(a ?? null)}</td>
      <td className="px-3 py-2 font-medium tabular-nums">{formatPct(b ?? null)}</td>
    </tr>
  )
}
