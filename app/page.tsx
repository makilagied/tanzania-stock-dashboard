"use client"

import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowDownRight, ArrowUpRight, BarChart3, Moon, RefreshCw, Search, Sun, TrendingUp, X } from "lucide-react"
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

export default function HomePage() {
  const [stocks, setStocks] = useState<StockData[]>([])
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [topMovers, setTopMovers] = useState<LiveMoverPoint[]>([])
  const [indices, setIndices] = useState<ShareIndexPoint[]>([])
  const [search, setSearch] = useState("")
  const [selectedSymbol, setSelectedSymbol] = useState("CRDB")
  const [days, setDays] = useState(90)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeStock, setActiveStock] = useState<StockData | null>(null)
  const [activeOrderBook, setActiveOrderBook] = useState<OrderBook | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [sortKey, setSortKey] = useState<"symbol" | "price" | "change" | "volume">("volume")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const selectedStock = stocks.find((stock) => stock.symbol === selectedSymbol) ?? null
  const totalMarketCap = stocks.reduce((sum, stock) => sum + (stock.marketCap ?? 0), 0)
  const totalVolume = stocks.reduce((sum, stock) => sum + stock.volume, 0)
  const gainers = stocks.filter((stock) => stock.change > 0)
  const losers = stocks.filter((stock) => stock.change < 0)

  const visibleStocks = useMemo(() => {
    const filtered = stocks.filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(search.toLowerCase()) ||
        stock.name.toLowerCase().includes(search.toLowerCase())
    )
    return filtered.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal)
    })
  }, [stocks, search, sortKey, sortDir])

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev)
    document.documentElement.classList.toggle("dark")
  }

  const fetchStocks = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/market/stocks")
      const payload = await response.json()
      const rows: StockData[] = Array.isArray(payload?.data) ? payload.data : []
      setStocks(rows)
      if (rows.length > 0 && !rows.find((row) => row.symbol === selectedSymbol)) setSelectedSymbol(rows[0].symbol)
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
      const response = await fetch(`/api/market/history/${encodeURIComponent(symbol)}?days=${rangeDays}`)
      const payload = await response.json()
      setHistory(Array.isArray(payload?.data) ? payload.data : [])
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const fetchTopMovers = async () => {
    const response = await fetch("/api/market/top-movers")
    const payload = await response.json()
    setTopMovers(Array.isArray(payload?.data) ? payload.data : [])
  }

  const fetchIndices = async () => {
    const response = await fetch("/api/market/indices")
    const payload = await response.json()
    setIndices(Array.isArray(payload?.data) ? payload.data : [])
  }

  const openStockModal = async (stock: StockData) => {
    setActiveStock(stock)
    setModalLoading(true)
    try {
      const response = await fetch(`/api/market/orders/${encodeURIComponent(stock.id)}`)
      const payload = await response.json()
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
    const savedTheme = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setIsDarkMode(true)
      document.documentElement.classList.add("dark")
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("theme", isDarkMode ? "dark" : "light")
  }, [isDarkMode])

  useEffect(() => {
    fetchStocks()
    fetchTopMovers()
    fetchIndices()
    const interval = setInterval(fetchStocks, 120000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedSymbol) fetchHistory(selectedSymbol, days)
  }, [selectedSymbol, days])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <BarChart3 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">DSE Market</h1>
              <p className="text-[10px] text-muted-foreground">Dar es Salaam Stock Exchange</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="hidden text-[10px] text-muted-foreground sm:block">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={toggleDarkMode}>
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={fetchStocks} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-4 lg:px-6 lg:py-6">
        {/* Stats Row */}
        <section className="mb-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Market Cap</p>
              <p className="text-lg font-semibold tabular-nums">{formatCompact(totalMarketCap)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Volume</p>
              <p className="text-lg font-semibold tabular-nums">{formatCompact(totalVolume)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Gainers</p>
                <ArrowUpRight className="h-3 w-3 text-chart-3" />
              </div>
              <p className="text-lg font-semibold tabular-nums text-chart-3">{gainers.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Losers</p>
                <ArrowDownRight className="h-3 w-3 text-chart-5" />
              </div>
              <p className="text-lg font-semibold tabular-nums text-chart-5">{losers.length}</p>
            </div>
          </div>
        </section>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Chart & Table */}
          <div className="space-y-6 lg:col-span-2">
            {/* Chart Section */}
            <section className="rounded-xl border border-border bg-card">
              <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{selectedStock?.symbol || "Select Stock"}</h2>
                  <p className="text-xs text-muted-foreground">{selectedStock?.name || "Historical price trend"}</p>
                </div>
                <div className="flex gap-1">
                  {[30, 90, 180, 365].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
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
              <div className="h-[220px] p-4">
                {history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} dy={8} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatCompact(Number(v))}
                        dx={-8}
                        width={50}
                      />
                      <Tooltip content={<HistoryTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="close"
                        stroke="var(--color-primary)"
                        fill="url(#chartGradient)"
                        strokeWidth={1.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    {historyLoading ? "Loading chart..." : "No historical data available"}
                  </div>
                )}
              </div>
            </section>

            {/* Stocks Table */}
            <section className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <h2 className="text-sm font-semibold">All Securities</h2>
                  <p className="text-xs text-muted-foreground">{stocks.length} listed stocks</p>
                </div>
                <div className="relative w-40">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th
                        className="cursor-pointer px-4 py-2.5 font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => handleSort("symbol")}
                      >
                        Symbol {sortKey === "symbol" && (sortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="cursor-pointer px-4 py-2.5 text-right font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => handleSort("price")}
                      >
                        Price {sortKey === "price" && (sortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="cursor-pointer px-4 py-2.5 text-right font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => handleSort("change")}
                      >
                        Change {sortKey === "change" && (sortDir === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="cursor-pointer px-4 py-2.5 text-right font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => handleSort("volume")}
                      >
                        Volume {sortKey === "volume" && (sortDir === "asc" ? "↑" : "↓")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStocks.map((stock) => (
                      <tr
                        key={stock.id}
                        onClick={() => {
                          setSelectedSymbol(stock.symbol)
                          openStockModal(stock)
                        }}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{stock.symbol}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{stock.name}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          {formatCompact(stock.price)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              stock.change >= 0 ? "bg-gain" : "bg-loss"
                            }`}
                          >
                            {stock.change >= 0 ? (
                              <ArrowUpRight className="h-2.5 w-2.5" />
                            ) : (
                              <ArrowDownRight className="h-2.5 w-2.5" />
                            )}
                            {Math.abs(stock.changePercent).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {formatCompact(stock.volume)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Indices */}
            <section className="rounded-xl border border-border bg-card">
              <div className="border-b border-border p-4">
                <h2 className="text-sm font-semibold">Market Indices</h2>
                <p className="text-xs text-muted-foreground">DSE performance indicators</p>
              </div>
              <div className="divide-y divide-border">
                {indices.slice(0, 4).map((idx) => (
                  <div key={idx.code} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-xs font-medium">{idx.code}</p>
                      <p className="text-[10px] text-muted-foreground">{idx.indexDescription}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold tabular-nums">{formatCompact(idx.closingPrice)}</p>
                      <p className={`text-[10px] tabular-nums ${idx.change >= 0 ? "text-chart-3" : "text-chart-5"}`}>
                        {idx.change >= 0 ? "+" : ""}
                        {idx.change.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Top Movers */}
            <section className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border p-4">
                <TrendingUp className="h-4 w-4 text-chart-3" />
                <div>
                  <h2 className="text-sm font-semibold">Top Movers</h2>
                  <p className="text-xs text-muted-foreground">Most active today</p>
                </div>
              </div>
              <div className="divide-y divide-border">
                {topMovers.slice(0, 5).map((mover) => (
                  <div key={mover.company} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-xs font-medium">{mover.company}</p>
                      <p className="text-[10px] text-muted-foreground">Vol: {formatCompact(mover.volume)}</p>
                    </div>
                    <p className="text-xs font-semibold tabular-nums">{formatPrice(mover.price)}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {error && <p className="mt-4 text-center text-xs text-destructive">{error}</p>}
      </main>

      {/* Stock Detail Modal */}
      {activeStock && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm lg:items-center">
          <div className="max-h-[85vh] w-full max-w-lg animate-slide-in-right overflow-auto rounded-t-2xl border border-border bg-card lg:rounded-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card p-4">
              <div>
                <h3 className="text-base font-semibold">{activeStock.symbol}</h3>
                <p className="text-xs text-muted-foreground">{activeStock.name}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setActiveStock(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="p-4">
              {/* Price Info */}
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Price</p>
                  <p className="text-sm font-semibold tabular-nums">{formatPrice(activeStock.price)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Change</p>
                  <p className={`text-sm font-semibold tabular-nums ${activeStock.change >= 0 ? "text-chart-3" : "text-chart-5"}`}>
                    {activeStock.change >= 0 ? "+" : ""}{activeStock.changePercent.toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Volume</p>
                  <p className="text-sm font-semibold tabular-nums">{formatCompact(activeStock.volume)}</p>
                </div>
              </div>

              {/* Order Book */}
              <div>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order Book</h4>
                {modalLoading ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Loading orders...</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Buy Orders */}
                    <div className="rounded-lg border border-chart-3/20 bg-chart-3/5 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-chart-3">Buy</span>
                        <span className="text-[10px] text-muted-foreground">
                          Best: {formatPrice(activeOrderBook?.bestBuyPrice || 0)}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {(activeOrderBook?.orders ?? [])
                          .filter((o) => o.buyQuantity > 0)
                          .slice(0, 4)
                          .map((order, idx) => (
                            <div key={`buy-${idx}`} className="flex justify-between text-[11px]">
                              <span className="tabular-nums">{formatPrice(order.buyPrice)}</span>
                              <span className="tabular-nums text-muted-foreground">{formatCount(order.buyQuantity)}</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Sell Orders */}
                    <div className="rounded-lg border border-chart-5/20 bg-chart-5/5 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-chart-5">Sell</span>
                        <span className="text-[10px] text-muted-foreground">
                          Best: {formatPrice(activeOrderBook?.bestSellPrice || 0)}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {(activeOrderBook?.orders ?? [])
                          .filter((o) => o.sellQuantity > 0)
                          .slice(0, 4)
                          .map((order, idx) => (
                            <div key={`sell-${idx}`} className="flex justify-between text-[11px]">
                              <span className="tabular-nums">{formatPrice(order.sellPrice)}</span>
                              <span className="tabular-nums text-muted-foreground">{formatCount(order.sellQuantity)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
