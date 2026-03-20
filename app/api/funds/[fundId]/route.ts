import { NextResponse } from "next/server"
import { getFundMeta } from "@/lib/funds-catalog"
import { loadFundRecords } from "@/lib/load-fund-records"

export async function GET(_request: Request, context: { params: Promise<{ fundId: string }> }) {
  try {
    const { fundId } = await context.params
    const id = decodeURIComponent(fundId)
    const meta = getFundMeta(id)
    if (!meta) {
      return NextResponse.json(
        { success: false, fundId: id, meta: null, data: [], error: "Unknown fund." },
        { status: 200 },
      )
    }
    const data = await loadFundRecords(meta)
    return NextResponse.json({
      success: true,
      fundId: id,
      meta,
      data,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to fetch fund data."
    return NextResponse.json(
      { success: false, fundId: null, meta: null, data: [], error: message },
      { status: 200 },
    )
  }
}
