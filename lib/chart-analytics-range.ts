const YMD = /^\d{4}-\d{2}-\d{2}$/

/**
 * Inclusive calendar range in UTC day bounds (for filtering `dateSort` timestamps).
 */
export function parseInclusiveYmdRange(
  rangeStart: string,
  rangeEnd: string,
): { startMs: number; endMs: number; label: string } | null {
  if (!YMD.test(rangeStart) || !YMD.test(rangeEnd)) return null
  const [ys, ms, ds] = rangeStart.split("-").map(Number)
  const [ye, me, de] = rangeEnd.split("-").map(Number)
  if ([ys, ms, ds, ye, me, de].some((n) => !Number.isFinite(n))) return null
  if (ms < 1 || ms > 12 || me < 1 || me > 12) return null
  const startMs = Date.UTC(ys, ms - 1, ds, 0, 0, 0, 0)
  const endMs = Date.UTC(ye, me - 1, de, 23, 59, 59, 999)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) return null
  return { startMs, endMs, label: `${rangeStart} → ${rangeEnd}` }
}
