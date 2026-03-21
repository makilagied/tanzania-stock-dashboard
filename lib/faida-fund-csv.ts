/**
 * Server-only: reads Faida NAV CSV from `public/faida-fund/`.
 * Do not import this module from client components.
 */

import { readFile } from "fs/promises"
import path from "path"
import { FAIDA_CSV_FILENAME, FAIDA_FUND_DIR } from "@/lib/faida-fund-meta"
import type { ITrustFundRecord } from "@/lib/itrust-funds"

export function getFaidaCsvAbsolutePath(): string {
  return path.join(process.cwd(), "public", FAIDA_FUND_DIR, FAIDA_CSV_FILENAME)
}

function parseCommaNumber(raw: string): number {
  const s = raw.replace(/,/g, "").trim()
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (c === "," && !inQuotes) {
      out.push(cur.trim())
      cur = ""
      continue
    }
    cur += c
  }
  out.push(cur.trim())
  return out
}

function parseIsoDateToSort(raw: string): number {
  const t = Date.parse(raw)
  return Number.isNaN(t) ? 0 : t
}

export async function loadFaidaFundRecords(): Promise<ITrustFundRecord[]> {
  const abs = getFaidaCsvAbsolutePath()
  let text = await readFile(abs, "utf8")
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    throw new Error("Faida Fund CSV is empty or has no data rows.")
  }

  const rows: ITrustFundRecord[] = []
  const fundName = "Faida Fund (Watumishi Housing)"

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    if (cells.length < 6) continue

    const dateStr = cells[0]
    const netAssetValue = parseCommaNumber(cells[1])
    const outStandingUnits = parseCommaNumber(cells[2])
    const navPerUnit = parseCommaNumber(cells[3])
    const salePricePerUnit = parseCommaNumber(cells[4])
    const repurchasePricePerUnit = parseCommaNumber(cells[5])

    const dateSort = parseIsoDateToSort(dateStr)
    rows.push({
      id: `faida-${dateStr}-${i}`,
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
