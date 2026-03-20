import { NextRequest, NextResponse } from "next/server"
import { getHistoricalDataWithMeta } from "@/lib/market-data"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol } = await context.params
    const daysParam = request.nextUrl.searchParams.get("days")
    const days = Math.min(5000, Math.max(7, Number(daysParam) || 30))
    const history = await getHistoricalDataWithMeta(symbol.toUpperCase(), days)
    return NextResponse.json({
      success: history.success,
      symbol: symbol.toUpperCase(),
      days,
      data: history.data,
      current: history.current,
      message: history.message,
    })
  } catch {
    return NextResponse.json({ error: "Unable to fetch historical data." }, { status: 500 })
  }
}
