import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getJoleneMemoryCookieName, isJoleneMemoryMasterKeyConfigured, joleneMemoryEncrypt } from "@/lib/jolene-memory-crypto-server"

const bodySchema = z.object({
  payload: z.string().min(1).max(600_000),
})

const SID_PATTERN = /^[a-f0-9]{64}$/

export async function POST(req: Request) {
  if (!isJoleneMemoryMasterKeyConfigured()) {
    return NextResponse.json({ error: "Jolene memory encryption is not configured on the server." }, { status: 503 })
  }

  const jar = await cookies()
  const value = jar.get(getJoleneMemoryCookieName())?.value
  if (!value || !SID_PATTERN.test(value)) {
    return NextResponse.json({ error: "Missing Jolene memory session. Call GET /api/ai/jolene-memory/session first." }, { status: 401 })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  }

  const blob = joleneMemoryEncrypt(value, parsed.data.payload)
  if (!blob) {
    return NextResponse.json({ error: "Encryption failed" }, { status: 500 })
  }
  return NextResponse.json({ blob })
}
