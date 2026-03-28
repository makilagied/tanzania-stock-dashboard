import { NextResponse } from "next/server"
import {
  CACHE_CONTROL_STALE_SNAPSHOT,
  cacheControlPublicSeconds,
  staleMetaHeaders,
} from "@/lib/http-cache-headers"
import { getCachedMarketOrders } from "@/lib/market-data-cached"

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> },
) {
  try {
    const { companyId } = await context.params
    const { data: orders, stale, cachedAtMs, outage } = await getCachedMarketOrders(companyId)
    return NextResponse.json(
      {
        ...orders,
        ...(outage ? { outage: true } : {}),
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
      { bestSellPrice: 0, bestBuyPrice: 0, orders: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  }
}
