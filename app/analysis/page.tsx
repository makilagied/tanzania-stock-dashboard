"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  Activity,
  ArrowLeft,
  Calendar,
  Target,
  Zap,
  Moon,
  Sun,
} from "lucide-react"

interface DailyStockData {
  date: string
  stocks: Array<{
    symbol: string
    name: string
    price: number
    change: number
    volume: number
  }>
  timestamp: number
}

interface MarketAnalytics {
  totalDays: number
  avgDailyVolume: number
  topPerformers: { symbol: string; avgChange: number }[]
  worstPerformers: { symbol: string; avgChange: number }[]
  marketTrend: "bullish" | "bearish" | "neutral"
  volatilityIndex: number
}

interface DetailedAnalytics {
  dailyTrends: Array<{
    date: string
    avgChange: number
    totalVolume: number
    activeStocks: number
  }>
  sectorAnalysis: Array<{
    sector: string
    avgPerformance: number
    stockCount: number
  }>
  volumeLeaders: Array<{
    symbol: string
    avgVolume: number
    totalDays: number
  }>
}

interface MarketDataPoint {
  timestamp: number
  date: string
  time: string
  stocks: Array<{
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
  }>
}

export default function AnalysisPage() {
  const [marketAnalytics, setMarketAnalytics] = useState<MarketAnalytics | null>(null)
  const [detailedAnalytics, setDetailedAnalytics] = useState<DetailedAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
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

  const generateDetailedAnalytics = (marketDataArray: MarketDataPoint[]) => {
    if (marketDataArray.length === 0) return null

    const dailyGroups: { [date: string]: MarketDataPoint[] } = {}
    marketDataArray.forEach((dataPoint) => {
      const dateKey = dataPoint.date
      if (!dailyGroups[dateKey]) {
        dailyGroups[dateKey] = []
      }
      dailyGroups[dateKey].push(dataPoint)
    })

    const dailyTrends = Object.entries(dailyGroups)
      .map(([date, dataPoints]) => {
        // Get the latest data point for each stock on this day
        const latestStockData: { [symbol: string]: any } = {}
        dataPoints.forEach((dataPoint) => {
          dataPoint.stocks.forEach((stock) => {
            if (!latestStockData[stock.symbol] || dataPoint.timestamp > latestStockData[stock.symbol].timestamp) {
              latestStockData[stock.symbol] = { ...stock, timestamp: dataPoint.timestamp }
            }
          })
        })

        const stocks = Object.values(latestStockData)
        const avgChange = stocks.reduce((sum: number, stock: any) => sum + stock.change, 0) / stocks.length
        const totalVolume = stocks.reduce((sum: number, stock: any) => sum + stock.volume, 0)
        const activeStocks = stocks.filter((stock: any) => stock.volume > 0).length

        return {
          date,
          avgChange,
          totalVolume,
          activeStocks,
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort by date descending

    const stockVolumes: { [symbol: string]: { totalVolume: number; days: number } } = {}
    Object.entries(dailyGroups).forEach(([date, dataPoints]) => {
      const latestStockData: { [symbol: string]: any } = {}
      dataPoints.forEach((dataPoint) => {
        dataPoint.stocks.forEach((stock) => {
          if (!latestStockData[stock.symbol] || dataPoint.timestamp > latestStockData[stock.symbol].timestamp) {
            latestStockData[stock.symbol] = stock
          }
        })
      })

      Object.values(latestStockData).forEach((stock: any) => {
        if (!stockVolumes[stock.symbol]) {
          stockVolumes[stock.symbol] = { totalVolume: 0, days: 0 }
        }
        stockVolumes[stock.symbol].totalVolume += stock.volume
        stockVolumes[stock.symbol].days += 1
      })
    })

    const volumeLeaders = Object.entries(stockVolumes)
      .map(([symbol, data]) => ({
        symbol,
        avgVolume: data.totalVolume / data.days,
        totalDays: data.days,
      }))
      .sort((a, b) => b.avgVolume - a.avgVolume)
      .slice(0, 5)

    // Mock sector analysis (since we don't have sector data)
    const sectorAnalysis = [
      { sector: "Banking", avgPerformance: 1.2, stockCount: 3 },
      { sector: "Telecommunications", avgPerformance: 0.8, stockCount: 2 },
      { sector: "Manufacturing", avgPerformance: -0.5, stockCount: 2 },
      { sector: "Insurance", avgPerformance: 0.3, stockCount: 1 },
    ]

    return {
      dailyTrends: dailyTrends.slice(0, 10), // Last 10 days
      sectorAnalysis,
      volumeLeaders,
    }
  }

  const generateAnalytics = (marketDataArray: MarketDataPoint[]) => {
    if (marketDataArray.length < 2) return null

    const dailyGroups: { [date: string]: MarketDataPoint[] } = {}
    marketDataArray.forEach((dataPoint) => {
      const dateKey = dataPoint.date
      if (!dailyGroups[dateKey]) {
        dailyGroups[dateKey] = []
      }
      dailyGroups[dateKey].push(dataPoint)
    })

    const totalDays = Object.keys(dailyGroups).length

    const dailyVolumes: number[] = []
    const dailyChanges: number[] = []
    const stockPerformance: { [symbol: string]: number[] } = {}

    Object.entries(dailyGroups).forEach(([date, dataPoints]) => {
      // Get the latest data point for each stock on this day
      const latestStockData: { [symbol: string]: any } = {}
      dataPoints.forEach((dataPoint) => {
        dataPoint.stocks.forEach((stock) => {
          if (!latestStockData[stock.symbol] || dataPoint.timestamp > latestStockData[stock.symbol].timestamp) {
            latestStockData[stock.symbol] = stock
          }
        })
      })

      const stocks = Object.values(latestStockData)
      const dayVolume = stocks.reduce((sum: number, stock: any) => sum + stock.volume, 0)
      const dayAvgChange = stocks.reduce((sum: number, stock: any) => sum + stock.change, 0) / stocks.length

      dailyVolumes.push(dayVolume)
      dailyChanges.push(dayAvgChange)

      // Track individual stock performance
      stocks.forEach((stock: any) => {
        if (!stockPerformance[stock.symbol]) {
          stockPerformance[stock.symbol] = []
        }
        stockPerformance[stock.symbol].push(stock.change)
      })
    })

    const avgDailyVolume = dailyVolumes.reduce((sum, vol) => sum + vol, 0) / dailyVolumes.length

    // Calculate performance for each stock
    const avgPerformance = Object.entries(stockPerformance).map(([symbol, changes]) => ({
      symbol,
      avgChange: changes.reduce((sum, change) => sum + change, 0) / changes.length,
    }))

    const sortedPerformance = avgPerformance.sort((a, b) => b.avgChange - a.avgChange)
    const topPerformers = sortedPerformance.slice(0, 3)
    const worstPerformers = sortedPerformance.slice(-3).reverse()

    const recentDays = dailyChanges.slice(0, Math.min(7, dailyChanges.length))
    const avgMarketChange = recentDays.reduce((sum, change) => sum + change, 0) / recentDays.length

    let marketTrend: "bullish" | "bearish" | "neutral" = "neutral"
    if (avgMarketChange > 5) marketTrend = "bullish"
    else if (avgMarketChange < -5) marketTrend = "bearish"

    const mean = avgMarketChange
    const variance = recentDays.reduce((sum, change) => sum + Math.pow(change - mean, 2), 0) / recentDays.length
    const volatilityIndex = Math.sqrt(variance)

    return {
      totalDays,
      avgDailyVolume,
      topPerformers,
      worstPerformers,
      marketTrend,
      volatilityIndex,
    }
  }

  useEffect(() => {
    const loadAnalytics = () => {
      try {
        const existingData = localStorage.getItem("dse_market_data")
        if (existingData) {
          const marketDataArray: MarketDataPoint[] = JSON.parse(existingData)

          const analytics = generateAnalytics(marketDataArray)
          const detailed = generateDetailedAnalytics(marketDataArray)

          setMarketAnalytics(analytics)
          setDetailedAnalytics(detailed)
        }
      } catch (error) {
        console.error("Error loading analytics:", error)
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading market analysis...</p>
        </div>
      </div>
    )
  }

  if (!marketAnalytics || !detailedAnalytics) {
    return (
      <div className="min-h-screen bg-background">
        <header className="glass-effect border-b shadow-lg sticky top-0 z-50">
          <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="hover:bg-primary/10">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </Link>
                <div className="flex items-center space-x-3">
                  <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg">
                    <LineChart className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground font-heading">
                      Market Analysis
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground font-body">Historical market insights</p>
                  </div>
                </div>
              </div>
              <Button
                onClick={toggleDarkMode}
                variant="outline"
                size="sm"
                className="flex items-center space-x-1 sm:space-x-2 hover-lift glass-effect border-primary/20 hover:border-primary/40 bg-transparent"
              >
                {isDarkMode ? <Sun className="h-3 w-3 sm:h-4 sm:w-4" /> : <Moon className="h-3 w-3 sm:h-4 sm:w-4" />}
                <span className="hidden sm:inline">{isDarkMode ? "Light" : "Dark"}</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 sm:px-6 py-8">
          <Card className="text-center py-12">
            <CardContent>
              <BarChart3 className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Analysis Data Available</h3>
              <p className="text-muted-foreground mb-6">
                Start using the dashboard to collect market data for analysis.
              </p>
              <Link href="/">
                <Button>Go to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      <header className="glass-effect border-b shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="hover:bg-primary/10">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg">
                  <LineChart className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground font-heading">
                    Market Analysis
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground font-body">
                    {marketAnalytics.totalDays} days of market data
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={toggleDarkMode}
              variant="outline"
              size="sm"
              className="flex items-center space-x-1 sm:space-x-2 hover-lift glass-effect border-primary/20 hover:border-primary/40 bg-transparent"
            >
              {isDarkMode ? <Sun className="h-3 w-3 sm:h-4 sm:w-4" /> : <Moon className="h-3 w-3 sm:h-4 sm:w-4" />}
              <span className="hidden sm:inline">{isDarkMode ? "Light" : "Dark"}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* Market Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card className="hover-lift glass-effect border-primary/10 animate-slide-up">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium font-heading">Market Trend</CardTitle>
              <div className="p-2 rounded-full bg-primary/10">
                {marketAnalytics.marketTrend === "bullish" ? (
                  <TrendingUp className="h-4 w-4 text-chart-3" />
                ) : marketAnalytics.marketTrend === "bearish" ? (
                  <TrendingDown className="h-4 w-4 text-chart-5" />
                ) : (
                  <Activity className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold font-heading ${
                  marketAnalytics.marketTrend === "bullish"
                    ? "text-chart-3"
                    : marketAnalytics.marketTrend === "bearish"
                      ? "text-chart-5"
                      : "text-muted-foreground"
                }`}
              >
                {marketAnalytics.marketTrend.toUpperCase()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">7-day average</p>
            </CardContent>
          </Card>

          <Card
            className="hover-lift glass-effect border-primary/10 animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium font-heading">Volatility</CardTitle>
              <div className="p-2 rounded-full bg-secondary/10">
                <Zap className="h-4 w-4 text-secondary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary font-heading">
                {marketAnalytics.volatilityIndex.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Market volatility index</p>
            </CardContent>
          </Card>

          <Card
            className="hover-lift glass-effect border-primary/10 animate-slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium font-heading">Avg Volume</CardTitle>
              <div className="p-2 rounded-full bg-chart-4/10">
                <Activity className="h-4 w-4 text-chart-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-chart-4 font-heading">
                {(marketAnalytics.avgDailyVolume / 1000).toFixed(0)}K
              </div>
              <p className="text-xs text-muted-foreground mt-1">Daily average</p>
            </CardContent>
          </Card>

          <Card
            className="hover-lift glass-effect border-primary/10 animate-slide-up"
            style={{ animationDelay: "0.3s" }}
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 font-heading">
                <Calendar className="h-5 w-5 text-chart-1" />
                <span>Data Period</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-chart-1 font-heading">{marketAnalytics.totalDays}</div>
              <p className="text-xs text-muted-foreground mt-1">Days of data</p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            className="hover-lift glass-effect border-primary/10 animate-slide-up"
            style={{ animationDelay: "0.4s" }}
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 font-heading">
                <TrendingUp className="h-5 w-5 text-chart-3" />
                <span>Top Performers</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {marketAnalytics.topPerformers.map((stock, index) => (
                  <div
                    key={stock.symbol}
                    className="flex justify-between items-center p-4 rounded-lg bg-chart-3/5 border border-chart-3/20"
                  >
                    <div>
                      <div className="font-semibold font-heading">{stock.symbol}</div>
                      <div className="text-sm text-muted-foreground">Average Change</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-chart-3">+{stock.avgChange.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">#{index + 1}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card
            className="hover-lift glass-effect border-primary/10 animate-slide-up"
            style={{ animationDelay: "0.5s" }}
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 font-heading">
                <TrendingDown className="h-5 w-5 text-chart-5" />
                <span>Worst Performers</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {marketAnalytics.worstPerformers.map((stock, index) => (
                  <div
                    key={stock.symbol}
                    className="flex justify-between items-center p-4 rounded-lg bg-chart-5/5 border border-chart-5/20"
                  >
                    <div>
                      <div className="font-semibold font-heading">{stock.symbol}</div>
                      <div className="text-sm text-muted-foreground">Average Change</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-chart-5">{stock.avgChange.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">#{index + 1}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Volume Leaders */}
        <Card className="hover-lift glass-effect border-primary/10 animate-slide-up" style={{ animationDelay: "0.6s" }}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 font-heading">
              <Target className="h-5 w-5 text-primary" />
              <span>Volume Leaders</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {detailedAnalytics.volumeLeaders.map((stock, index) => (
                <div
                  key={stock.symbol}
                  className="p-4 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold font-heading text-primary">{stock.symbol}</div>
                    <div className="text-xs text-muted-foreground">#{index + 1}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Avg Volume</div>
                    <div className="text-lg font-bold font-heading">{(stock.avgVolume / 1000).toFixed(0)}K</div>
                    <div className="text-xs text-muted-foreground">{stock.totalDays} trading days</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Trends */}
        <Card className="hover-lift glass-effect border-primary/10 animate-slide-up" style={{ animationDelay: "0.7s" }}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 font-heading">
              <BarChart3 className="h-5 w-5 text-secondary" />
              <span>Recent Daily Trends</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {detailedAnalytics.dailyTrends.map((day, index) => (
                <div
                  key={day.date}
                  className="flex justify-between items-center p-3 rounded-lg bg-muted/10 border border-border/30"
                >
                  <div>
                    <div className="font-medium font-heading">{day.date}</div>
                    <div className="text-sm text-muted-foreground">{day.activeStocks} active stocks</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${day.avgChange >= 0 ? "text-chart-3" : "text-chart-5"}`}>
                      {day.avgChange >= 0 ? "+" : ""}
                      {day.avgChange.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Vol: {(day.totalVolume / 1000).toFixed(0)}K</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
