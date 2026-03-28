/**
 * Last-good cache for server-side upstream reads (market APIs, fund NAV loads, etc.).
 *
 * - Every request tries the live `fetch` first (optionally with a timeout).
 * - If the result passes `isHealthy`, it replaces the stored snapshot for `key`.
 * - If the fetch throws, times out, or the result is unhealthy (e.g. empty), we return the
 *   previous snapshot when one exists (`stale: true`).
 * - If there is no prior snapshot, we return `emptyValue` with `outage: true`.
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
  /** Live upstream failed (or timed out) and no prior snapshot existed */
  outage?: boolean
}

type StoreEntry = { value: unknown; updatedAt: number }

const store = new Map<string, StoreEntry>()

export async function withStaleFallback<T>(options: {
  key: string
  fetch: () => Promise<T>
  isHealthy: (data: T) => boolean
  /** Returned when upstream fails and there is no cached snapshot */
  emptyValue: T
  /** If set, the fetch is raced against this timeout (slow APIs → cache fallback) */
  timeoutMs?: number
}): Promise<StaleFetchResult<T>> {
  const { key, fetch: fetchFn, isHealthy, emptyValue, timeoutMs } = options

  const runFetch = (): Promise<T> => {
    if (timeoutMs != null && timeoutMs > 0) {
      return Promise.race([
        fetchFn(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("stale-cache-timeout")), timeoutMs)
        }),
      ])
    }
    return fetchFn()
  }

  try {
    const fresh = await runFetch()
    if (isHealthy(fresh)) {
      const now = Date.now()
      store.set(key, { value: fresh, updatedAt: now })
      return { data: fresh, stale: false, cachedAtMs: now }
    }
    const prev = store.get(key)
    if (prev) {
      return { data: prev.value as T, stale: true, cachedAtMs: prev.updatedAt }
    }
    return { data: emptyValue, stale: false, outage: true }
  } catch {
    const prev = store.get(key)
    if (prev) {
      return { data: prev.value as T, stale: true, cachedAtMs: prev.updatedAt }
    }
    return { data: emptyValue, stale: false, outage: true }
  }
}
