/**
 * Server-only: reads Vertex NAV CSVs from `public/vertex-fund/`.
 */

import { readFile } from "fs/promises"
import path from "path"
import { VERTEX_FUND_DIR } from "@/lib/vertex-fund-meta"
import type { ITrustFundRecord } from "@/lib/itrust-funds"
import { parseFlexibleDateTs } from "@/lib/date-parse"

export function getVertexCsvAbsolutePath(csvFile: string): string {
  return path.join(process.cwd(), "public", VERTEX_FUND_DIR, csvFile)
}

function parseCommaNumber(raw: string): number {
  const s = raw.replace(/,/g, "").trim()
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function parseVertexNavPerUnit(rawNav: string, rawClosing: string | null): number {
  const nav = parseCommaNumber(rawNav)
  const closing = rawClosing != null ? parseCommaNumber(rawClosing) : 0
  if (!(nav > 0)) return closing > 0 ? closing : 0

  // Some Vertex ETF rows contain malformed NAV strings like "3,738,010"
  // instead of a realistic per-unit value near the closing price.
  if (nav > 10_000) {
    const scaled = nav / 10_000
    if (closing > 0) {
      const closeEnough = Math.abs(scaled - closing) / closing <= 0.35
      if (closeEnough) return scaled
      return closing
    }
    return scaled
  }
  return nav
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

function parseVertexDate(raw: string): number {
  // Vertex exports are commonly month-first when fully numeric (e.g. 03/12/2026).
  return parseFlexibleDateTs(raw, { preference: "month-first" })
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
  const closingIdx = header.findIndex((h) => h === "closing price")
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
    const rawClosing = closingIdx >= 0 && closingIdx < cells.length ? cells[closingIdx] : null
    const navPerUnit = parseVertexNavPerUnit(cells[navIdx], rawClosing)
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
