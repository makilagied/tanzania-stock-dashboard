import { NextResponse } from "next/server"
import {
  CACHE_CONTROL_STALE_SNAPSHOT,
  cacheControlPublicSeconds,
  staleMetaHeaders,
} from "@/lib/http-cache-headers"
import { getCachedFaidaNavRecords } from "@/lib/funds-data-cached"
import { FAIDA_FUND } from "@/lib/faida-fund-meta"
import { FAIDA_CSV_PUBLIC_PATH } from "@/lib/load-fund-records"

/**
 * GET /api/funds/faida/nav
 * Returns NAV rows parsed directly from the bundled CSV under `public/faida-fund/`.
 * Same payload shape as GET /api/funds/faida-fund for consistency.
 */
export async function GET() {
  try {
    const { data, stale, cachedAtMs, outage } = await getCachedFaidaNavRecords()
    return NextResponse.json(
      {
        success: !outage && data.length > 0,
        fundId: FAIDA_FUND.id,
        meta: FAIDA_FUND,
        data,
        ...(outage ? { outage: true, error: "Faida NAV data unavailable and no cached snapshot." } : {}),
        source: "csv",
        path: FAIDA_CSV_PUBLIC_PATH,
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
    const message = e instanceof Error ? e.message : "Unable to read Faida Fund CSV."
    return NextResponse.json(
      {
        success: false,
        fundId: FAIDA_FUND.id,
        meta: FAIDA_FUND,
        data: [],
        error: message,
        source: "csv",
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    )
  }
}
