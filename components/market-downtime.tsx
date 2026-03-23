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
      className="flex min-h-[min(70vh,560px)] flex-col items-center justify-center px-4 py-16"
      role="alert"
      aria-live="polite"
    >
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <CloudOff className="h-7 w-7 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="mt-5 text-lg font-semibold tracking-tight text-foreground">Market data unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Haiwezekani kupata bei za soko kwa sasa. Huduma ya nje ya DSE inaweza kuwa haipo au kuchelewa — jaribu tena
          baada ya muda mfupi.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          We can&apos;t reach the live exchange feed right now, and there&apos;s no saved snapshot on this server yet.
          Retry in a moment.
        </p>
        <Button type="button" className="mt-8 gap-2" onClick={onRetry} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Try again
        </Button>
      </div>
    </div>
  )
}
