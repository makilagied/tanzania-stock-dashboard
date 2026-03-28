/**
 * Server-only: reads ZAN Securities NAV CSVs from `public/zan-security/`.
 */

import { readFile } from "fs/promises"
import path from "path"
import { ZAN_FUND_DIR } from "@/lib/zan-fund-meta"
import type { ITrustFundRecord } from "@/lib/itrust-funds"
import { parseFlexibleDateTs } from "@/lib/date-parse"

export function getZanCsvAbsolutePath(csvFile: string): string {
  return path.join(process.cwd(), "public", ZAN_FUND_DIR, csvFile)
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
  return h.toLowerCase().replace(/\s+/g, " ").trim()
}

function parseDate(raw: string): number {
  return parseFlexibleDateTs(raw, { preference: "day-first" })
}

export async function loadZanFundRecords(csvFile: string, fundName: string): Promise<ITrustFundRecord[]> {
  const abs = getZanCsvAbsolutePath(csvFile)
  let text = await readFile(abs, "utf8")
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    throw new Error(`ZAN CSV is empty: ${csvFile}`)
  }

  const header = parseCsvLine(lines[0]).map(normalizeHeader)
  const dateIdx = header.findIndex((h) => h === "date valued")
  const navIdx = header.findIndex((h) => h === "nav per unit")
  const navValueIdx = header.findIndex((h) => h === "net asset value")
  const unitsIdx = header.findIndex((h) => h === "outstanding number of units")
  const saleIdx = header.findIndex((h) => h === "sale price per unit")
  const repurchaseIdx = header.findIndex((h) => h === "repurchase price per unit")

  if (dateIdx < 0 || navIdx < 0 || navValueIdx < 0 || unitsIdx < 0 || saleIdx < 0 || repurchaseIdx < 0) {
    throw new Error(`ZAN CSV headers not recognized: ${csvFile}`)
  }

  const rows: ITrustFundRecord[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    if (cells.length <= Math.max(dateIdx, navIdx, navValueIdx, unitsIdx, saleIdx, repurchaseIdx)) continue

    const dateStr = cells[dateIdx]
    const dateSort = parseDate(dateStr)
    rows.push({
      id: `zan-${csvFile}-${dateStr}-${i}`,
      date: dateStr,
      dateSort,
      netAssetValue: parseCommaNumber(cells[navValueIdx]),
      outStandingUnits: parseCommaNumber(cells[unitsIdx]),
      navPerUnit: parseCommaNumber(cells[navIdx]),
      salePricePerUnit: parseCommaNumber(cells[saleIdx]),
      repurchasePricePerUnit: parseCommaNumber(cells[repurchaseIdx]),
      fundName,
    })
  }

  rows.sort((a, b) => b.dateSort - a.dateSort)
  return rows
}
