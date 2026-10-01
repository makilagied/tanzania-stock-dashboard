/**
 * Server-only client for the iTrust 360 market API (replaces the retired DSE endpoints).
 *
 * Auth: JWT access/refresh tokens kept in module memory (per Node process). On a 401 we try
 * `/auth/refresh/`, and if that fails log in again with `GOST_EMAIL` / `GOST_PASSWORD`.
 */

const ITRUST_360_BASE = "https://360.itrust.tz/api/client"
/** Re-auth this long before the JWT `exp` to avoid racing expiry. */
const TOKEN_SKEW_MS = 30_000

type Tokens = { access: string; refresh?: string; expMs: number }

let tokens: Tokens | null = null
let inflightAuth: Promise<string> | null = null
/** After a failed login, don't retry until then: repeated bad logins lock the account for ~5 min. */
const LOGIN_RETRY_COOLDOWN_MS = 5 * 60_000
let loginBlockedUntil = 0
let loginBlockedReason = ""

function jwtExpMs(jwt: string): number {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"))
    if (typeof payload.exp === "number") return payload.exp * 1000
  } catch {
    // fall through
  }
  return Date.now() + 5 * 60_000
}

function storeTokens(access: string, refresh?: string) {
  tokens = { access, refresh: refresh ?? tokens?.refresh, expMs: jwtExpMs(access) }
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${ITRUST_360_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
}

async function login(): Promise<string> {
  const email = process.env.GOST_EMAIL
  const password = process.env.GOST_PASSWORD
  if (!email || !password) throw new Error("iTrust credentials missing: set GOST_EMAIL and GOST_PASSWORD")
  if (Date.now() < loginBlockedUntil) throw new Error(loginBlockedReason)
  const res = await postJson("/auth/login/", { email, password })
  if (!res.ok) {
    loginBlockedUntil = Date.now() + LOGIN_RETRY_COOLDOWN_MS
    loginBlockedReason = `iTrust login failed: ${res.status} (retry paused for 5 min)`
    throw new Error(loginBlockedReason)
  }
  const json = await res.json()
  if (typeof json?.access !== "string") throw new Error("iTrust login: no access token in response")
  loginBlockedUntil = 0
  storeTokens(json.access, typeof json.refresh === "string" ? json.refresh : undefined)
  return json.access
}

async function refreshOrLogin(): Promise<string> {
  if (tokens?.refresh) {
    try {
      const res = await postJson("/auth/refresh/", { refresh: tokens.refresh })
      if (res.ok) {
        const json = await res.json()
        if (typeof json?.access === "string") {
          storeTokens(json.access, typeof json.refresh === "string" ? json.refresh : undefined)
          return json.access
        }
      }
    } catch {
      // fall back to a fresh login
    }
  }
  return login()
}

/** Valid access token; concurrent callers share one auth round-trip. */
async function getAccessToken(forceRenew = false): Promise<string> {
  if (!forceRenew && tokens && tokens.expMs - TOKEN_SKEW_MS > Date.now()) return tokens.access
  inflightAuth ??= refreshOrLogin().finally(() => {
    inflightAuth = null
  })
  return inflightAuth
}

/** Authenticated GET against the 360 API; retries once with a renewed token on 401. */
export async function itrustGet<T = unknown>(path: string, revalidateSeconds: number): Promise<T> {
  const doFetch = async (token: string) =>
    fetch(`${ITRUST_360_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      next: { revalidate: revalidateSeconds },
    })

  let res = await doFetch(await getAccessToken())
  if (res.status === 401) res = await doFetch(await getAccessToken(true))
  if (!res.ok) throw new Error(`iTrust 360 request failed: ${res.status} ${path}`)
  return (await res.json()) as T
}
