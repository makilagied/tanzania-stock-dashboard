import { NextResponse } from "next/server"
import {
  CACHE_CONTROL_STALE_SNAPSHOT,
  cacheControlPublicSeconds,
  staleMetaHeaders,
} from "@/lib/http-cache-headers"
import { getCachedLiveStocks } from "@/lib/market-data-cached"

export async function GET() {
  const { data: stocks, stale, cachedAtMs, outage } = await getCachedLiveStocks()

  if (outage) {
    return NextResponse.json(
      {
        data: [],
        source: "unavailable",
        outage: true,
        error: "Live market feed is unavailable and there is no cached snapshot yet. Try again shortly.",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  }

  return NextResponse.json(
    {
      data: stocks,
      source: stale ? "dse-cache" : "dse",
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
}
