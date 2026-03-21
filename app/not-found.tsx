import type { Metadata } from "next"
import Link from "next/link"
import { BarChart3, Home, LineChart, TrendingDown, ArrowRight, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "404 - Page Not Found | DSE Dashboard",
  description: "The page you requested could not be found.",
}

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
      {/* Animated Background Elements */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* Gradient orbs */}
        <div className="absolute -left-32 -top-32 h-96 w-96 animate-pulse rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -right-32 top-1/4 h-80 w-80 animate-pulse rounded-full bg-rose-500/10 blur-3xl" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 animate-pulse rounded-full bg-amber-500/10 blur-3xl" style={{ animationDelay: "2s" }} />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        
        {/* Floating stock tickers */}
        <div className="absolute left-[10%] top-[20%] animate-float opacity-20">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
            <span className="text-xs font-medium text-emerald-600">CRDB</span>
            <span className="text-xs text-emerald-500">+2.4%</span>
          </div>
        </div>
        <div className="absolute right-[15%] top-[30%] animate-float opacity-20" style={{ animationDelay: "0.5s" }}>
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5">
            <span className="text-xs font-medium text-rose-600">TBL</span>
            <span className="text-xs text-rose-500">-1.2%</span>
          </div>
        </div>
        <div className="absolute bottom-[30%] left-[20%] animate-float opacity-20" style={{ animationDelay: "1s" }}>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
            <span className="text-xs font-medium text-emerald-600">VODA</span>
            <span className="text-xs text-emerald-500">+0.8%</span>
          </div>
        </div>
        
        {/* Animated chart lines */}
        <svg className="absolute bottom-0 left-0 h-[40vh] w-full opacity-20" viewBox="0 0 1200 300" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
              <stop offset="50%" stopColor="rgb(16, 185, 129)" stopOpacity="1" />
              <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,200 Q150,180 300,220 T600,160 T900,200 T1200,140"
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="2"
            className="animate-draw-line"
          />
          <path
            d="M0,200 Q150,180 300,220 T600,160 T900,200 T1200,140 L1200,300 L0,300 Z"
            fill="url(#areaGrad)"
            className="animate-fade-in"
          />
        </svg>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 transition-all hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">DSE Dashboard</span>
              <span className="text-[10px] text-muted-foreground">Tanzania Stock Exchange</span>
            </div>
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LineChart className="h-4 w-4 text-emerald-500" />
            <span className="hidden sm:inline">Live Markets</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        {/* Large 404 watermark */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="select-none text-[20rem] font-black leading-none text-foreground/[0.02] sm:text-[30rem]">
            404
          </span>
        </div>

        {/* Content Card */}
        <div className="relative w-full max-w-lg">
          {/* Glow effect */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-transparent to-rose-500/20 opacity-75 blur-xl" />
          
          <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/80 shadow-2xl backdrop-blur-xl">
            {/* Top decorative bar */}
            <div className="flex h-12 items-center gap-3 border-b border-border/50 bg-muted/30 px-5">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs font-medium text-muted-foreground">Market Error</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 text-center sm:p-10">
              {/* Icon */}
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-rose-500/5 ring-1 ring-rose-500/20">
                <TrendingDown className="h-10 w-10 text-rose-500" />
              </div>

              {/* Badge */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-4 py-1.5 text-rose-600 dark:text-rose-400">
                <Coins className="h-3.5 w-3.5" />
                <span className="text-xs font-bold uppercase tracking-wider">Market Closed</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Page Not Found
              </h1>
              
              <p className="mt-4 text-muted-foreground">
                This stock ticker doesn&apos;t exist in our exchange. The page may have been moved, delisted, or you might have mistyped the URL.
              </p>

              {/* Quick stats */}
              <div className="mt-8 grid grid-cols-3 gap-4 rounded-xl border border-border/50 bg-muted/30 p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-rose-500">404</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Error Code</div>
                </div>
                <div className="text-center border-x border-border/50">
                  <div className="text-2xl font-bold">0</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Results</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-500">1</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Solution</div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-emerald-700">
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    Back to Dashboard
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2 border-border/60 bg-background/50">
                  <Link href="/funds">
                    Explore Funds
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom suggestion */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Popular pages:</span>
          <Link href="/" className="rounded-full bg-muted/50 px-3 py-1 transition-colors hover:bg-muted">
            Stocks
          </Link>
          <Link href="/funds" className="rounded-full bg-muted/50 px-3 py-1 transition-colors hover:bg-muted">
            Funds
          </Link>
        </div>
      </main>

      {/* Custom animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        @keyframes draw-line {
          0% { stroke-dasharray: 0 2000; }
          100% { stroke-dasharray: 2000 0; }
        }
        .animate-draw-line {
          animation: draw-line 3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
