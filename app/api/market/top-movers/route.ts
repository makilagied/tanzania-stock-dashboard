import { NextResponse } from "next/server"
import { getTopMovers } from "@/lib/market-data"

export async function GET() {
  try {
    const payload = await getTopMovers()
    return NextResponse.json({ success: payload.success, data: payload.data })
  } catch {
    return NextResponse.json({ success: false, data: [], error: "Unable to fetch top movers right now." }, { status: 200 })
  }
}
