import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import {
  getJoleneMemoryCookieName,
  isJoleneMemoryMasterKeyConfigured,
  newJoleneMemorySessionId,
} from "@/lib/jolene-memory-crypto-server"

const SID_PATTERN = /^[a-f0-9]{64}$/

export async function GET() {
  const configured = isJoleneMemoryMasterKeyConfigured()
  if (!configured) {
    return NextResponse.json({
      ok: true,
      persistence: false,
      reason: "JOLENE_MEMORY_MASTER_KEY is not set on the server.",
    })
  }

  const name = getJoleneMemoryCookieName()
  const jar = await cookies()
  const existing = jar.get(name)?.value
  if (existing && SID_PATTERN.test(existing)) {
    return NextResponse.json({ ok: true, persistence: true })
  }

  const sid = newJoleneMemorySessionId()
  const res = NextResponse.json({ ok: true, persistence: true })
  res.cookies.set(name, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  })
  return res
}

const CLEAR_COOKIE = {
  path: "/",
  maxAge: 0,
} as const

/** Clears the Jolene memory session cookie (opt-out or reset). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  const name = getJoleneMemoryCookieName()
  res.cookies.set(name, "", {
    ...CLEAR_COOKIE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  return res
}
