"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, RefreshCw, BarChart3, ArrowLeft, Moon, Sun } from "lucide-react"
import Link from "next/link"

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

export default function GainersLosersPage() {
  const [stockData, setStockData] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)

  const fetchStockData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("https://api.dse.co.tz/api/market-data?isBond=false")

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

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
    } catch (err) {
      console.error("Error fetching stock data:", err)
      setError("Failed to fetch market data. Please try again.")

      const mockData: StockData[] = [
        {
          id: "1",
          symbol: "MCB",
          name: "MWALIMU COMMERCIAL BANK PLC",
          price: 360.0,
          change: 15.0,
          changePercent: 4.35,
          volume: 45000,
          marketCap: 22256971200,
          bestBidPrice: 350.0,
          bestOfferPrice: 365.0,
          openingPrice: 345.0,
        },
        {
          id: "2",
          symbol: "VODA",
          name: "VODACOM TANZANIA PUBLIC LIMITED COMPANY",
          price: 600.0,
          change: 25.0,
          changePercent: 4.35,
          volume: 11983,
          marketCap: 45000000000,
          bestBidPrice: 595.0,
          bestOfferPrice: 600.0,
          openingPrice: 575.0,
        },
        {
          id: "3",
          symbol: "CRDB",
          name: "CRDB BANK PLC",
          price: 185.0,
          change: 12.0,
          changePercent: 6.94,
          volume: 125000,
          marketCap: 18500000000,
          bestBidPrice: 180.0,
          bestOfferPrice: 185.0,
          openingPrice: 173.0,
        },
        {
          id: "4",
          symbol: "NMB",
          name: "NMB BANK PLC",
          price: 2850.0,
          change: -75.0,
          changePercent: -2.56,
          volume: 85000,
          marketCap: 28500000000,
          bestBidPrice: 2800.0,
          bestOfferPrice: 2850.0,
          openingPrice: 2925.0,
        },
        {
          id: "5",
          symbol: "TCC",
          name: "TANZANIA CIGARETTE COMPANY LIMITED",
          price: 3500.0,
          change: -125.0,
          changePercent: -3.45,
          volume: 32000,
          marketCap: 35000000000,
          bestBidPrice: 3450.0,
          bestOfferPrice: 3500.0,
          openingPrice: 3625.0,
        },
        {
          id: "6",
          symbol: "SWIS",
          name: "SWISSPORT TANZANIA LIMITED",
          price: 1200.0,
          change: -45.0,
          changePercent: -3.61,
          volume: 18000,
          marketCap: 12000000000,
          bestBidPrice: 1180.0,
          bestOfferPrice: 1200.0,
          openingPrice: 1245.0,
        },
      ]
      setStockData(mockData)
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }

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

  useEffect(() => {
    fetchStockData()

    const interval = setInterval(fetchStockData, 120000)
    return () => clearInterval(interval)
  }, [])

  const gainers = stockData.filter((stock) => stock.change > 0).sort((a, b) => b.change - a.change)
  const losers = stockData.filter((stock) => stock.change < 0).sort((a, b) => a.change - b.change)

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-TZ").format(value)
  }

  const StockTable = ({ stocks, type }: { stocks: StockData[]; type: "gainers" | "losers" }) => (
    <Card className="hover-lift glass-effect border-primary/10">
      <CardHeader className="border-b border-border/50 px-3 sm:px-6">
        <CardTitle className="flex items-center space-x-2 font-heading text-sm sm:text-base">
          {type === "gainers" ? (
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-chart-3" />
          ) : (
            <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-chart-5" />
          )}
          <span>{type === "gainers" ? "Top Gainers" : "Top Losers"}</span>
          <span className="text-xs sm:text-sm text-muted-foreground">({stocks.length})</span>
        </CardTitle>
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
                <th className="text-right py-2 sm:py-4 px-2 sm:px-6 font-medium font-heading text-xs sm:text-sm hidden sm:table-cell">
                  Volume
                </th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 3 }).map((_, index) => (
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
                    </tr>
                  ))
                : stocks.map((stock, index) => (
                    <tr
                      key={stock.symbol}
                      className={`border-b border-border/30 hover:bg-primary/5 transition-all duration-200 ${
                        index % 2 === 0 ? "bg-muted/10" : ""
                      }`}
                    >
                      <td className="py-2 sm:py-4 px-2 sm:px-6">
                        <span className="font-medium font-heading text-primary text-xs sm:text-sm">{stock.symbol}</span>
                      </td>
                      <td className="py-2 sm:py-4 px-2 sm:px-6 text-right font-medium font-body text-xs sm:text-sm">
                        {stock.price.toLocaleString()}
                      </td>
                      <td className="py-2 sm:py-4 px-2 sm:px-6 text-right">
                        <span
                          className={`font-medium font-body text-xs sm:text-sm ${
                            stock.change >= 0 ? "text-chart-3" : "text-chart-5"
                          }`}
                        >
                          {stock.change >= 0 ? "+" : ""}
                          {stock.change.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 sm:py-4 px-2 sm:px-6 text-right text-xs text-muted-foreground font-body hidden sm:table-cell">
                        {formatNumber(stock.volume)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && stocks.length === 0 && (
          <div className="p-6 sm:p-8 text-center text-muted-foreground">
            <div className="text-sm sm:text-base">No {type} found</div>
            <div className="text-xs sm:text-sm mt-1">All stocks are unchanged</div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      <header className="glass-effect border-b shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 sm:space-x-6">
              <Link href="/">
                <Button variant="ghost" size="sm" className="hover:bg-primary/10">
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg">
                  <BarChart3 className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
                </div>
                <div className="animate-slide-up">
                  <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-foreground font-heading">
                    Gainers & Losers
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground font-body hidden sm:block">
                    Market Performance Analysis
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
        {error && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5 hover-lift animate-slide-up">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3 text-destructive">
                <div className="p-2 rounded-full bg-destructive/10">
                  <TrendingDown className="h-4 w-4" />
                </div>
                <p className="font-body">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <StockTable stocks={gainers} type="gainers" />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <StockTable stocks={losers} type="losers" />
          </div>
        </div>

        <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
          <Card
            className="hover-lift glass-effect border-primary/10 animate-slide-up"
            style={{ animationDelay: "0.3s" }}
          >
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium font-heading flex items-center">
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-chart-3 mr-1 sm:mr-2" />
                Gainers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm sm:text-xl lg:text-2xl font-bold text-chart-3 font-heading">{gainers.length}</div>
              <p className="text-xs text-muted-foreground font-body mt-1 hidden sm:block">Stocks up</p>
            </CardContent>
          </Card>

          <Card
            className="hover-lift glass-effect border-primary/10 animate-slide-up"
            style={{ animationDelay: "0.4s" }}
          >
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium font-heading flex items-center">
                <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-chart-5 mr-1 sm:mr-2" />
                Losers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm sm:text-xl lg:text-2xl font-bold text-chart-5 font-heading">{losers.length}</div>
              <p className="text-xs text-muted-foreground font-body mt-1 hidden sm:block">Stocks down</p>
            </CardContent>
          </Card>

          <Card
            className="hover-lift glass-effect border-primary/10 animate-slide-up"
            style={{ animationDelay: "0.5s" }}
          >
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium font-heading">Biggest Gain</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm sm:text-xl lg:text-2xl font-bold text-chart-3 font-heading">
                {gainers.length > 0 ? `+${gainers[0].change.toLocaleString()}` : "0"}
              </div>
              <p className="text-xs text-muted-foreground font-body mt-1 hidden sm:block">
                {gainers.length > 0 ? gainers[0].symbol : "N/A"}
              </p>
            </CardContent>
          </Card>

          <Card
            className="hover-lift glass-effect border-primary/10 animate-slide-up"
            style={{ animationDelay: "0.6s" }}
          >
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium font-heading">Biggest Loss</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm sm:text-xl lg:text-2xl font-bold text-chart-5 font-heading">
                {losers.length > 0 ? losers[0].change.toLocaleString() : "0"}
              </div>
              <p className="text-xs text-muted-foreground font-body mt-1 hidden sm:block">
                {losers.length > 0 ? losers[0].symbol : "N/A"}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
