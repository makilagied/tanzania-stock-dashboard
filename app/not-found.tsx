import type { Metadata } from "next"
import Link from "next/link"
import { BarChart3, Home, LineChart, SearchX, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotFoundChartBackground } from "@/components/not-found-chart-background"

export const metadata: Metadata = {
  title: "Page not found | Investor's Dashboard",
  description: "The page you requested could not be found.",
}

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <NotFoundChartBackground />

      <header className="relative z-10 border-b border-border/60 bg-background/40 shadow-sm backdrop-blur-md dark:bg-background/30">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-md">
              <BarChart3 className="h-4 w-4 text-primary-foreground" aria-hidden />
            </div>
            <span className="text-sm font-semibold tracking-tight">Investor&apos;s Dashboard</span>
          </Link>
          <div className="hidden items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:flex">
            <LineChart className="h-3.5 w-3.5 text-chart-3" aria-hidden />
            Live markets
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-20">
        {/* Watermark */}
        <p
          className="pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2 select-none font-[family-name:var(--font-playfair-display)] text-[clamp(5rem,22vw,12rem)] font-bold leading-none text-foreground/[0.04] dark:text-foreground/[0.06]"
          aria-hidden
        >
          404
        </p>

        <div className="animate-fade-in relative w-full max-w-lg">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-chart-3/25 via-transparent to-chart-4/20 opacity-80 blur-sm dark:from-chart-3/15 dark:to-chart-4/10" />
          <div className="relative rounded-2xl border border-border/80 bg-card/75 p-8 text-center shadow-xl backdrop-blur-xl dark:bg-card/65 sm:p-10">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-chart-3/20 to-chart-3/5 shadow-inner ring-1 ring-chart-3/20 dark:from-chart-3/15 dark:to-transparent">
              <SearchX className="h-8 w-8 text-chart-3" aria-hidden />
            </div>
            <div className="mb-1 flex items-center justify-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-chart-3/80" aria-hidden />
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-chart-3">Off the chart</p>
            </div>
            <h1 className="mt-2 font-[family-name:var(--font-playfair-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
              This page isn&apos;t on the map
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The URL may be mistyped, or the page moved. Head back to the dashboard to keep watching the market.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="gap-2 shadow-md">
                <Link href="/">
                  <Home className="h-4 w-4" aria-hidden />
                  Back to dashboard
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-border/80 bg-background/50 backdrop-blur-sm">
                <Link href="/funds">Funds &amp; ETFs</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
