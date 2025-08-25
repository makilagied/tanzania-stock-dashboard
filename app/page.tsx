"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  BarChart3,
  DollarSign,
  Activity,
  Sparkles,
  X,
  Moon,
  Sun,
  Search,
  LineChart,
} from "lucide-react"

interface StockData {
  id?: string
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap?: number
  high?: number
  low?: number
  bestBidPrice?: number
  bestOfferPrice?: number
  openingPrice?: number
}

interface StockDetail {
  bestSellPrice: number
  bestBuyPrice: number
  orders: Array<{
    buyPrice: number
    buyQuantity: number
    sellPrice: number
    sellQuantity: number
  }>
}

interface MarketDataPoint {
  timestamp: number
  date: string
  time: string
  stocks: StockData[]
}

interface MarketAnalytics {
  totalDataPoints: number
  avgVolume: number
  topPerformers: { symbol: string; avgChange: number }[]
  worstPerformers: { symbol: string; avgChange: number }[]
  marketTrend: "bullish" | "bearish" | "neutral"
  volatilityIndex: number
  priceMovements: { symbol: string; movements: number[] }[]
}

export default function TanzaniaStockDashboard() {
  const [stockData, setStockData] = useState<StockData[]>([])
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null)
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [marketAnalytics, setMarketAnalytics] = useState<MarketAnalytics | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)

  const saveMarketData = (stocks: StockData[]) => {
    try {
      const now = new Date()
      const existingData = localStorage.getItem("dse_market_data")
      let marketDataArray: MarketDataPoint[] = existingData ? JSON.parse(existingData) : []

      // Add current data point
      marketDataArray.push({
        timestamp: now.getTime(),
        date: now.toDateString(),
        time: now.toLocaleTimeString(),
        stocks: stocks,
      })

      // Keep only last 500 data points (approximately 16-17 hours of data at 2-minute intervals)
      marketDataArray = marketDataArray.sort((a, b) => b.timestamp - a.timestamp).slice(0, 500)

      localStorage.setItem("dse_market_data", JSON.stringify(marketDataArray))

      // Generate analytics after saving
      generateAnalytics(marketDataArray)
    } catch (error) {
      console.error("Error saving market data:", error)
    }
  }

  const generateAnalytics = (marketData: MarketDataPoint[]) => {
    if (marketData.length < 5) return // Need at least 5 data points

    try {
      const totalDataPoints = marketData.length

      // Calculate average volume across all data points
      const avgVolume =
        marketData.reduce((sum, dataPoint) => {
          const pointVolume = dataPoint.stocks.reduce((daySum, stock) => daySum + stock.volume, 0)
          return sum + pointVolume
        }, 0) / totalDataPoints

      // Track price movements for each stock
      const stockPriceHistory: { [symbol: string]: { prices: number[]; changes: number[] } } = {}

      marketData.forEach((dataPoint) => {
        dataPoint.stocks.forEach((stock) => {
          if (!stockPriceHistory[stock.symbol]) {
            stockPriceHistory[stock.symbol] = { prices: [], changes: [] }
          }
          stockPriceHistory[stock.symbol].prices.push(stock.price)
          stockPriceHistory[stock.symbol].changes.push(stock.change)
        })
      })

      // Calculate average performance for each stock
      const avgPerformance = Object.entries(stockPriceHistory).map(([symbol, data]) => ({
        symbol,
        avgChange: data.changes.reduce((sum, change) => sum + change, 0) / data.changes.length,
      }))

      // Get top and worst performers
      const sortedPerformance = avgPerformance.sort((a, b) => b.avgChange - a.avgChange)
      const topPerformers = sortedPerformance.slice(0, 3)
      const worstPerformers = sortedPerformance.slice(-3).reverse()

      // Calculate market trend based on recent data points (last 30 data points = 1 hour)
      const recentDataPoints = marketData.slice(0, Math.min(30, marketData.length))
      const marketChanges = recentDataPoints.map(
        (dataPoint) => dataPoint.stocks.reduce((sum, stock) => sum + stock.change, 0) / dataPoint.stocks.length,
      )
      const avgMarketChange = marketChanges.reduce((sum, change) => sum + change, 0) / marketChanges.length

      let marketTrend: "bullish" | "bearish" | "neutral" = "neutral"
      if (avgMarketChange > 2) marketTrend = "bullish"
      else if (avgMarketChange < -2) marketTrend = "bearish"

      // Calculate volatility index (standard deviation of market changes)
      const mean = avgMarketChange
      const variance = marketChanges.reduce((sum, change) => sum + Math.pow(change - mean, 2), 0) / marketChanges.length
      const volatilityIndex = Math.sqrt(variance)

      // Create price movement data for analysis
      const priceMovements = Object.entries(stockPriceHistory).map(([symbol, data]) => ({
        symbol,
        movements: data.prices.slice(-20), // Last 20 data points for trend analysis
      }))

      const analytics: MarketAnalytics = {
        totalDataPoints,
        avgVolume,
        topPerformers,
        worstPerformers,
        marketTrend,
        volatilityIndex,
        priceMovements,
      }

      setMarketAnalytics(analytics)
    } catch (error) {
      console.error("Error generating analytics:", error)
    }
  }

  useEffect(() => {
    const existingData = localStorage.getItem("dse_market_data")
    if (existingData) {
      try {
        const marketDataArray: MarketDataPoint[] = JSON.parse(existingData)
        generateAnalytics(marketDataArray)
      } catch (error) {
        console.error("Error loading analytics:", error)
      }
    }
  }, [])

  const fetchStockData = async () => {
    console.log("[v0] Fetching stock data...")
    const now = new Date()
    const currentHour = now.getHours()

    if (currentHour < 10 || currentHour >= 18) {
      console.log("[v0] Outside trading hours (10am-6pm), skipping data fetch")
      return
    }

    try {
      setLoading(true)
      setError(null)
      console.log("[v0] Making API call to DSE...")

      const response = await fetch("https://api.dse.co.tz/api/market-data?isBond=false")

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("[v0] API response received:", data.length, "stocks")

      const transformedData: StockData[] = data.map((item: any) => ({
        id: item.id || item.security?.id || item.companyId || item.symbol,
        symbol: item.security?.symbol || item.company?.symbol || "N/A",
        name: item.security?.securityDesc || item.company?.name || "Unknown Company",
        price: item.marketPrice || item.openingPrice || 0,
        change: item.change || 0,
        changePercent: item.percentageChange || 0,
        volume: item.volume || 0,
        marketCap: item.marketCap || undefined,
        high: item.high || undefined,
        low: item.low || undefined,
        bestBidPrice: item.bestBidPrice || undefined,
        bestOfferPrice: item.bestOfferPrice || undefined,
        openingPrice: item.openingPrice || undefined,
      }))

      setStockData(transformedData)
      setLastUpdated(new Date())
      saveMarketData(transformedData)
    } catch (err) {
      console.error("[v0] Error fetching stock data:", err)
      setError("Failed to fetch market data. Please try again.")

      const mockData: StockData[] = [
        {
          id: "1",
          symbol: "MCB",
          name: "MWALIMU COMMERCIAL BANK PLC",
          price: 360.0,
          change: 0.0,
          changePercent: 0,
          volume: 0,
          marketCap: 22256971200,
          bestBidPrice: 350.0,
          bestOfferPrice: 0.0,
          openingPrice: 360.0,
        },
        {
          id: "2",
          symbol: "VODA",
          name: "VODACOM TANZANIA PUBLIC LIMITED COMPANY",
          price: 600.0,
          change: 5.0,
          changePercent: 0.84,
          volume: 11983,
          marketCap: 45000000000,
          bestBidPrice: 595.0,
          bestOfferPrice: 600.0,
          openingPrice: 595.0,
        },
        {
          id: "3",
          symbol: "CRDB",
          name: "CRDB BANK PLC",
          price: 185.0,
          change: 5.0,
          changePercent: 2.78,
          volume: 125000,
          marketCap: 18500000000,
          bestBidPrice: 180.0,
          bestOfferPrice: 185.0,
          openingPrice: 180.0,
        },
        {
          id: "4",
          symbol: "NMB",
          name: "NMB BANK PLC",
          price: 2850.0,
          change: -50.0,
          changePercent: -1.72,
          volume: 85000,
          marketCap: 28500000000,
          bestBidPrice: 2800.0,
          bestOfferPrice: 2850.0,
          openingPrice: 2900.0,
        },
        {
          id: "5",
          symbol: "TCC",
          name: "TANZANIA CIGARETTE COMPANY LIMITED",
          price: 3500.0,
          change: -75.0,
          changePercent: -2.1,
          volume: 32000,
          marketCap: 35000000000,
          bestBidPrice: 3450.0,
          bestOfferPrice: 3500.0,
          openingPrice: 3575.0,
        },
      ]
      setStockData(mockData)
      setLastUpdated(new Date())
      saveMarketData(mockData)
    } finally {
      setLoading(false)
    }
  }

  const fetchStockDetail = async (stockId: string) => {
    try {
      setDetailLoading(true)
      const response = await fetch(`https://api.dse.co.tz/api/market-orders/companies/${stockId}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Use the actual API response structure
      setStockDetail(data)
    } catch (err) {
      console.error("Error fetching stock detail:", err)
      // Mock detailed data matching actual API structure
      const mockDetail: StockDetail = {
        bestSellPrice: 550.0,
        bestBuyPrice: 470.0,
        orders: [
          { buyPrice: 470.0, buyQuantity: 6805, sellPrice: 550.0, sellQuantity: 6648 },
          { buyPrice: 470.0, buyQuantity: 93, sellPrice: 560.0, sellQuantity: 50 },
          { buyPrice: 470.0, buyQuantity: 31, sellPrice: 0.0, sellQuantity: 0 },
          { buyPrice: 465.0, buyQuantity: 4277, sellPrice: 0.0, sellQuantity: 0 },
          { buyPrice: 460.0, buyQuantity: 1028, sellPrice: 0.0, sellQuantity: 0 },
        ],
      }
      setStockDetail(mockDetail)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleStockClick = (stock: StockData) => {
    if (stock.id) {
      setSelectedStock(stock)
      fetchStockDetail(stock.id)
    }
  }

  const handleBackClick = () => {
    setSelectedStock(null)
    setStockDetail(null)
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark")
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme")
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

      if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
        setIsDarkMode(true)
        document.documentElement.classList.add("dark")
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", isDarkMode ? "dark" : "light")
    }
  }, [isDarkMode])

  useEffect(() => {
    console.log("[v0] Initializing dashboard...")
    fetchStockData()

    const interval = setInterval(() => {
      console.log("[v0] Auto-refresh triggered")
      fetchStockData()
    }, 300000)

    return () => {
      console.log("[v0] Cleaning up intervals")
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (selectedStock && selectedStock.id) {
      const detailInterval = setInterval(() => {
        const now = new Date()
        const currentHour = now.getHours()

        if (currentHour >= 10 && currentHour < 18) {
          fetchStockDetail(selectedStock.id!)
        }
      }, 300000)
      return () => clearInterval(detailInterval)
    }
  }, [selectedStock])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-TZ", {
      style: "currency",
      currency: "TZS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-TZ").format(value)
  }

  const totalMarketCap = stockData.reduce((sum, stock) => sum + (stock.marketCap || 0), 0)
  const totalVolume = stockData.reduce((sum, stock) => sum + stock.volume, 0)
  const gainers = stockData.filter((stock) => stock.change > 0).length
  const losers = stockData.filter((stock) => stock.change < 0).length

  const calculateOrderStats = (orders: StockDetail["orders"]) => {
    const buyOrders = orders.filter((order) => order.buyQuantity > 0)
    const sellOrders = orders.filter((order) => order.sellQuantity > 0)

    const totalBuyQuantity = buyOrders.reduce((sum, order) => sum + order.buyQuantity, 0)
    const totalSellQuantity = sellOrders.reduce((sum, order) => sum + order.sellQuantity, 0)

    const avgBuyPrice =
      buyOrders.length > 0
        ? buyOrders.reduce((sum, order) => sum + order.buyPrice * order.buyQuantity, 0) / totalBuyQuantity
        : 0

    const avgSellPrice =
      sellOrders.length > 0
        ? sellOrders.reduce((sum, order) => sum + order.sellPrice * order.sellQuantity, 0) / totalSellQuantity
        : 0

    return {
      totalBuyOrders: buyOrders.length,
      totalSellOrders: sellOrders.length,
      totalBuyQuantity,
      totalSellQuantity,
      avgBuyPrice,
      avgSellPrice,
    }
  }

  const filteredStocks = stockData.filter(
    (stock) =>
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-background animate-fade-in flex">
      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${selectedStock ? "lg:mr-96" : ""}`}>
        <header className="glass-effect border-b shadow-lg sticky top-0 z-50">
          <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 sm:space-x-6">
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg">
                    <BarChart3 className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <div className="animate-slide-up">
                    <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground font-heading">
                      DSE Market
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground font-body hidden sm:block">
                      Dar es Salaam Stock Exchange
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-6">
                {lastUpdated && (
                  <div className="text-right animate-scale-in hidden sm:block">
                    <p className="text-xs text-muted-foreground font-body">Last updated</p>
                    <p className="text-xs font-medium font-body">{lastUpdated.toLocaleTimeString()}</p>
                  </div>
                )}
                <Link href="/analysis">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 sm:space-x-2 hover-lift glass-effect border-primary/20 hover:border-primary/40 bg-transparent"
                  >
                    <LineChart className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Analysis</span>
                  </Button>
                </Link>
                {marketAnalytics && (
                  <Button
                    onClick={() => setShowAnalytics(!showAnalytics)}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1 sm:space-x-2 hover-lift glass-effect border-primary/20 hover:border-primary/40 bg-transparent"
                  >
                    <LineChart className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Quick View</span>
                  </Button>
                )}
                <Button
                  onClick={toggleDarkMode}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-1 sm:space-x-2 hover-lift glass-effect border-primary/20 hover:border-primary/40 bg-transparent"
                >
                  {isDarkMode ? <Sun className="h-3 w-3 sm:h-4 sm:w-4" /> : <Moon className="h-3 w-3 sm:h-4 sm:w-4" />}
                  <span className="hidden sm:inline">{isDarkMode ? "Light" : "Dark"}</span>
                </Button>
                <Button
                  onClick={fetchStockData}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-1 sm:space-x-2 hover-lift glass-effect border-primary/20 hover:border-primary/40 bg-transparent text-xs sm:text-sm"
                >
                  <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8">
          {showAnalytics && marketAnalytics && (
            <Card className="mb-6 sm:mb-8 hover-lift glass-effect border-primary/10 animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 font-heading">
                  <LineChart className="h-5 w-5 text-primary" />
                  <span>Market Analytics ({marketAnalytics.totalDataPoints} data points)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="text-sm text-muted-foreground">Market Trend</div>
                    <div
                      className={`text-lg font-bold ${
                        marketAnalytics.marketTrend === "bullish"
                          ? "text-chart-3"
                          : marketAnalytics.marketTrend === "bearish"
                            ? "text-chart-5"
                            : "text-muted-foreground"
                      }`}
                    >
                      {marketAnalytics.marketTrend.toUpperCase()}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/20">
                    <div className="text-sm text-muted-foreground">Avg Volume</div>
                    <div className="text-lg font-bold text-secondary">
                      {(marketAnalytics.avgVolume / 1000).toFixed(0)}K
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-chart-3/5 border border-chart-3/20">
                    <div className="text-sm text-muted-foreground">Volatility Index</div>
                    <div className="text-lg font-bold text-chart-3">{marketAnalytics.volatilityIndex.toFixed(1)}</div>
                  </div>

                  <div className="p-4 rounded-lg bg-chart-4/5 border border-chart-4/20">
                    <div className="text-sm text-muted-foreground">Data Points</div>
                    <div className="text-lg font-bold text-chart-4">{marketAnalytics.totalDataPoints}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-chart-3">Top Performers (Avg Change)</h4>
                    <div className="space-y-2">
                      {marketAnalytics.topPerformers.map((stock, index) => (
                        <div
                          key={stock.symbol}
                          className="flex justify-between items-center p-3 rounded-lg bg-chart-3/5 border border-chart-3/20"
                        >
                          <span className="font-medium">{stock.symbol}</span>
                          <span className="text-chart-3 font-bold">+{stock.avgChange.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-chart-5">Worst Performers (Avg Change)</h4>
                    <div className="space-y-2">
                      {marketAnalytics.worstPerformers.map((stock, index) => (
                        <div
                          key={stock.symbol}
                          className="flex justify-between items-center p-3 rounded-lg bg-chart-5/5 border border-chart-5/20"
                        >
                          <span className="font-medium">{stock.symbol}</span>
                          <span className="text-chart-5 font-bold">{stock.avgChange.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <Card
              className="hover-lift glass-effect border-primary/10 animate-slide-up"
              style={{ animationDelay: "0.1s" }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium font-heading">Market Cap</CardTitle>
                <div className="p-1 sm:p-2 rounded-full bg-primary/10">
                  <DollarSign className="h-3 w-3 sm:h-5 sm:w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="pb-3 sm:pb-6">
                <div className="text-sm sm:text-xl lg:text-2xl font-bold font-heading text-primary">
                  {(totalMarketCap / 1000000000).toFixed(1)}B
                </div>
                <p className="text-xs text-muted-foreground font-body mt-1 hidden sm:block">
                  Across {stockData.length} companies
                </p>
              </CardContent>
            </Card>

            <Card
              className="hover-lift glass-effect border-primary/10 animate-slide-up"
              style={{ animationDelay: "0.2s" }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium font-heading">Volume</CardTitle>
                <div className="p-1 sm:p-2 rounded-full bg-secondary/10">
                  <Activity className="h-3 w-3 sm:h-5 sm:w-5 text-secondary" />
                </div>
              </CardHeader>
              <CardContent className="pb-3 sm:pb-6">
                <div className="text-sm sm:text-xl lg:text-2xl font-bold text-secondary">
                  {(totalVolume / 1000).toFixed(0)}K
                </div>
                <p className="text-xs text-muted-foreground font-body mt-1 hidden sm:block">Shares traded</p>
              </CardContent>
            </Card>

            <Link href="/gainers-losers">
              <Card
                className="hover-lift glass-effect border-primary/10 animate-slide-up cursor-pointer hover:border-primary/30 transition-all duration-300"
                style={{ animationDelay: "0.3s" }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm font-medium font-heading">Gainers</CardTitle>
                  <div className="p-1 sm:p-2 rounded-full bg-chart-3/10">
                    <TrendingUp className="h-3 w-3 sm:h-5 sm:w-5 text-chart-3" />
                  </div>
                </CardHeader>
                <CardContent className="pb-3 sm:pb-6">
                  <div className="text-sm sm:text-xl lg:text-2xl font-bold text-chart-3 font-heading">{gainers}</div>
                  <p className="text-xs text-muted-foreground font-body mt-1 hidden sm:block">View details →</p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/gainers-losers">
              <Card
                className="hover-lift glass-effect border-primary/10 animate-slide-up cursor-pointer hover:border-primary/30 transition-all duration-300"
                style={{ animationDelay: "0.4s" }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm font-medium font-heading">Losers</CardTitle>
                  <div className="p-1 sm:p-2 rounded-full bg-chart-5/10">
                    <TrendingDown className="h-3 w-3 sm:h-5 sm:w-5 text-chart-5" />
                  </div>
                </CardHeader>
                <CardContent className="pb-3 sm:pb-6">
                  <div className="text-sm sm:text-xl lg:text-2xl font-bold text-chart-5 font-heading">{losers}</div>
                  <p className="text-xs text-muted-foreground font-body mt-1 hidden sm:block">View details →</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {error && (
            <Card className="mb-6 border-destructive/50 bg-destructive/5 hover-lift animate-slide-up">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-3 text-destructive">
                  <div className="p-2 rounded-full bg-destructive/10">
                    <Activity className="h-4 w-4" />
                  </div>
                  <p className="font-body">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card
            className="hover-lift glass-effect border-primary/10 animate-slide-up"
            style={{ animationDelay: "0.5s" }}
          >
            <CardHeader className="border-b border-border/50 px-3 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <CardTitle className="flex items-center space-x-2 font-heading text-sm sm:text-base">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <span>Live Stock Prices</span>
                  {searchQuery && (
                    <span className="text-xs text-muted-foreground">
                      ({filteredStocks.length} of {stockData.length})
                    </span>
                  )}
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search stocks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full sm:w-64 glass-effect border-primary/20 focus:border-primary/40 bg-transparent text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left py-2 sm:py-4 px-2 sm:px-6 font-medium font-heading text-xs sm:text-sm">
                        Symbol
                      </th>
                      <th className="text-right py-2 sm:py-4 px-2 sm:px-6 font-medium font-heading text-xs sm:text-sm">
                        Price
                      </th>
                      <th className="text-right py-2 sm:py-4 px-2 sm:px-6 font-medium font-heading text-xs sm:text-sm">
                        Change
                      </th>
                      <th className="text-right py-2 sm:py-4 px-2 sm:px-6 hidden sm:table-cell">Volume</th>
                      <th className="text-right py-2 sm:py-4 px-2 sm:px-6 hidden lg:table-cell">Bid</th>
                      <th className="text-right py-2 sm:py-4 px-2 sm:px-6 hidden lg:table-cell">Offer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index} className="border-b border-border/30">
                          <td className="py-2 sm:py-4 px-2 sm:px-6">
                            <Skeleton className="h-3 sm:h-4 w-12 sm:w-16" />
                          </td>
                          <td className="py-2 sm:py-4 px-2 sm:px-6">
                            <Skeleton className="h-3 sm:h-4 w-16 sm:w-20" />
                          </td>
                          <td className="py-2 sm:py-4 px-2 sm:px-6">
                            <Skeleton className="h-3 sm:h-4 w-12 sm:w-16" />
                          </td>
                          <td className="py-2 sm:py-4 px-2 sm:px-6 hidden sm:table-cell">
                            <Skeleton className="h-3 sm:h-4 w-16 sm:w-20" />
                          </td>
                          <td className="py-2 sm:py-4 px-2 sm:px-6 hidden lg:table-cell">
                            <Skeleton className="h-3 sm:h-4 w-12 sm:w-16" />
                          </td>
                          <td className="py-2 sm:py-4 px-2 sm:px-6 hidden lg:table-cell">
                            <Skeleton className="h-3 sm:h-4 w-12 sm:w-16" />
                          </td>
                        </tr>
                      ))
                    ) : filteredStocks.length > 0 ? (
                      filteredStocks.map((stock, index) => (
                        <tr
                          key={stock.symbol}
                          className={`border-b border-border/30 hover:bg-primary/5 cursor-pointer transition-all duration-200 ${
                            index % 2 === 0 ? "bg-muted/10" : ""
                          }`}
                          onClick={() => handleStockClick(stock)}
                        >
                          <td className="py-2 sm:py-4 px-2 sm:px-6">
                            <span className="font-medium font-heading text-primary text-xs sm:text-sm">
                              {stock.symbol}
                            </span>
                          </td>
                          <td className="py-2 sm:py-4 px-2 sm:px-6 text-right font-medium font-body text-xs sm:text-sm">
                            {stock.price.toLocaleString()}
                          </td>
                          <td className="py-2 sm:py-4 px-2 sm:px-6 text-right">
                            <span
                              className={`font-medium font-body text-xs sm:text-sm ${stock.change >= 0 ? "text-chart-3" : "text-chart-5"}`}
                            >
                              {stock.change >= 0 ? "+" : ""}
                              {stock.change.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-2 sm:py-4 px-2 sm:px-6 text-right text-xs text-muted-foreground font-body hidden sm:table-cell">
                            {formatNumber(stock.volume)}
                          </td>
                          <td className="py-2 sm:py-4 px-2 sm:px-6 text-right text-xs text-muted-foreground font-body hidden lg:table-cell">
                            {stock.bestBidPrice ? stock.bestBidPrice.toLocaleString() : "-"}
                          </td>
                          <td className="py-2 sm:py-4 px-2 sm:px-6 text-right text-xs text-muted-foreground font-body hidden lg:table-cell">
                            {stock.bestOfferPrice ? stock.bestOfferPrice.toLocaleString() : "-"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          <div className="flex flex-col items-center space-y-2">
                            <Search className="h-8 w-8 text-muted-foreground/50" />
                            <p className="text-sm">No stocks found matching "{searchQuery}"</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      {selectedStock && (
        <div className="fixed inset-x-0 bottom-0 top-20 lg:right-0 lg:top-0 lg:left-auto lg:inset-x-auto lg:h-full lg:w-96 bg-background border-t lg:border-l lg:border-t-0 border-border/50 shadow-2xl z-50 animate-slide-up-mobile overflow-hidden rounded-t-2xl lg:rounded-none flex flex-col">
          <div className="glass-effect border-b p-3 lg:p-4 flex-shrink-0 bg-background/95 backdrop-blur-sm z-20 relative">
            <div className="flex items-center justify-between mb-2 lg:mb-3">
              <div className="flex-1 mr-3">
                <h2 className="text-base lg:text-lg font-bold text-foreground font-heading">{selectedStock.symbol}</h2>
                <p className="text-xs lg:text-sm text-muted-foreground font-body leading-tight mb-2">
                  {selectedStock.name}
                </p>
                <div className="text-lg lg:text-2xl font-bold font-heading text-primary">
                  {selectedStock.price.toLocaleString()}
                </div>
              </div>
              <Button onClick={handleBackClick} variant="ghost" size="sm" className="hover:bg-primary/10 flex-shrink-0">
                <X className="h-4 w-4 lg:h-5 lg:w-5" />
              </Button>
            </div>
          </div>

          {stockDetail && (
            <div className="bg-background/95 backdrop-blur-sm border-b border-border/30 p-3 lg:p-4 space-y-3 lg:space-y-4 flex-shrink-0 z-10 relative">
              <div className="grid grid-cols-2 gap-2 lg:gap-3">
                <Card className="glass-effect border-primary/10">
                  <CardHeader className="pb-1 lg:pb-2 p-2 lg:p-3">
                    <CardTitle className="text-xs font-medium font-heading flex items-center">
                      <TrendingUp className="h-3 w-3 text-chart-3 mr-1" />
                      Best Buy
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 lg:p-3 pt-0">
                    <div className="text-sm lg:text-lg font-bold text-chart-3 font-heading">
                      {stockDetail.bestBuyPrice.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-effect border-primary/10">
                  <CardHeader className="pb-1 lg:pb-2 p-2 lg:p-3">
                    <CardTitle className="text-xs font-medium font-heading flex items-center">
                      <TrendingDown className="h-3 w-3 text-chart-5 mr-1" />
                      Best Sell
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 lg:p-3 pt-0">
                    <div className="text-sm lg:text-lg font-bold text-chart-5 font-heading">
                      {stockDetail.bestSellPrice > 0 ? stockDetail.bestSellPrice.toLocaleString() : "N/A"}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {(() => {
                const orderStats = calculateOrderStats(stockDetail.orders)
                return (
                  <div className="space-y-2 lg:space-y-3">
                    <h3 className="text-sm lg:text-base font-semibold font-heading">Order Statistics</h3>

                    <div className="grid grid-cols-2 gap-2 lg:gap-3">
                      <div className="p-2 lg:p-3 rounded-lg bg-chart-3/5 border border-chart-3/20">
                        <div className="text-xs text-chart-3 font-medium">Buy Volume</div>
                        <div className="text-sm lg:text-base font-bold text-chart-3">
                          {orderStats.totalBuyQuantity.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Avg: {orderStats.avgBuyPrice.toFixed(0)}</div>
                      </div>

                      <div className="p-2 lg:p-3 rounded-lg bg-chart-5/5 border border-chart-5/20">
                        <div className="text-xs text-chart-5 font-medium">Sell Volume</div>
                        <div className="text-sm lg:text-base font-bold text-chart-5">
                          {orderStats.totalSellQuantity.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Avg: {orderStats.avgSellPrice > 0 ? orderStats.avgSellPrice.toFixed(0) : "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0">
            {stockDetail && (
              <div className="p-3 lg:p-4 pb-6 lg:pb-8">
                <div className="space-y-2 lg:space-y-3">
                  <h3 className="text-sm lg:text-base font-semibold font-heading flex items-center">
                    <Sparkles className="h-4 w-4 text-primary mr-2" />
                    Market Orders
                  </h3>

                  {detailLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                          <Skeleton className="h-3 lg:h-4 w-12 lg:w-16" />
                          <Skeleton className="h-3 lg:h-4 w-16 lg:w-20" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stockDetail.orders.map((order, index) => (
                        <div key={index} className="p-3 rounded-lg bg-muted/10 border border-border/30">
                          <div className="space-y-2 text-xs lg:text-sm">
                            {order.buyQuantity > 0 && (
                              <div className="flex justify-between items-center text-chart-3">
                                <div className="font-medium">Buy: {order.buyPrice.toLocaleString()}</div>
                                <div className="font-semibold">Qty: {order.buyQuantity.toLocaleString()}</div>
                              </div>
                            )}
                            {order.sellQuantity > 0 && (
                              <div className="flex justify-between items-center text-chart-5">
                                <div className="font-medium">Sell: {order.sellPrice.toLocaleString()}</div>
                                <div className="font-semibold">Qty: {order.sellQuantity.toLocaleString()}</div>
                              </div>
                            )}
                            {order.buyQuantity > 0 && order.sellQuantity > 0 && (
                              <div className="text-xs text-muted-foreground border-t pt-1">
                                Spread: {Math.abs(order.sellPrice - order.buyPrice).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
