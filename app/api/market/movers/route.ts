import { NextResponse } from "next/server"
import { getGainersLosers } from "@/lib/market-data"

export async function GET() {
  try {
    const payload = await getGainersLosers()
    return NextResponse.json({ success: payload.success, data: payload.data })
  } catch {
    return NextResponse.json({ success: false, data: [], error: "Unable to fetch gainers and losers right now." }, { status: 200 })
  }
}
