/**
 * Server-only: reads Vertex NAV CSVs from `public/vertex-fund/`.
 */

import { readFile } from "fs/promises"
import path from "path"
import { VERTEX_FUND_DIR } from "@/lib/vertex-fund-meta"
import type { ITrustFundRecord } from "@/lib/itrust-funds"

export function getVertexCsvAbsolutePath(csvFile: string): string {
  return path.join(process.cwd(), "public", VERTEX_FUND_DIR, csvFile)
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

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim()
}

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

/**
 * Vertex files can contain:
 * - "19 March 2026"
 * - "03/12/2026" (usually MM/DD/YYYY export)
 * - sometimes numeric with '-'
 */
function parseVertexDate(raw: string): number {
  const s = raw.trim()

  const textMonth = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(s)
  if (textMonth) {
    const [, d, mon, y] = textMonth
    const m = MONTH_MAP[mon.toLowerCase()]
    if (m != null) return new Date(Number(y), m, Number(d)).getTime()
  }

  const numeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s)
  if (numeric) {
    const [, a, b, y] = numeric
    const p1 = Number(a)
    const p2 = Number(b)
    // Disambiguate where possible; fallback to MM/DD for ambiguous values.
    const dayFirst = p1 > 12
    const monthFirst = p2 > 12 || !dayFirst
    const month = monthFirst ? p1 : p2
    const day = monthFirst ? p2 : p1
    return new Date(Number(y), month - 1, day).getTime()
  }

  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

export async function loadVertexFundRecords(csvFile: string, fundName: string): Promise<ITrustFundRecord[]> {
  const abs = getVertexCsvAbsolutePath(csvFile)
  let text = await readFile(abs, "utf8")
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    throw new Error(`Vertex CSV is empty: ${csvFile}`)
  }

  const header = parseCsvLine(lines[0]).map(normalizeHeader)
  const dateIdx = header.findIndex((h) => h === "date")
  const navIdx = header.findIndex((h) => h === "nav")
  const navValueIdx = header.findIndex((h) => h.includes("fund net value"))
  const unitsIdx = header.findIndex((h) => h.includes("total number of units") || h.includes("total units"))

  if (dateIdx < 0 || navIdx < 0 || navValueIdx < 0 || unitsIdx < 0) {
    throw new Error(`Vertex CSV headers not recognized: ${csvFile}`)
  }

  const rows: ITrustFundRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    if (cells.length <= Math.max(dateIdx, navIdx, navValueIdx, unitsIdx)) continue

    const dateStr = cells[dateIdx]
    const navPerUnit = parseCommaNumber(cells[navIdx])
    const outStandingUnits = parseCommaNumber(cells[unitsIdx])
    const netAssetValue = parseCommaNumber(cells[navValueIdx])

    const dateSort = parseVertexDate(dateStr)
    rows.push({
      id: `vertex-${csvFile}-${dateStr}-${i}`,
      date: dateStr,
      dateSort,
      netAssetValue,
      outStandingUnits,
      navPerUnit,
      salePricePerUnit: navPerUnit,
      repurchasePricePerUnit: navPerUnit,
      fundName,
    })
  }

  rows.sort((a, b) => b.dateSort - a.dateSort)
  return rows
}
