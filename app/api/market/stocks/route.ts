import { NextResponse } from "next/server"
import { getLiveStocks } from "@/lib/market-data"

export async function GET() {
  try {
    const stocks = await getLiveStocks()
    return NextResponse.json({ data: stocks, source: "dse" })
  } catch {
    return NextResponse.json({ data: [], source: "fallback", error: "Unable to fetch stocks right now." }, { status: 200 })
  }
}
