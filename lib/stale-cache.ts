/**
 * Last-good cache for server-side upstream reads (market APIs, fund NAV loads, etc.).
 *
 * - Every request tries the live `fetch` first.
 * - If the result passes `isHealthy`, it replaces the stored snapshot for `key`.
 * - If the fetch throws or the result is unhealthy (e.g. empty), we return the
 *   previous snapshot when one exists (`stale: true`).
 *
 * Note: storage is per Node process (each serverless instance has its own map).
 * For cross-instance durability, add Redis with the same key/TTL semantics.
 */

export type StaleFetchResult<T> = {
  data: T
  /** True when `data` comes from a prior successful response, not the latest fetch */
  stale: boolean
  /** When this snapshot was last written after a healthy upstream response */
  cachedAtMs?: number
}

type StoreEntry = { value: unknown; updatedAt: number }

const store = new Map<string, StoreEntry>()

export async function withStaleFallback<T>(options: {
  key: string
  fetch: () => Promise<T>
  isHealthy: (data: T) => boolean
}): Promise<StaleFetchResult<T>> {
  const { key, fetch: fetchFn, isHealthy } = options

  try {
    const fresh = await fetchFn()
    if (isHealthy(fresh)) {
      const now = Date.now()
      store.set(key, { value: fresh, updatedAt: now })
      return { data: fresh, stale: false, cachedAtMs: now }
    }
    const prev = store.get(key)
    if (prev) {
      return { data: prev.value as T, stale: true, cachedAtMs: prev.updatedAt }
    }
    return { data: fresh, stale: false }
  } catch (err) {
    const prev = store.get(key)
    if (prev) {
      return { data: prev.value as T, stale: true, cachedAtMs: prev.updatedAt }
    }
    throw err
  }
}
