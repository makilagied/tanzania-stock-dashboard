import { NextResponse } from "next/server"
import { isJoleneMemoryMasterKeyConfigured } from "@/lib/jolene-memory-crypto-server"

/** Whether encrypted memory can work (no cookies set or read). */
export async function GET() {
  return NextResponse.json({ configured: isJoleneMemoryMasterKeyConfigured() })
}
