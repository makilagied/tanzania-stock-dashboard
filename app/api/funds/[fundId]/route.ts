import { NextResponse } from "next/server"
import {
  CACHE_CONTROL_STALE_SNAPSHOT,
  cacheControlPublicSeconds,
  staleMetaHeaders,
} from "@/lib/http-cache-headers"
import { getFundMeta } from "@/lib/funds-catalog"
import { getCachedFundRecords } from "@/lib/funds-data-cached"

export async function GET(_request: Request, context: { params: Promise<{ fundId: string }> }) {
  let id: string | null = null
  try {
    const { fundId } = await context.params
    id = decodeURIComponent(fundId)
    const meta = getFundMeta(id)
    if (!meta) {
      return NextResponse.json(
        { success: false, fundId: id, meta: null, data: [], error: "Unknown fund." },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      )
    }
    const { data, stale, cachedAtMs } = await getCachedFundRecords(id, meta)
    return NextResponse.json(
      {
        success: true,
        fundId: id,
        meta,
        data,
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to fetch fund data."
    return NextResponse.json(
      { success: false, fundId: id, meta: null, data: [], error: message },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  }
}
