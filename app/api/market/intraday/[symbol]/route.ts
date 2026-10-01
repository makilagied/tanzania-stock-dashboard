import { NextResponse } from "next/server"
import {
  CACHE_CONTROL_STALE_SNAPSHOT,
  cacheControlPublicSeconds,
  staleMetaHeaders,
} from "@/lib/http-cache-headers"
import { getCachedIntraday } from "@/lib/market-data-cached"

export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol } = await context.params
    const upper = symbol.toUpperCase()
    const { data, stale, cachedAtMs, outage } = await getCachedIntraday(upper)
    if (outage) {
      return NextResponse.json(
        { ...data, symbol: upper, outage: true },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      )
    }
    return NextResponse.json(
      {
        ...data,
        symbol: upper,
        ...(stale
          ? {
              stale: true,
              ...(cachedAtMs != null ? { cachedAt: new Date(cachedAtMs).toISOString() } : {}),
            }
          : {}),
      },
      {
        headers: {
          "Cache-Control": stale ? CACHE_CONTROL_STALE_SNAPSHOT : cacheControlPublicSeconds(60),
          ...(stale ? staleMetaHeaders(cachedAtMs) : {}),
        },
      },
    )
  } catch {
    return NextResponse.json(
      { success: false, points: [], outage: true },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  }
}
