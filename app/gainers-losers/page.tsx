"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Moon,
  RefreshCw,
  Sun,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type StockData = {
  id: string
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
}

type HistoryPoint = {
  date: string
  close: number
  volume: number
}

type ChartTooltipProps = {
  active?: boolean
  payload?: Array<{ payload: HistoryPoint }>
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

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(value)

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en-TZ", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)

const HistoryTooltip = ({ active, payload }: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  return (
    <div className="rounded-md border border-border bg-background p-2 text-xs shadow-sm">
      <p className="text-muted-foreground">Date: {point.date}</p>
      <p>Close: {formatPrice(point.close)}</p>
      <p>Volume: {new Intl.NumberFormat("en-TZ").format(point.volume)}</p>
    </div>
  )
}

export default function GainersLosersPage() {
  const [stocks, setStocks] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [selectedStockId, setSelectedStockId] = useState<string>("")
  const [selectedSymbol, setSelectedSymbol] = useState<string>("")
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [days, setDays] = useState(30)

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev)
    document.documentElement.classList.toggle("dark")
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

  const fetchStocks = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/market/movers")
      const payload = await response.json()
      const rows: StockData[] = Array.isArray(payload?.data)
        ? payload.data.map((item: any) => ({
            id: String(item.company),
            symbol: String(item.company),
            name: String(item.company),
            price: Number(item.price) || 0,
            change: Number(item.change) || 0,
            changePercent: Number(item.change) || 0,
            volume: Number(item.volume) || 0,
          }))
        : []
      setStocks(rows)
      if (rows.length > 0 && !selectedStockId) {
        setSelectedStockId(rows[0].id)
        setSelectedSymbol(rows[0].symbol)
      }
      setLastUpdated(new Date())
    } catch {
      setError("Unable to fetch gainers and losers right now.")
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async (symbol: string, rangeDays: number) => {
    try {
      const response = await fetch(`/api/market/history/${encodeURIComponent(symbol)}?days=${rangeDays}`)
      const payload = await response.json()
      setHistory(Array.isArray(payload?.data) ? payload.data : [])
    } catch {
      setHistory([])
    }
  }

  const fetchOrders = async (stockId: string) => {
    try {
      setDetailLoading(true)
      const response = await fetch(`/api/market/orders/${encodeURIComponent(stockId)}`)
      const payload = await response.json()
      setOrderBook({
        bestSellPrice: Number(payload?.bestSellPrice) || 0,
        bestBuyPrice: Number(payload?.bestBuyPrice) || 0,
        orders: Array.isArray(payload?.orders) ? payload.orders : [],
      })
    } catch {
      setOrderBook({ bestSellPrice: 0, bestBuyPrice: 0, orders: [] })
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    fetchStocks()
    const interval = setInterval(fetchStocks, 120000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedSymbol) fetchHistory(selectedSymbol, days)
  }, [selectedSymbol, days])

  useEffect(() => {
    if (selectedStockId) fetchOrders(selectedStockId)
  }, [selectedStockId])

  const gainers = useMemo(() => stocks.filter((stock) => stock.change > 0).sort((a, b) => b.change - a.change), [stocks])
  const losers = useMemo(() => stocks.filter((stock) => stock.change < 0).sort((a, b) => a.change - b.change), [stocks])

  const selectedStock = stocks.find((stock) => stock.id === selectedStockId) ?? null
  const totalTrades = (orderBook?.orders ?? []).length

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button size="sm" variant="outline">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="rounded-xl bg-primary p-2 text-primary-foreground">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-semibold">Market Movers</h1>
              <p className="text-xs text-muted-foreground">Unified live + historical movers board</p>
            </div>
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

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Top Gainers</CardDescription>
              <CardTitle className="text-chart-3">{gainers.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Top Losers</CardDescription>
              <CardTitle className="text-chart-5">{losers.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Best Bid</CardDescription>
              <CardTitle>{formatCompact(orderBook?.bestBuyPrice ?? 0)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Best Offer</CardDescription>
              <CardTitle>{formatCompact(orderBook?.bestSellPrice ?? 0)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>{selectedSymbol ? `${selectedSymbol} Movers Trend (${days}D)` : "Movers Trend"}</CardTitle>
              <CardDescription>Historical price graph with live market context</CardDescription>
              <div className="flex flex-wrap gap-2 pt-2">
                {[30, 90, 180, 365, 1095].map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={days === option ? "default" : "outline"}
                    onClick={() => setDays(option)}
                  >
                    {option}D
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="h-[310px]">
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="moversFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompact(Number(value))} />
                    <Tooltip content={<HistoryTooltip />} />
                    <Area type="monotone" dataKey="close" stroke="var(--color-primary)" fill="url(#moversFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No historical graph data yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Book Snapshot</CardTitle>
              <CardDescription>Buy and sell orders in the market</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-chart-3/30 bg-chart-3/10 p-2">
                  <p className="text-xs text-muted-foreground">Best Buy</p>
                  <p className="font-semibold text-chart-3">{formatPrice(orderBook?.bestBuyPrice ?? 0)}</p>
                </div>
                <div className="rounded-lg border border-chart-5/30 bg-chart-5/10 p-2">
                  <p className="text-xs text-muted-foreground">Best Sell</p>
                  <p className="font-semibold text-chart-5">{formatPrice(orderBook?.bestSellPrice ?? 0)}</p>
                </div>
              </div>

              <div className="max-h-[210px] overflow-y-auto space-y-2 pr-1">
                {detailLoading ? (
                  <p className="text-sm text-muted-foreground">Loading order book...</p>
                ) : (
                  (orderBook?.orders ?? []).slice(0, 10).map((order, index) => (
                    <div key={`${index}-${order.buyPrice}-${order.sellPrice}`} className="rounded-lg border border-border p-2 text-xs">
                      <div className="flex justify-between text-chart-3">
                        <span>Buy {formatCompact(order.buyPrice)}</span>
                        <span>Qty {formatCompact(order.buyQuantity)}</span>
                      </div>
                      <div className="flex justify-between text-chart-5">
                        <span>Sell {formatCompact(order.sellPrice)}</span>
                        <span>Qty {formatCompact(order.sellQuantity)}</span>
                      </div>
                    </div>
                  ))
                )}
                {!detailLoading && totalTrades === 0 && (
                  <p className="text-sm text-muted-foreground">No visible orders for this stock right now.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-chart-3">
                <TrendingUp className="h-4 w-4" />
                Top Gainers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {gainers.map((stock) => (
                <button
                  key={stock.id}
                  type="button"
                  onClick={() => {
                    setSelectedStockId(stock.id)
                    setSelectedSymbol(stock.symbol)
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 text-left hover:border-primary/50"
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{stock.symbol}</span>
                    <span className="text-chart-3">
                      +{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{stock.name}</p>
                </button>
              ))}
              {!loading && gainers.length === 0 && <p className="text-sm text-muted-foreground">No gainers available.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-chart-5">
                <TrendingDown className="h-4 w-4" />
                Top Losers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {losers.map((stock) => (
                <button
                  key={stock.id}
                  type="button"
                  onClick={() => {
                    setSelectedStockId(stock.id)
                    setSelectedSymbol(stock.symbol)
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 text-left hover:border-primary/50"
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{stock.symbol}</span>
                    <span className="text-chart-5">
                      {stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{stock.name}</p>
                </button>
              ))}
              {!loading && losers.length === 0 && <p className="text-sm text-muted-foreground">No losers available.</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selected Stock Live Snapshot</CardTitle>
            <CardDescription>Live market price and movement for the active stock</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedStock ? (
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Symbol</p>
                  <p className="font-semibold">{selectedStock.symbol}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Live Price</p>
                  <p className="font-semibold">{formatPrice(selectedStock.price)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Change</p>
                  <p className={selectedStock.change >= 0 ? "text-chart-3 font-semibold" : "text-chart-5 font-semibold"}>
                    {selectedStock.change >= 0 ? "+" : ""}
                    {selectedStock.change.toFixed(2)} ({selectedStock.changePercent.toFixed(2)}%)
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Volume</p>
                  <p className="font-semibold">{formatCompact(selectedStock.volume)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Choose a stock from gainers or losers to see details.</p>
            )}
          </CardContent>
        </Card>

        {(error || lastUpdated) && (
          <p className="text-xs text-muted-foreground">
            {error ? error : `Last updated at ${lastUpdated?.toLocaleTimeString()}`}
          </p>
        )}

        <div className="pt-2">
          <Link href="/">
            <Button variant="outline">
              Back To Main Dashboard
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
