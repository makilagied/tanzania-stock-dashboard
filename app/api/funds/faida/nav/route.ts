import { NextResponse } from "next/server"
import { loadFaidaFundRecords } from "@/lib/faida-fund-csv"
import { FAIDA_FUND } from "@/lib/faida-fund-meta"
import { FAIDA_CSV_PUBLIC_PATH } from "@/lib/load-fund-records"

/**
 * GET /api/funds/faida/nav
 * Returns NAV rows parsed directly from the bundled CSV under `public/faida-fund/`.
 * Same payload shape as GET /api/funds/faida-fund for consistency.
 */
export async function GET() {
  try {
    const data = await loadFaidaFundRecords()
    return NextResponse.json({
      success: true,
      fundId: FAIDA_FUND.id,
      meta: FAIDA_FUND,
      data,
      source: "csv",
      path: FAIDA_CSV_PUBLIC_PATH,
    })
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
      { status: 200 },
    )
  }
}
