"use client"

import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Activity, BarChart3, Moon, RefreshCw, Sun, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  if (Math.abs(value) < 100000) {
    return new Intl.NumberFormat("en-TZ").format(value)
  }
  return new Intl.NumberFormat("en-TZ", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

const formatCount = (value: number) => new Intl.NumberFormat("en-TZ").format(value)

const HistoryTooltip = ({ active, payload }: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  return (
    <div className="rounded-md border border-border bg-background p-2 text-xs">
      <p className="text-muted-foreground">Date: {point.date}</p>
      <p>Close: {formatPrice(point.close)}</p>
      <p>Volume: {formatCount(point.volume)}</p>
    </div>
  )
}

export default function HomePage() {
  const [stocks, setStocks] = useState<StockData[]>([])
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [topMovers, setTopMovers] = useState<LiveMoverPoint[]>([])
  const [indices, setIndices] = useState<ShareIndexPoint[]>([])
  const [indicesDate, setIndicesDate] = useState("")
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

  const selectedStock = stocks.find((stock) => stock.symbol === selectedSymbol) ?? null
  const totalMarketCap = stocks.reduce((sum, stock) => sum + (stock.marketCap ?? 0), 0)
  const totalVolume = stocks.reduce((sum, stock) => sum + stock.volume, 0)
  const gainers = stocks.filter((stock) => stock.change > 0).length

  const visibleStocks = useMemo(() => {
    return stocks
      .filter(
        (stock) =>
          stock.symbol.toLowerCase().includes(search.toLowerCase()) ||
          stock.name.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => b.volume - a.volume)
  }, [stocks, search])

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
      setError("Unable to fetch market data right now.")
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

  const fetchIndices = async (fromDate?: string) => {
    const response = await fetch(`/api/market/indices${fromDate ? `?from=${fromDate}` : ""}`)
    const payload = await response.json()
    setIndices(Array.isArray(payload?.data) ? payload.data : [])
    if (typeof payload?.from === "string") setIndicesDate(payload.from)
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
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">DSE Single Page Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleDarkMode}>
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchStocks} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardDescription>Market Cap</CardDescription><CardTitle>{formatCompact(totalMarketCap)}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Total Volume</CardDescription><CardTitle>{formatCompact(totalVolume)}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Stocks</CardDescription><CardTitle>{stocks.length}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Gainers</CardDescription><CardTitle className="text-chart-3">{gainers}</CardTitle></CardHeader></Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>{selectedStock ? `${selectedStock.symbol} Trend` : "Historical Trend"}</CardTitle>
              <CardDescription>Click a stock to update the chart</CardDescription>
              <div className="flex flex-wrap gap-2">
                {[30, 90, 180, 365, 1095].map((option) => (
                  <Button key={option} size="sm" variant={days === option ? "default" : "outline"} onClick={() => setDays(option)}>
                    {option}D
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="h-[300px]">
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompact(Number(value))} />
                    <Tooltip content={<HistoryTooltip />} />
                    <Area type="monotone" dataKey="close" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {historyLoading ? "Loading chart..." : "No historical data."}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />Watchlist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="max-h-[300px] space-y-1 overflow-y-auto">
                {visibleStocks.map((stock) => (
                  <button
                    key={stock.id}
                    type="button"
                    onClick={() => {
                      setSelectedSymbol(stock.symbol)
                      openStockModal(stock)
                    }}
                    className="w-full rounded-md border border-border px-3 py-2 text-left hover:bg-muted"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{stock.symbol}</span>
                      <span className={stock.change >= 0 ? "text-chart-3 text-xs" : "text-chart-5 text-xs"}>
                        {stock.change >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{stock.name}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <CardTitle>Share Indices</CardTitle>
                  <CardDescription>Hover any card for quick details</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="date" className="w-[160px]" value={indicesDate} onChange={(e) => setIndicesDate(e.target.value)} />
                  <Button size="sm" variant="outline" onClick={() => fetchIndices(indicesDate)}>Load</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {indices.map((item) => (
                <div key={item.code} className="group relative rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">{item.code}</p>
                  <p className="text-sm font-medium">{item.indexDescription}</p>
                  <p className="text-sm font-semibold">{formatCompact(item.closingPrice)}</p>
                  <p className={item.change >= 0 ? "text-chart-3 text-xs" : "text-chart-5 text-xs"}>
                    {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}
                  </p>
                  <div className="pointer-events-none absolute right-2 top-2 rounded bg-muted px-2 py-1 text-[10px] opacity-0 transition group-hover:opacity-100">
                    Flat view
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Movers</CardTitle>
              <CardDescription>Click watchlist items for modal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {topMovers.map((item) => (
                <div key={item.company} className="rounded-md border border-border p-3">
                  <p className="font-medium">{item.company}</p>
                  <p className="text-sm">{formatPrice(item.price)}</p>
                  <p className="text-xs text-muted-foreground">Volume: {formatCount(item.volume)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {(error || lastUpdated) && (
          <p className="text-xs text-muted-foreground">{error ? error : `Last updated ${lastUpdated?.toLocaleTimeString()}`}</p>
        )}
      </main>

      {activeStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="text-base font-semibold">{activeStock.symbol}</h3>
                <p className="text-xs text-muted-foreground">{activeStock.name}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setActiveStock(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4 text-sm">
              <div className="rounded-md border border-border p-2"><p className="text-xs text-muted-foreground">Price</p><p className="font-semibold">{formatPrice(activeStock.price)}</p></div>
              <div className="rounded-md border border-border p-2"><p className="text-xs text-muted-foreground">Change</p><p className={activeStock.change >= 0 ? "text-chart-3 font-semibold" : "text-chart-5 font-semibold"}>{activeStock.changePercent.toFixed(2)}%</p></div>
              <div className="rounded-md border border-border p-2"><p className="text-xs text-muted-foreground">Volume</p><p className="font-semibold">{formatCount(activeStock.volume)}</p></div>
            </div>
            <div className="border-t border-border p-4">
              <p className="mb-2 text-xs text-muted-foreground">Order Book</p>
              {modalLoading ? (
                <p className="text-sm text-muted-foreground">Loading orders...</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-chart-3/30 p-2">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-chart-3 font-medium">Buy Orders</span>
                      <span className="text-muted-foreground">Best: {formatPrice(activeOrderBook?.bestBuyPrice || 0)}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      {(activeOrderBook?.orders ?? [])
                        .filter((order) => order.buyQuantity > 0)
                        .slice(0, 5)
                        .map((order, idx) => (
                          <div key={`buy-${idx}-${order.buyPrice}`} className="flex justify-between border-t border-border pt-1">
                            <span>{formatPrice(order.buyPrice)}</span>
                            <span>Q {formatCount(order.buyQuantity)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-chart-5/30 p-2">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-chart-5 font-medium">Sell Orders</span>
                      <span className="text-muted-foreground">Best: {formatPrice(activeOrderBook?.bestSellPrice || 0)}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      {(activeOrderBook?.orders ?? [])
                        .filter((order) => order.sellQuantity > 0)
                        .slice(0, 5)
                        .map((order, idx) => (
                          <div key={`sell-${idx}-${order.sellPrice}`} className="flex justify-between border-t border-border pt-1">
                            <span>{formatPrice(order.sellPrice)}</span>
                            <span>Q {formatCount(order.sellQuantity)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
