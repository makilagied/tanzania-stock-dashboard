import { NextRequest, NextResponse } from "next/server"
import { getShareIndices } from "@/lib/market-data"

const defaultFromDate = () => {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1)
  }
  return date.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get("from") || defaultFromDate()
    const payload = await getShareIndices(from)
    return NextResponse.json({ success: payload.success, from, data: payload.data })
  } catch {
    return NextResponse.json({ success: false, data: [], error: "Unable to fetch indices right now." }, { status: 200 })
  }
}
