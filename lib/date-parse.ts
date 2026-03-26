export type DateParsePreference = "day-first" | "month-first"

type ParseDateOptions = {
  preference?: DateParsePreference
  slashPreference?: DateParsePreference
  dashPreference?: DateParsePreference
}

function toUtcNoonTs(year: number, monthOneBased: number, day: number): number {
  if (!Number.isFinite(year) || !Number.isFinite(monthOneBased) || !Number.isFinite(day)) return 0
  if (monthOneBased < 1 || monthOneBased > 12 || day < 1 || day > 31) return 0
  const dt = new Date(Date.UTC(year, monthOneBased - 1, day, 12, 0, 0))
  const ts = dt.getTime()
  return Number.isFinite(ts) ? ts : 0
}

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

/**
 * Parse common fund/market date strings into a stable UTC-noon timestamp.
 * Handles:
 * - YYYY-MM-DD, YYYY/MM/DD
 * - DD-MM-YYYY / MM-DD-YYYY (with preference for ambiguous cases)
 * - DD/MM/YYYY / MM/DD/YYYY (with preference for ambiguous cases)
 * - D Month YYYY (e.g. 19 March 2026)
 */
export function parseFlexibleDateTs(raw: string, options?: ParseDateOptions): number {
  const s = String(raw ?? "").trim()
  if (!s) return 0

  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s)
  if (iso) return toUtcNoonTs(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const textMonth = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(s)
  if (textMonth) {
    const day = Number(textMonth[1])
    const month = MONTH_MAP[textMonth[2].toLowerCase()]
    const year = Number(textMonth[3])
    if (month != null) return toUtcNoonTs(year, month, day)
  }

  const numeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s)
  if (numeric) {
    const a = Number(numeric[1])
    const b = Number(numeric[2])
    const year = Number(numeric[3])
    const sep = s.includes("/") ? "/" : "-"

    if (a > 12 && b <= 12) return toUtcNoonTs(year, b, a) // dd/mm
    if (b > 12 && a <= 12) return toUtcNoonTs(year, a, b) // mm/dd

    const pref =
      sep === "/"
        ? (options?.slashPreference ?? options?.preference ?? "day-first")
        : (options?.dashPreference ?? options?.preference ?? "day-first")
    return pref === "day-first" ? toUtcNoonTs(year, b, a) : toUtcNoonTs(year, a, b)
  }

  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}
