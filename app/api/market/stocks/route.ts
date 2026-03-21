import { NextResponse } from "next/server"
import {
  CACHE_CONTROL_STALE_SNAPSHOT,
  cacheControlPublicSeconds,
  staleMetaHeaders,
} from "@/lib/http-cache-headers"
import { getCachedLiveStocks } from "@/lib/market-data-cached"

export async function GET() {
  try {
    const { data: stocks, stale, cachedAtMs } = await getCachedLiveStocks()
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
  } catch {
    return NextResponse.json(
      { data: [], source: "fallback", error: "Unable to fetch stocks right now." },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  }
}
