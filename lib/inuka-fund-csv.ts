/**
 * Server-only: reads Inuka / Orbit NAV CSVs from `public/inuka-fund/`.
 * Format: unquoted comma-separated rows; DATE as DD-MM-YYYY or DD/MM/YYYY.
 */

import { readFile } from "fs/promises"
import path from "path"
import { INUKA_FUND_DIR } from "@/lib/inuka-fund-meta"
import type { ITrustFundRecord } from "@/lib/itrust-funds"
import { parseFlexibleDateTs } from "@/lib/date-parse"

export function getInukaCsvAbsolutePath(csvFile: string): string {
  return path.join(process.cwd(), "public", INUKA_FUND_DIR, csvFile)
}

function parseCommaNumber(raw: string): number {
  const s = raw.replace(/,/g, "").trim()
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/** DD-MM-YYYY or DD/MM/YYYY (day first, common in TZ) */
function parseInukaDate(raw: string): number {
  // Inuka exports are mixed: dashes are day-first, slashes are month-first.
  return parseFlexibleDateTs(raw, { dashPreference: "day-first", slashPreference: "month-first" })
}

/** Split simple CSV line (no quoted commas in these files). */
function splitCsvLine(line: string): string[] {
  return line.split(",").map((c) => c.trim())
}

/**
 * @param csvFile — e.g. `INUKA DOZEN INDEX FUND.csv`
 * @param fundName — display name stored on each row
 */
export async function loadInukaFundRecords(csvFile: string, fundName: string): Promise<ITrustFundRecord[]> {
  const abs = getInukaCsvAbsolutePath(csvFile)
  let text = await readFile(abs, "utf8")
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    throw new Error(`Inuka CSV is empty: ${csvFile}`)
  }

  const rows: ITrustFundRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    if (cells.length < 6) continue

    const dateStr = cells[0]
    const netAssetValue = parseCommaNumber(cells[1])
    const outStandingUnits = parseCommaNumber(cells[2])
    const navPerUnit = parseCommaNumber(cells[3])
    const salePricePerUnit = parseCommaNumber(cells[4])
    const repurchasePricePerUnit = parseCommaNumber(cells[5])

    const dateSort = parseInukaDate(dateStr)
    rows.push({
      id: `inuka-${csvFile}-${dateStr}-${i}`,
      date: dateStr,
      dateSort,
      netAssetValue,
      outStandingUnits,
      navPerUnit,
      salePricePerUnit,
      repurchasePricePerUnit,
      fundName,
    })
  }

  rows.sort((a, b) => b.dateSort - a.dateSort)
  return rows
}
