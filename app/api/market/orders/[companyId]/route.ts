import { NextResponse } from "next/server"
import { getMarketOrders } from "@/lib/market-data"

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> },
) {
  try {
    const { companyId } = await context.params
    const orders = await getMarketOrders(companyId)
    return NextResponse.json(orders)
  } catch {
    return NextResponse.json({ bestSellPrice: 0, bestBuyPrice: 0, orders: [] }, { status: 200 })
  }
}
