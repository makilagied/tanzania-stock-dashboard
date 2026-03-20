import { NextResponse } from "next/server"
import { getFundById, getFundMeta } from "@/lib/itrust-funds"

export async function GET(_request: Request, context: { params: Promise<{ fundId: string }> }) {
  try {
    const { fundId } = await context.params
    const id = decodeURIComponent(fundId)
    const meta = getFundMeta(id)
    const data = await getFundById(id)
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
