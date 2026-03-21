"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { ANALYTICS_PERIOD_OPTIONS, type FundAnalyticsPeriod } from "@/lib/fund-analytics"
import { addMovingAverages, computeStockPeriodAnalytics, historyToAscending } from "@/lib/stock-analytics"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  LineChart,
  List,
  Moon,
  RefreshCw,
  Search,
  Sun,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type StockData = {
  id: string
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap?: number
}

type HistoryPoint = {
  date: string
  close: number
  volume: number
}

type ShareIndexPoint = {
  indexDescription: string
  closingPrice: number
  change: number
  code: string
}

type LiveMoverPoint = {
  company: string
  price: number
  volume: number
}

type StockOrder = {
  buyPrice: number
  buyQuantity: number
  sellPrice: number
  sellQuantity: number
}

type OrderBook = {
  bestSellPrice: number
  bestBuyPrice: number
  orders: StockOrder[]
}

type ChartTooltipProps = {
  active?: boolean
  payload?: Array<{ payload: HistoryPoint }>
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(value)

const formatCompact = (value: number) => {
  if (Math.abs(value) < 100000) return new Intl.NumberFormat("en-TZ").format(value)
  return new Intl.NumberFormat("en-TZ", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

const formatCount = (value: number) => new Intl.NumberFormat("en-TZ").format(value)

/** Max days the history API allows — analytics use this so metrics aren’t limited by chart range. */
const STOCK_ANALYTICS_MAX_DAYS = 5000

const HistoryTooltip = ({ active, payload }: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{point.date}</p>
      <p className="text-muted-foreground">Close: {formatPrice(point.close)}</p>
    </div>
  )
}

const formatPctAnalytics = (value: number | null, digits = 2) => {
  if (value == null || Number.isNaN(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(digits)}%`
}

export default function HomePage() {
  const [stocks, setStocks] = useState<StockData[]>([])
  const [history, setHistory] = useState<HistoryPoint[]>([])
  /** Full history for analytics (independent of chart `days`). */
  const [analyticsHistory, setAnalyticsHistory] = useState<HistoryPoint[]>([])
  const [topMovers, setTopMovers] = useState<LiveMoverPoint[]>([])
  const [indices, setIndices] = useState<ShareIndexPoint[]>([])
  const [search, setSearch] = useState("")
  const [selectedSymbol, setSelectedSymbol] = useState("CRDB")
  const [days, setDays] = useState(90)
  const [stockPeriod, setStockPeriod] = useState<FundAnalyticsPeriod>("1m")
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [analyticsHistoryLoading, setAnalyticsHistoryLoading] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeStock, setActiveStock] = useState<StockData | null>(null)
  const [activeOrderBook, setActiveOrderBook] = useState<OrderBook | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [selectedOrderBook, setSelectedOrderBook] = useState<OrderBook | null>(null)
  const [selectedOrderBookLoading, setSelectedOrderBookLoading] = useState(false)
  const [openMarketCard, setOpenMarketCard] = useState<"movers" | "gainers" | "losers">("movers")
  const [isStocksSidebarOpen, setIsStocksSidebarOpen] = useState(false)
  const [sortKey, setSortKey] = useState<"symbol" | "price" | "change" | "volume">("volume")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const stockAnalyticsSectionRef = useRef<HTMLElement | null>(null)

  const selectedStock = stocks.find((s) => s.symbol === selectedSymbol) ?? null
  const totalVolume = stocks.reduce((sum, s) => sum + s.volume, 0)
  const gainers = stocks.filter((s) => s.change > 0)
  const losers = stocks.filter((s) => s.change < 0)

  const visibleStocks = useMemo(() => {
    const filtered = stocks.filter(
      (s) =>
        s.symbol.toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase())
    )
    return filtered.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === "string" && typeof bVal === "string")
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal)
    })
  }, [stocks, search, sortKey, sortDir])

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const sortIcon = (key: typeof sortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""

  /** Pick a stock from the full “All securities” list and bring analytics into view. */
  const selectStockFromAllSecuritiesList = (symbol: string) => {
    const fromMobileDrawer = isStocksSidebarOpen
    setSelectedSymbol(symbol)
    setIsStocksSidebarOpen(false)
    const scrollToAnalytics = () =>
      stockAnalyticsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    if (fromMobileDrawer) {
      window.setTimeout(scrollToAnalytics, 220)
    } else {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(scrollToAnalytics)
      })
    }
  }

  /** Prefer long history for metrics; if the API returns nothing (e.g. huge `days`), use chart `history`. */
  const historyForStockAnalytics = useMemo(() => {
    if (analyticsHistory.length > 0) return analyticsHistory
    return history
  }, [analyticsHistory, history])

  const analyticsHistoryAscending = useMemo(
    () => historyToAscending(historyForStockAnalytics),
    [historyForStockAnalytics],
  )
  const analyticsHistoryEnriched = useMemo(
    () => addMovingAverages(analyticsHistoryAscending),
    [analyticsHistoryAscending],
  )
  const stockAnalytics = useMemo(
    () => computeStockPeriodAnalytics(analyticsHistoryEnriched, stockPeriod),
    [analyticsHistoryEnriched, stockPeriod],
  )

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev)
    document.documentElement.classList.toggle("dark")
  }

  const fetchStocks = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/market/stocks")
      const payload = await res.json()
      const rows: StockData[] = Array.isArray(payload?.data) ? payload.data : []
      setStocks(rows)
      if (rows.length > 0 && !rows.find((r) => r.symbol === selectedSymbol)) setSelectedSymbol(rows[0].symbol)
      setLastUpdated(new Date())
    } catch {
      setError("Unable to fetch market data.")
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async (symbol: string, rangeDays: number) => {
    try {
      setHistoryLoading(true)
      const res = await fetch(`/api/market/history/${encodeURIComponent(symbol)}?days=${rangeDays}`)
      const payload = await res.json()
      setHistory(Array.isArray(payload?.data) ? payload.data : [])
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const fetchTopMovers = async () => {
    try {
      const res = await fetch("/api/market/top-movers")
      const payload = await res.json()
      setTopMovers(Array.isArray(payload?.data) ? payload.data : [])
    } catch { /* silent */ }
  }

  const fetchIndices = async () => {
    try {
      const res = await fetch("/api/market/indices")
      const payload = await res.json()
      setIndices(Array.isArray(payload?.data) ? payload.data : [])
    } catch { /* silent */ }
  }

  const fetchSelectedOrderBook = async (stockId: string) => {
    try {
      setSelectedOrderBookLoading(true)
      const res = await fetch(`/api/market/orders/${encodeURIComponent(stockId)}`)
      const payload = await res.json()
      setSelectedOrderBook({
        bestSellPrice: Number(payload?.bestSellPrice) || 0,
        bestBuyPrice: Number(payload?.bestBuyPrice) || 0,
        orders: Array.isArray(payload?.orders) ? payload.orders : [],
      })
    } catch {
      setSelectedOrderBook({ bestSellPrice: 0, bestBuyPrice: 0, orders: [] })
    } finally {
      setSelectedOrderBookLoading(false)
    }
  }

  const openStockModal = async (stock: StockData) => {
    setActiveStock(stock)
    setModalLoading(true)
    try {
      const res = await fetch(`/api/market/orders/${encodeURIComponent(stock.id)}`)
      const payload = await res.json()
      setActiveOrderBook({
        bestSellPrice: Number(payload?.bestSellPrice) || 0,
        bestBuyPrice: Number(payload?.bestBuyPrice) || 0,
        orders: Array.isArray(payload?.orders) ? payload.orders : [],
      })
    } catch {
      setActiveOrderBook({ bestSellPrice: 0, bestBuyPrice: 0, orders: [] })
    } finally {
      setModalLoading(false)
    }
  }

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null
    const prefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    if (saved === "dark" || (!saved && prefersDark)) {
      setIsDarkMode(true)
      document.documentElement.classList.add("dark")
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("theme", isDarkMode ? "dark" : "light")
  }, [isDarkMode])

  useEffect(() => {
    fetchStocks()
    fetchTopMovers()
    fetchIndices()
    const isMarketHours = () => {
      const h = new Date().getHours()
      return h >= 10 && h < 18
    }
    const interval = setInterval(() => {
      if (isMarketHours()) { fetchStocks(); fetchTopMovers(); fetchIndices() }
    }, 300000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedSymbol) void fetchHistory(selectedSymbol, days)
  }, [selectedSymbol, days])

  useEffect(() => {
    if (!selectedSymbol) return
    let cancelled = false
    setAnalyticsHistoryLoading(true)
    ;(async () => {
      try {
        const res = await fetch(
          `/api/market/history/${encodeURIComponent(selectedSymbol)}?days=${STOCK_ANALYTICS_MAX_DAYS}`,
        )
        const payload = await res.json()
        if (!cancelled) setAnalyticsHistory(Array.isArray(payload?.data) ? payload.data : [])
      } catch {
        if (!cancelled) setAnalyticsHistory([])
      } finally {
        if (!cancelled) setAnalyticsHistoryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedSymbol])

  useEffect(() => {
    if (selectedStock?.id) fetchSelectedOrderBook(selectedStock.id)
  }, [selectedStock?.id])

  return (
    <div className="min-h-screen bg-background font-sans">
      <SiteHeader
        icon={BarChart3}
        title="DSE Market"
        subtitle="Dar es Salaam Stock Exchange"
      >
        {lastUpdated && (
          <span className="hidden text-[10px] text-muted-foreground xl:block">{lastUpdated.toLocaleTimeString()}</span>
        )}
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={toggleDarkMode}>
          {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchStocks} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </SiteHeader>

      {/* ── Main ── */}
      <main className="mx-auto max-w-[1600px] px-4 py-4 lg:px-6 lg:py-5">
        {/* Indices row below navbar */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {indices.map((idx) => (
            <button
              key={idx.code}
              type="button"
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[10px] shadow-sm transition-colors hover:shadow-md"
            >
              <span className="font-semibold">{idx.code}</span>
              <span className="tabular-nums">{formatCount(idx.closingPrice)}</span>
              <span className={`tabular-nums font-medium ${idx.change >= 0 ? "text-chart-3" : "text-chart-5"}`}>
                {idx.change >= 0 ? "+" : ""}
                {idx.change.toFixed(2)}
              </span>
            </button>
          ))}
        </div>

        {/* ── Body Grid: Left (chart + movers) | Right (securities) ── */}
        <div className="grid gap-4 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px]">

          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-4 lg:h-[650px]">

            {/* Chart */}
            <section className="flex h-[280px] min-h-0 flex-col rounded-xl bg-card shadow-md lg:h-auto lg:flex-1">
              {/* Two rows on &lt;lg so the list icon stays flush right; one row on lg+ (icon hidden) */}
              <div className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex w-full min-w-0 items-start justify-between gap-3 lg:min-w-0 lg:flex-1 lg:items-center">
                  <div className="min-w-0 flex-1">
                    {selectedStock ? (
                      <p className="text-sm font-semibold">
                        {selectedStock.symbol} {formatPrice(selectedStock.price)}{" "}
                        <span className={selectedStock.change >= 0 ? "text-chart-3" : "text-chart-5"}>
                          ({selectedStock.change >= 0 ? "+" : ""}
                          {selectedStock.changePercent.toFixed(2)}%)
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm font-semibold">—</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{selectedStock?.name ?? "Select a stock below"}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg border-border/80 bg-muted/30 lg:hidden"
                    onClick={() => setIsStocksSidebarOpen(true)}
                    aria-label="Browse all securities"
                    title="All securities"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 sm:justify-end lg:justify-end lg:shrink-0">
                  {[30, 90, 180, 365].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        days === d
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {d}D
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[220px] p-3 lg:h-auto lg:min-h-0 lg:flex-1">
                {historyLoading ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading chart...</div>
                ) : history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} dy={6} />
                      <YAxis
                        tick={{ fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatCompact(Number(v))}
                        dx={-4}
                        width={48}
                      />
                      <Tooltip content={<HistoryTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="close"
                        stroke={isDarkMode ? "#10b981" : "#059669"}
                        fill="url(#chartGrad)"
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={true}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No historical data available
                  </div>
                )}
              </div>
            </section>

            {/* Order book + collapsible market cards */}
            <div className="grid gap-4 lg:h-[370px] lg:grid-cols-[1fr_300px]">
              <section className="flex min-h-0 flex-col rounded-xl bg-card shadow-md lg:h-full lg:overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <p className="text-xs font-semibold">Order Book</p>
                  <span className="text-[10px] text-muted-foreground">{selectedStock?.symbol ?? "—"}</span>
                </div>
                <div className="space-y-3 p-3 lg:flex-1 lg:min-h-0 lg:overflow-auto lg:[scrollbar-width:none] lg:[-ms-overflow-style:none] lg:[&::-webkit-scrollbar]:hidden">
                  <div className="rounded-lg bg-muted/40 p-3 shadow-sm">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md bg-chart-3/10 p-2 shadow-sm">
                        <p className="text-[10px] text-muted-foreground">Best Buy Price</p>
                        <p className="text-xs font-semibold tabular-nums text-chart-3">
                          {formatCompact(selectedOrderBook?.bestBuyPrice || 0)}
                        </p>
                      </div>
                      <div className="rounded-md bg-chart-5/10 p-2 shadow-sm">
                        <p className="text-[10px] text-muted-foreground">Best Sell Price</p>
                        <p className="text-xs font-semibold tabular-nums text-chart-5">
                          {formatCompact(selectedOrderBook?.bestSellPrice || 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-chart-3/10 p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-chart-3">Buy</span>
                      <span className="text-[10px] text-muted-foreground">
                        Best: {formatCompact(selectedOrderBook?.bestBuyPrice || 0)}
                      </span>
                    </div>
                    {selectedOrderBookLoading ? (
                      <p className="text-[10px] text-muted-foreground">Loading...</p>
                    ) : (
                      <div className="max-h-48 divide-y divide-border overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {(selectedOrderBook?.orders ?? []).filter((o) => o.buyQuantity > 0).map((order, idx) => (
                          <div key={`selected-buy-${idx}`} className="flex justify-between py-1 text-[11px]">
                            <span className="tabular-nums">{formatCompact(order.buyPrice)}</span>
                            <span className="tabular-nums text-muted-foreground">{formatCount(order.buyQuantity)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg bg-chart-5/10 p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-chart-5">Sell</span>
                      <span className="text-[10px] text-muted-foreground">
                        Best: {formatCompact(selectedOrderBook?.bestSellPrice || 0)}
                      </span>
                    </div>
                    {selectedOrderBookLoading ? (
                      <p className="text-[10px] text-muted-foreground">Loading...</p>
                    ) : (
                      <div className="max-h-48 divide-y divide-border overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {(selectedOrderBook?.orders ?? []).filter((o) => o.sellQuantity > 0).map((order, idx) => (
                          <div key={`selected-sell-${idx}`} className="flex justify-between py-1 text-[11px]">
                            <span className="tabular-nums">{formatCompact(order.sellPrice)}</span>
                            <span className="tabular-nums text-muted-foreground">{formatCount(order.sellQuantity)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              </section>

              <section className="space-y-2 lg:h-full lg:min-h-0 lg:overflow-auto lg:[scrollbar-width:none] lg:[-ms-overflow-style:none] lg:[&::-webkit-scrollbar]:hidden">
                <div className="rounded-xl bg-card shadow-md">
                  <button
                    type="button"
                    onClick={() => setOpenMarketCard("movers")}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold"
                  >
                    <TrendingUp className="h-3.5 w-3.5 text-chart-3" />
                    Top Movers
                  </button>
                  {openMarketCard === "movers" && (
                    <div className="divide-y divide-border border-t border-border">
                      {topMovers.slice(0, 5).map((m) => (
                        <div key={m.company} className="flex items-center justify-between px-4 py-2">
                          <div>
                            <p className="text-xs font-medium">{m.company}</p>
                            <p className="text-[10px] text-muted-foreground">Vol: {formatCompact(m.volume)}</p>
                          </div>
                          <p className="text-xs font-semibold tabular-nums">{formatCompact(m.price)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-card shadow-md">
                  <button
                    type="button"
                    onClick={() => setOpenMarketCard("gainers")}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold"
                  >
                    <TrendingUp className="h-3.5 w-3.5 text-chart-3" />
                    Top Gainers
                  </button>
                  {openMarketCard === "gainers" && (
                    <div className="divide-y divide-border border-t border-border">
                      {gainers.sort((a, b) => b.changePercent - a.changePercent).slice(0, 5).map((s) => (
                        <div key={s.id} className="flex cursor-pointer items-center justify-between px-4 py-2 hover:bg-muted/40" onClick={() => { setSelectedSymbol(s.symbol); openStockModal(s) }}>
                          <div>
                            <p className="text-xs font-medium">{s.symbol}</p>
                            <p className="text-[10px] text-muted-foreground">{s.name}</p>
                          </div>
                          <span className="text-[10px] font-medium text-chart-3">{Math.abs(s.change).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-card shadow-md">
                  <button
                    type="button"
                    onClick={() => setOpenMarketCard("losers")}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold"
                  >
                    <TrendingDown className="h-3.5 w-3.5 text-chart-5" />
                    Top Losers
                  </button>
                  {openMarketCard === "losers" && (
                    <div className="divide-y divide-border border-t border-border">
                      {losers.sort((a, b) => a.changePercent - b.changePercent).slice(0, 5).map((s) => (
                        <div key={s.id} className="flex cursor-pointer items-center justify-between px-4 py-2 hover:bg-muted/40" onClick={() => { setSelectedSymbol(s.symbol); openStockModal(s) }}>
                          <div>
                            <p className="text-xs font-medium">{s.symbol}</p>
                            <p className="text-[10px] text-muted-foreground">{s.name}</p>
                          </div>
                          <span className="text-[10px] font-medium text-chart-5">{Math.abs(s.change).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-muted/30 p-3 text-[10px] leading-relaxed text-muted-foreground shadow-sm">
                  Data is attributed to{" "}
                  <a
                    href="https://dse.co.tz/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Dar es Salaam Stock Exchange (DSE)
                  </a>
                  . Values are indicative; confirm with the exchange or your broker before trading.
                </div>
              </section>
            </div>
          </div>

          {/* RIGHT COLUMN — All Securities */}
          <section className="hidden flex-col rounded-xl bg-card shadow-md lg:flex lg:h-[650px]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold">All Securities</p>
                <p className="text-[10px] text-muted-foreground">{visibleStocks.length} / {stocks.length} listed</p>
              </div>
              <div className="relative w-36">
                <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 pl-7 text-[11px]"
                />
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
                  <tr className="border-b border-border text-left">
                    <th
                      className="cursor-pointer px-3 py-2 font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort("symbol")}
                    >
                      Symbol{sortIcon("symbol")}
                    </th>
                    <th
                      className="cursor-pointer px-3 py-2 text-right font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort("price")}
                    >
                      Price{sortIcon("price")}
                    </th>
                    <th
                      className="cursor-pointer px-3 py-2 text-right font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort("change")}
                    >
                      Chg{sortIcon("change")}
                    </th>
                    <th
                      className="cursor-pointer px-3 py-2 text-right font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort("volume")}
                    >
                      Vol{sortIcon("volume")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading && stocks.length === 0 ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-3 py-2.5" colSpan={4}>
                          <div className="h-3 animate-pulse rounded bg-muted" />
                        </td>
                      </tr>
                    ))
                  ) : visibleStocks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        No stocks found
                      </td>
                    </tr>
                  ) : (
                    visibleStocks.map((stock) => (
                      <tr
                        key={stock.id}
                        onClick={() => selectStockFromAllSecuritiesList(stock.symbol)}
                        className={`cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-muted/40 ${
                          selectedSymbol === stock.symbol ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          <p className="font-medium">{stock.symbol}</p>
                          <p className="truncate text-[10px] text-muted-foreground max-w-[100px]">{stock.name}</p>
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          {formatPrice(stock.price)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              stock.change >= 0
                                ? "bg-chart-3/10 text-chart-3"
                                : "bg-chart-5/10 text-chart-5"
                            }`}
                          >
                            {stock.change >= 0 ? (
                              <ArrowUpRight className="h-2.5 w-2.5" />
                            ) : (
                              <ArrowDownRight className="h-2.5 w-2.5" />
                            )}
                            {stock.change >= 0 ? "+" : ""}
                            {stock.change.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {formatCompact(stock.volume)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section
          ref={stockAnalyticsSectionRef}
          id="stock-analytics"
          className="mt-6 scroll-mt-24 rounded-xl bg-card p-4 shadow-md"
          aria-label={`Analytics for ${selectedSymbol}`}
        >
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-2">
              <LineChart className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div>
                <h2 className="text-sm font-semibold">Price &amp; liquidity context — {selectedSymbol}</h2>
                <p className="text-[11px] text-muted-foreground">
                  Uses full DSE history when available (up to {STOCK_ANALYTICS_MAX_DAYS} days), otherwise the same series as
                  the chart. Planning only — not investment advice.
                </p>
                {analyticsHistory.length === 0 && history.length > 0 && !analyticsHistoryLoading ? (
                  <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-500/90">
                    Full-history request returned no rows for this symbol — metrics use the chart window until data is
                    available.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {ANALYTICS_PERIOD_OPTIONS.map(({ id, short }) => (
                <Button
                  key={id}
                  type="button"
                  variant={stockPeriod === id ? "default" : "outline"}
                  size="sm"
                  className="h-7 min-w-[2.5rem] px-2 text-[10px]"
                  onClick={() => setStockPeriod(id)}
                >
                  {short}
                </Button>
              ))}
            </div>
          </div>
          {analyticsHistoryLoading ? (
            <p className="text-sm text-muted-foreground">Loading analytics…</p>
          ) : !stockAnalytics ? (
            <p className="text-sm text-muted-foreground">
              {selectedSymbol
                ? `No usable daily prices for ${selectedSymbol} (check date/price fields from the feed or try refresh).`
                : "Select a security to see analytics."}
            </p>
          ) : stockAnalytics.observations < 2 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Not enough daily prices in this window for return metrics ({stockAnalytics.observations} session
                {stockAnalytics.observations === 1 ? "" : "s"}). Widen the analytics period (e.g. 3M or YTD) or check DSE
                data for this symbol.
              </p>
              {stockAnalytics.maTrendNote ? (
                <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground shadow-sm">
                  <span className="font-medium text-foreground">Moving averages: </span>
                  {stockAnalytics.maTrendNote}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <p className="mb-3 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{stockAnalytics.rangeLabel}</span>
                {stockAnalytics.startDate && stockAnalytics.endDate && (
                  <>
                    {" "}
                    · {stockAnalytics.startDate} → {stockAnalytics.endDate} · {stockAnalytics.observations} sessions
                  </>
                )}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total return</p>
                  <p
                    className={`mt-1 text-lg font-semibold tabular-nums ${
                      (stockAnalytics.totalReturnPct ?? 0) >= 0 ? "text-chart-3" : "text-chart-5"
                    }`}
                  >
                    {formatPctAnalytics(stockAnalytics.totalReturnPct)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Annualized return <span className="normal-case opacity-80">(approx.)</span>
                  </p>
                  <p
                    className={`mt-1 text-lg font-semibold tabular-nums ${
                      (stockAnalytics.annualizedReturnPct ?? 0) >= 0 ? "text-chart-3" : "text-chart-5"
                    }`}
                  >
                    {formatPctAnalytics(stockAnalytics.annualizedReturnPct)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Volatility <span className="normal-case opacity-80">(ann.)</span>
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatPctAnalytics(stockAnalytics.volatilityAnnualizedPct)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">From daily % changes</p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Max drawdown</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-chart-5">
                    {stockAnalytics.maxDrawdownPct != null ? `${stockAnalytics.maxDrawdownPct.toFixed(2)}%` : "—"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Largest fall from a peak in window</p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Best / worst day</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    <span className="text-chart-3">{formatPctAnalytics(stockAnalytics.bestDayPct)}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-chart-5">{formatPctAnalytics(stockAnalytics.worstDayPct)}</span>
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Period high / low</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                    {stockAnalytics.periodHighClose != null ? formatPrice(stockAnalytics.periodHighClose) : "—"}{" "}
                    <span className="text-muted-foreground">/</span>{" "}
                    {stockAnalytics.periodLowClose != null ? formatPrice(stockAnalytics.periodLowClose) : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Volume vs period avg</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatPctAnalytics(stockAnalytics.volumeVsAvgPct)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Last {stockAnalytics.latestVolume != null ? formatCompact(stockAnalytics.latestVolume) : "—"} vs avg{" "}
                    {stockAnalytics.avgVolume != null ? formatCompact(stockAnalytics.avgVolume) : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sessions in window</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {stockAnalytics.observations}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Trading days in this analytics slice</p>
                </div>
              </div>
              {stockAnalytics.maTrendNote ? (
                <div className="mt-3 rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground shadow-sm">
                  <span className="font-medium text-foreground">Moving averages (full history): </span>
                  {stockAnalytics.maTrendNote}
                </div>
              ) : null}
            </>
          )}
        </section>

        {error && <p className="mt-4 text-center text-xs text-destructive">{error}</p>}
      </main>

      {/* Mobile All Securities Sidebar */}
      {isStocksSidebarOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setIsStocksSidebarOpen(false)}>
          <aside
            className="absolute inset-y-0 right-0 w-[88%] max-w-sm bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">All Securities</p>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsStocksSidebarOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-7 text-[11px]"
                />
              </div>
            </div>
            <div className="h-[calc(100%-94px)] overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="divide-y divide-border">
                {visibleStocks.map((stock) => (
                  <button
                    key={`mobile-${stock.id}`}
                    type="button"
                    className={`w-full px-4 py-2.5 text-left hover:bg-muted/40 ${
                      selectedSymbol === stock.symbol ? "bg-primary/5" : ""
                    }`}
                    onClick={() => selectStockFromAllSecuritiesList(stock.symbol)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{stock.symbol}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{stock.name}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold tabular-nums">{formatPrice(stock.price)}</p>
                        <span className={stock.change >= 0 ? "text-chart-3 text-[10px]" : "text-chart-5 text-[10px]"}>
                          {stock.change >= 0 ? "+" : ""}
                          {stock.change.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Stock Detail Modal (bottom sheet on mobile, centered on desktop) ── */}
      {activeStock && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm lg:items-center"
          onClick={() => setActiveStock(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-auto rounded-t-2xl border border-border bg-card shadow-2xl lg:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur-sm">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{activeStock.symbol}</h3>
                  <span
                    className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      activeStock.change >= 0
                        ? "bg-chart-3/10 text-chart-3"
                        : "bg-chart-5/10 text-chart-5"
                    }`}
                  >
                    {activeStock.change >= 0 ? (
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    ) : (
                      <ArrowDownRight className="h-2.5 w-2.5" />
                    )}
                    {Math.abs(activeStock.changePercent).toFixed(2)}%
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">{activeStock.name}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setActiveStock(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="p-4">
              {/* Stats */}
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Price</p>
                  <p className="text-xs font-semibold tabular-nums">{formatCompact(activeStock.price)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Change</p>
                  <p className={`text-xs font-semibold tabular-nums ${activeStock.change >= 0 ? "text-chart-3" : "text-chart-5"}`}>
                    {activeStock.change >= 0 ? "+" : ""}{activeStock.changePercent.toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Volume</p>
                  <p className="text-xs font-semibold tabular-nums">{formatCompact(activeStock.volume)}</p>
                </div>
              </div>

              {/* Order Book */}
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Order Book</p>
              {modalLoading ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Loading orders...</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Buy */}
                  <div className="rounded-lg border border-chart-3/20 bg-chart-3/5 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-chart-3">Buy</span>
                      <span className="text-[10px] text-muted-foreground">
                        Best: {formatCompact(activeOrderBook?.bestBuyPrice || 0)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {(activeOrderBook?.orders ?? [])
                        .filter((o) => o.buyQuantity > 0)
                        .slice(0, 5)
                        .map((order, idx) => (
                          <div key={`buy-${idx}`} className="flex justify-between text-[11px]">
                            <span className="tabular-nums">{formatCompact(order.buyPrice)}</span>
                            <span className="tabular-nums text-muted-foreground">{formatCount(order.buyQuantity)}</span>
                          </div>
                        ))}
                      {(activeOrderBook?.orders ?? []).filter((o) => o.buyQuantity > 0).length === 0 && (
                        <p className="text-[10px] text-muted-foreground">No buy orders</p>
                      )}
                    </div>
                  </div>

                  {/* Sell */}
                  <div className="rounded-lg border border-chart-5/20 bg-chart-5/5 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-chart-5">Sell</span>
                      <span className="text-[10px] text-muted-foreground">
                        Best: {formatCompact(activeOrderBook?.bestSellPrice || 0)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {(activeOrderBook?.orders ?? [])
                        .filter((o) => o.sellQuantity > 0)
                        .slice(0, 5)
                        .map((order, idx) => (
                          <div key={`sell-${idx}`} className="flex justify-between text-[11px]">
                            <span className="tabular-nums">{formatCompact(order.sellPrice)}</span>
                            <span className="tabular-nums text-muted-foreground">{formatCount(order.sellQuantity)}</span>
                          </div>
                        ))}
                      {(activeOrderBook?.orders ?? []).filter((o) => o.sellQuantity > 0).length === 0 && (
                        <p className="text-[10px] text-muted-foreground">No sell orders</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  )
}
