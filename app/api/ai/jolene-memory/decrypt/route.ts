import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getJoleneMemoryCookieName, isJoleneMemoryMasterKeyConfigured, joleneMemoryDecrypt } from "@/lib/jolene-memory-crypto-server"

const bodySchema = z.object({
  blob: z.string().min(1).max(700_000),
})

const SID_PATTERN = /^[a-f0-9]{64}$/

export async function POST(req: Request) {
  if (!isJoleneMemoryMasterKeyConfigured()) {
    return NextResponse.json({ error: "Jolene memory encryption is not configured on the server." }, { status: 503 })
  }

  const jar = await cookies()
  const value = jar.get(getJoleneMemoryCookieName())?.value
  if (!value || !SID_PATTERN.test(value)) {
    return NextResponse.json({ error: "Missing Jolene memory session." }, { status: 401 })
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

  const plaintext = joleneMemoryDecrypt(value, parsed.data.blob)
  if (plaintext === null) {
    return NextResponse.json({ error: "Decryption failed or data is corrupt." }, { status: 400 })
  }
  return NextResponse.json({ payload: plaintext })
}
