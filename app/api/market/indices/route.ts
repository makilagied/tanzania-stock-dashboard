import { NextRequest, NextResponse } from "next/server"
import {
  CACHE_CONTROL_STALE_SNAPSHOT,
  cacheControlPublicSeconds,
  staleMetaHeaders,
} from "@/lib/http-cache-headers"
import { getCachedShareIndices } from "@/lib/market-data-cached"

const defaultFromDate = () => {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1)
  }
  return date.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get("from") || defaultFromDate()
    const { data: payload, stale, cachedAtMs } = await getCachedShareIndices(from)
    return NextResponse.json(
      {
        success: payload.success,
        from,
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
          "Cache-Control": stale ? CACHE_CONTROL_STALE_SNAPSHOT : cacheControlPublicSeconds(300),
          ...(stale ? staleMetaHeaders(cachedAtMs) : {}),
        },
      },
    )
  } catch {
    return NextResponse.json(
      { success: false, data: [], error: "Unable to fetch indices right now." },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  }
}
