/** iTrust Finance fund APIs — consumed via Next.js routes (server-side). */
import { parseFlexibleDateTs } from "@/lib/date-parse"

export type FundCategory = "mutual-fund" | "etf"

export type ITrustFundMeta = {
  /** Path segment for `https://api.itrust.co.tz/api/fund/{id}` */
  id: string
  label: string
  shortLabel: string
  category: FundCategory
  /** Display currency for per-unit prices */
  currency: "TZS" | "USD"
}

/** All funds under iTrust Finance as requested */
export const ITRUST_FUNDS: ITrustFundMeta[] = [
  { id: "iCash", label: "iCash", shortLabel: "Cash", category: "mutual-fund", currency: "TZS" },
  { id: "iGrowth", label: "iGrowth", shortLabel: "Growth", category: "mutual-fund", currency: "TZS" },
  { id: "iSave", label: "iSave", shortLabel: "Save", category: "mutual-fund", currency: "TZS" },
  { id: "iIncome", label: "iIncome", shortLabel: "Income", category: "mutual-fund", currency: "TZS" },
  { id: "Imaan", label: "Imaan", shortLabel: "Imaan", category: "mutual-fund", currency: "TZS" },
  { id: "iDollar", label: "iDollar", shortLabel: "Dollar", category: "mutual-fund", currency: "USD" },
  { id: "iEACLC-ETF", label: "iEACLC ETF", shortLabel: "EAC LC", category: "etf", currency: "TZS" },
]

const ITRUST_BASE = "https://api.itrust.co.tz/api/fund"

export interface ITrustFundRecord {
  id: string
  date: string
  dateSort: number
  netAssetValue: number
  outStandingUnits: number
  navPerUnit: number
  salePricePerUnit: number
  repurchasePricePerUnit: number
  fundName: string
}

const toNum = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Parse API date like "3/18/2026" to timestamp for sorting */
export const parseITrustDate = (raw: string): number => {
  return parseFlexibleDateTs(raw, { preference: "month-first" })
}

export const normalizeFundPayload = (raw: unknown[]): ITrustFundRecord[] => {
  if (!Array.isArray(raw)) return []
  const rows: ITrustFundRecord[] = raw.map((item: any) => {
    const dateStr = String(item?.date ?? "")
    return {
      id: String(item?._id ?? ""),
      date: dateStr,
      dateSort: parseITrustDate(dateStr),
      netAssetValue: toNum(item?.netAssetValue),
      outStandingUnits: toNum(item?.outStandingUnits),
      navPerUnit: toNum(item?.navPerUnit),
      salePricePerUnit: toNum(item?.salePricePerUnit),
      repurchasePricePerUnit: toNum(item?.repurchasePricePerUnit),
      fundName: String(item?.fundName ?? ""),
    }
  })
  rows.sort((a, b) => b.dateSort - a.dateSort)
  return rows
}

export const getFundById = async (fundId: string): Promise<ITrustFundRecord[]> => {
  const url = `${ITRUST_BASE}/${encodeURIComponent(fundId)}`
  const response = await fetch(url, {
    next: { revalidate: 300 },
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(`iTrust fund request failed: ${response.status}`)
  }
  const payload = await response.json()
  return normalizeFundPayload(Array.isArray(payload) ? payload : [])
}

export const getFundMeta = (fundId: string) => ITRUST_FUNDS.find((f) => f.id === fundId) ?? null
