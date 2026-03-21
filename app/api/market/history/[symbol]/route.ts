import { NextRequest, NextResponse } from "next/server"
import {
  CACHE_CONTROL_STALE_SNAPSHOT,
  cacheControlPublicSeconds,
  staleMetaHeaders,
} from "@/lib/http-cache-headers"
import { getCachedHistoricalDataWithMeta } from "@/lib/market-data-cached"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol } = await context.params
    const daysParam = request.nextUrl.searchParams.get("days")
    const days = Math.min(4000, Math.max(7, Number(daysParam) || 30))
    const upper = symbol.toUpperCase()
    const { data: history, stale, cachedAtMs } = await getCachedHistoricalDataWithMeta(upper, days)
    return NextResponse.json(
      {
        success: history.success,
        symbol: upper,
        days,
        data: history.data,
        current: history.current,
        message: history.message,
        ...(stale
          ? {
              stale: true,
              ...(cachedAtMs != null ? { cachedAt: new Date(cachedAtMs).toISOString() } : {}),
            }
          : {}),
      },
      {
        headers: {
          "Cache-Control": stale ? CACHE_CONTROL_STALE_SNAPSHOT : cacheControlPublicSeconds(300),
          ...(stale ? staleMetaHeaders(cachedAtMs) : {}),
        },
      },
    )
  } catch {
    return NextResponse.json(
      { error: "Unable to fetch historical data." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
