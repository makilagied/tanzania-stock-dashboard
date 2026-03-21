/** CDN / shared cache (s-maxage); browsers may still revalidate depending on deployment. */
export function cacheControlPublicSeconds(maxAge: number, staleWhileRevalidate = maxAge * 2) {
  return `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
}

/** When serving a last-good snapshot after upstream failure/empty — avoid CDNs pinning stale JSON for everyone. */
export const CACHE_CONTROL_STALE_SNAPSHOT = "private, max-age=0, must-revalidate"

export function staleMetaHeaders(cachedAtMs?: number) {
  const h: Record<string, string> = { "X-Served-Stale": "true" }
  if (cachedAtMs != null) h["X-Cache-Time"] = new Date(cachedAtMs).toISOString()
  return h
}
