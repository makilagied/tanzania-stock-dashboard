import { NextResponse } from "next/server"
import {
  CACHE_CONTROL_STALE_SNAPSHOT,
  cacheControlPublicSeconds,
  staleMetaHeaders,
} from "@/lib/http-cache-headers"
import { getCachedTopMovers } from "@/lib/market-data-cached"

export async function GET() {
  try {
    const { data: payload, stale, cachedAtMs, outage } = await getCachedTopMovers()
    if (outage) {
      return NextResponse.json(
        { success: false, data: [], error: "Top movers unavailable and no cached snapshot.", outage: true },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      )
    }
    return NextResponse.json(
      {
        success: payload.success,
        data: payload.data,
        ...(stale
          ? {
              stale: true,
              ...(cachedAtMs != null ? { cachedAt: new Date(cachedAtMs).toISOString() } : {}),
            }
          : {}),
      },
      {
        headers: {
          "Cache-Control": stale ? CACHE_CONTROL_STALE_SNAPSHOT : cacheControlPublicSeconds(120),
          ...(stale ? staleMetaHeaders(cachedAtMs) : {}),
        },
      },
    )
  } catch {
    return NextResponse.json(
      { success: false, data: [], error: "Unable to fetch top movers right now." },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  }
}
