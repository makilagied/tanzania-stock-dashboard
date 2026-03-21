import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/**
 * Limits who can call `/api/*`:
 * - Browsers loading your UI and calling same-origin `fetch("/api/...")` send
 *   `Sec-Fetch-Site: same-origin` (cannot be set from another site’s pages).
 * - Optional `ALLOWED_ORIGINS` (comma-separated) also allows `Origin` / `Referer`
 *   matches when those headers are present.
 * - Optional `ALLOWED_API_HOSTS` restricts the `Host` header.
 * - Optional `API_ROUTE_BYPASS_SECRET`: send `Authorization: Bearer <secret>` for
 *   cron, scripts, or mobile apps (treat the secret like a password).
 *
 * This is not cryptographic API auth — anyone can replay headers outside a browser.
 * Use it to stop casual scraping and drive-by abuse; use OAuth/JWT for real protection.
 */

function parseList(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean)
}

function refererMatchesOrigin(referer: string, allowed: string[]): boolean {
  try {
    const u = new URL(referer)
    const base = `${u.protocol}//${u.host}`
    return allowed.some((o) => base === o)
  } catch {
    return false
  }
}

function isBypassAuthorized(request: NextRequest): boolean {
  const secret = process.env.API_ROUTE_BYPASS_SECRET
  if (!secret) return false
  const auth = request.headers.get("authorization")
  return auth === `Bearer ${secret}`
}

function isSameSiteBrowserRequest(request: NextRequest, allowedOrigins: string[]): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site")
  if (secFetchSite === "same-origin") return true

  if (allowedOrigins.length > 0) {
    const origin = request.headers.get("origin")
    if (origin) {
      const normalized = origin.replace(/\/$/, "")
      if (allowedOrigins.includes(normalized)) return true
    }
    const referer = request.headers.get("referer")
    if (referer && refererMatchesOrigin(referer, allowedOrigins)) return true
  }

  return false
}

function hostAllowed(request: NextRequest, allowedHosts: string[]): boolean {
  if (allowedHosts.length === 0) return true
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase()
  if (!host) return false
  return allowedHosts.map((h) => h.toLowerCase()).includes(host)
}

const HOST_SASS = [
  "Wrong door — this hostname isn’t on the guest list. Did you take a wrong turn at the exchange? 🚪",
  "That Host header is wearing a disguise. We don’t know you. Try the actual site, chief.",
]

const SAME_SITE_SASS = [
  "Oi, sneaky — what do you want? These pipes only chat with our own dashboard. Nosy! 👀",
  "Caught you poking the API without our UI. Bold. Still no. Use the app like everyone else. 😏",
  "Nice try, keyboard detective. This isn’t a public buffet — order from the kitchen (our website).",
  "403 shades of nope: you’re not coming from our pages. Who sent you? The bears? 🐻",
  "Ah yes, the classic ‘call the API from nowhere’ move. We’ve seen it. We’re not impressed.",
  "This endpoint only trusts browsers that walked in through the front door. You climbed the drainpipe.",
]

function pick<T>(items: T[], seed: string): T {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return items[h % items.length]
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  if (isBypassAuthorized(request)) {
    return NextResponse.next()
  }

  const allowedHosts = parseList(process.env.ALLOWED_API_HOSTS)
  if (!hostAllowed(request, allowedHosts)) {
    return NextResponse.json(
      {
        error: "Forbidden",
        reason: "host",
        message: pick(HOST_SASS, request.nextUrl.pathname + (request.headers.get("host") ?? "")),
      },
      { status: 403 },
    )
  }

  if (process.env.NODE_ENV === "development" && process.env.API_GUARD_STRICT_IN_DEV !== "true") {
    return NextResponse.next()
  }

  const allowedOrigins = parseList(process.env.ALLOWED_ORIGINS)

  if (isSameSiteBrowserRequest(request, allowedOrigins)) {
    return NextResponse.next()
  }

  // Production with no ALLOWED_ORIGINS: still allow only same-origin fetches
  if (allowedOrigins.length === 0 && request.headers.get("sec-fetch-site") === "same-origin") {
    return NextResponse.next()
  }

  return NextResponse.json(
    {
      error: "Forbidden",
      message: pick(SAME_SITE_SASS, request.nextUrl.pathname + (request.headers.get("user-agent") ?? "")),
    },
    { status: 403 },
  )
}

export const config = {
  matcher: ["/api/:path*"],
}
