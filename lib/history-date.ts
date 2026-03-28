/**
 * Shared parsing for DSE / API history date strings (ISO, DD/MM/YYYY, etc.).
 * Chart code (Apex) requires ISO YYYY-MM-DD for `new Date(\`${date}T00:00:00Z\`)`.
 */

/** Parse history date strings to a stable UTC-noon timestamp for sorting/filtering. */
export function parseStockHistoryDateTs(dateStr: string): number {
  const s = String(dateStr ?? "").trim()
  if (!s) return 0
  const isoHead = s.slice(0, 10)
  let ts = Date.parse(`${isoHead}T12:00:00Z`)
  if (Number.isFinite(ts)) return ts
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s)
  if (m) {
    const day = Number(m[1])
    const month = Number(m[2]) - 1
    const year = Number(m[3])
    const dt = new Date(Date.UTC(year, month, day, 12, 0, 0))
    return Number.isFinite(dt.getTime()) ? dt.getTime() : 0
  }
  ts = Date.parse(s)
  return Number.isFinite(ts) ? ts : 0
}

/** Normalize any supported history date to UTC calendar YYYY-MM-DD for charts and deduping. */
export function historyDateToIsoDate(raw: string): string | null {
  const ts = parseStockHistoryDateTs(raw)
  if (!(ts > 0)) return null
  const d = new Date(ts)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
