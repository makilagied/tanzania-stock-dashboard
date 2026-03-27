"use client"

import { CloudOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type MarketDowntimeProps = {
  onRetry: () => void
  loading?: boolean
}

export function MarketDowntime({ onRetry, loading }: MarketDowntimeProps) {
  return (
    <div
      className="relative flex min-h-[min(70vh,560px)] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 px-4 py-16"
      role="alert"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-28 -top-24 h-72 w-72 animate-pulse rounded-full bg-rose-500/10 blur-3xl" />
        <div className="absolute -right-24 top-1/4 h-64 w-64 animate-pulse rounded-full bg-amber-500/10 blur-3xl" style={{ animationDelay: "1s" }} />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="select-none text-[10rem] font-black leading-none text-foreground/[0.02] sm:text-[14rem]">DSE</span>
      </div>

      <div className="relative mx-auto w-full max-w-lg">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-rose-500/20 via-transparent to-amber-500/20 opacity-80 blur-xl" />
        <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/80 shadow-2xl backdrop-blur-xl">
          <div className="flex h-12 items-center gap-3 border-b border-border/50 bg-muted/30 px-5">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-rose-500/80" />
              <div className="h-3 w-3 rounded-full bg-amber-500/80" />
              <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex-1 text-center">
              <span className="text-xs font-medium text-muted-foreground">Market status</span>
            </div>
          </div>

          <div className="p-8 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/70 ring-1 ring-border">
              <CloudOff className="h-8 w-8 text-muted-foreground" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Market data unavailable</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Haiwezekani kupata bei za soko kwa sasa. Huduma ya nje ya DSE inaweza kuwa haipo au kuchelewa - jaribu tena
              baada ya muda mfupi.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              We can&apos;t reach the live exchange feed right now, and there&apos;s no saved snapshot on this server yet.
              Retry in a moment.
            </p>

            <Button
              type="button"
              className="mt-8 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-emerald-700"
              onClick={onRetry}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
