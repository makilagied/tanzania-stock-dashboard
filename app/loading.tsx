import { ChartCandlestick } from "lucide-react"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
        <div className="rounded-lg bg-primary p-2 text-primary-foreground animate-pulse">
          <ChartCandlestick className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">Loading market dashboard...</p>
          <p className="text-xs text-muted-foreground">Syncing live prices and history</p>
        </div>
      </div>
    </div>
  )
}
