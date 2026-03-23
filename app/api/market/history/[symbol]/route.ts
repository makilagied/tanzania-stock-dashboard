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
    const { data: history, stale, cachedAtMs, outage } = await getCachedHistoricalDataWithMeta(upper, days)
    if (outage) {
      return NextResponse.json(
        {
          success: false,
          symbol: upper,
          days,
          data: [],
          current: [],
          message: history.message,
          outage: true,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      )
    }
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
      { success: false, error: "Unable to fetch historical data.", data: [], outage: true },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
