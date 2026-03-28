import type { HistoricalPoint } from "@/lib/market-data"
import type { ITrustFundRecord } from "@/lib/itrust-funds"
import type { FundMeta } from "@/lib/funds-catalog"

export function fundCurrency(meta: FundMeta): "TZS" | "USD" {
  if ("currency" in meta && (meta.currency === "USD" || meta.currency === "TZS")) return meta.currency
  return "TZS"
}

/** `rows` sorted ascending by `dateSort`. Last row with dateSort ≤ target (start of purchase day). */
export function findFundRowOnOrBefore(rows: ITrustFundRecord[], targetYmd: string): ITrustFundRecord | null {
  if (rows.length === 0) return null
  const t = Date.parse(`${targetYmd}T12:00:00`)
  if (Number.isNaN(t)) return null
  let best: ITrustFundRecord | null = null
  for (const r of rows) {
    if (r.dateSort <= t) best = r
    else break
  }
  return best
}

/** History ascending by date; closest on-or-before trading day. */
export function findHistoryCloseOnOrBefore(points: HistoricalPoint[], targetYmd: string): HistoricalPoint | null {
  if (points.length === 0) return null
  const t = Date.parse(`${targetYmd}T12:00:00`)
  if (Number.isNaN(t)) return null
  let best: HistoricalPoint | null = null
  for (const p of points) {
    const pt = Date.parse(`${p.date.slice(0, 10)}T12:00:00`)
    if (Number.isNaN(pt)) continue
    if (pt <= t) best = p
    else break
  }
  return best
}

export type FundLumpSumOk = {
  kind: "ok"
  purchaseDate: string
  amountInvested: number
  /** Units purchased using sale price at purchase */
  units: number
  purchaseSalePrice: number
  purchaseRepurchasePrice: number
  latestDate: string
  latestNavPerUnit: number
  latestRepurchasePrice: number
  /** Value if sold at latest repurchase price */
  currentValue: number
  totalReturnPct: number
  /** Years between purchase and latest observation */
  yearsHeld: number
  /** CAGR on invested amount → current value */
  cagrPct: number | null
}

export type FundLumpSumErr = { kind: "error"; message: string }

export function computeFundLumpSum(
  rows: ITrustFundRecord[],
  purchaseYmd: string,
  amountInvested: number,
): FundLumpSumOk | FundLumpSumErr {
  if (!(amountInvested > 0)) return { kind: "error", message: "Enter an amount greater than zero." }
  const sorted = [...rows].sort((a, b) => a.dateSort - b.dateSort)
  if (sorted.length === 0) return { kind: "error", message: "No NAV history for this fund yet." }

  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const purchase = findFundRowOnOrBefore(sorted, purchaseYmd)
  if (!purchase) return { kind: "error", message: "Could not parse the purchase date." }

  const purchaseStart = Date.parse(`${purchaseYmd}T12:00:00`)
  if (purchaseStart < first.dateSort) {
    return {
      kind: "error",
      message: `Data starts ${first.date.slice(0, 10)}. Pick a purchase date on or after the first NAV row.`,
    }
  }
  if (purchase.dateSort > last.dateSort) {
    return { kind: "error", message: "Purchase date is after the latest NAV in our data." }
  }

  const sale = purchase.salePricePerUnit > 0 ? purchase.salePricePerUnit : purchase.navPerUnit
  if (!(sale > 0)) return { kind: "error", message: "Invalid sale/NAV price on the purchase date." }

  const units = amountInvested / sale
  const exitPx = last.repurchasePricePerUnit > 0 ? last.repurchasePricePerUnit : last.navPerUnit
  if (!(exitPx > 0)) return { kind: "error", message: "Invalid latest repurchase/NAV price." }

  const currentValue = units * exitPx
  const totalReturnPct = ((currentValue - amountInvested) / amountInvested) * 100

  const yearsHeld = (last.dateSort - purchase.dateSort) / (365.25 * 24 * 60 * 60 * 1000)
  const mult = currentValue / amountInvested
  const cagrPct =
    yearsHeld > 1 / 365 && mult > 0 ? (Math.pow(mult, 1 / yearsHeld) - 1) * 100 : null

  return {
    kind: "ok",
    purchaseDate: purchase.date,
    amountInvested,
    units,
    purchaseSalePrice: sale,
    purchaseRepurchasePrice: purchase.repurchasePricePerUnit,
    latestDate: last.date,
    latestNavPerUnit: last.navPerUnit,
    latestRepurchasePrice: exitPx,
    currentValue,
    totalReturnPct,
    yearsHeld,
    cagrPct,
  }
}

export type StockLumpSumOk = {
  kind: "ok"
  symbol: string
  amountInvested: number
  purchaseClose: number
  purchaseDate: string
  shares: number
  currentPrice: number
  currentValue: number
  totalReturnPct: number
  yearsHeld: number
  cagrPct: number | null
}

export type StockLumpSumErr = { kind: "error"; message: string }

export function computeStockLumpSum(
  purchasePoint: HistoricalPoint,
  currentPrice: number,
  amountInvested: number,
  symbol: string,
): StockLumpSumOk | StockLumpSumErr {
  if (!(amountInvested > 0)) return { kind: "error", message: "Enter an amount greater than zero." }
  const close = purchasePoint.close
  if (!(close > 0)) return { kind: "error", message: "Invalid historical closing price." }
  if (!(currentPrice > 0)) return { kind: "error", message: "Invalid current price." }

  const shares = amountInvested / close
  const currentValue = shares * currentPrice
  const totalReturnPct = ((currentValue - amountInvested) / amountInvested) * 100

  const t0 = Date.parse(`${purchasePoint.date.slice(0, 10)}T12:00:00`)
  const t1 = Date.now()
  const yearsHeld = (t1 - t0) / (365.25 * 24 * 60 * 60 * 1000)
  const mult = currentValue / amountInvested
  const cagrPct =
    yearsHeld > 1 / 365 && mult > 0 ? (Math.pow(mult, 1 / yearsHeld) - 1) * 100 : null

  return {
    kind: "ok",
    symbol,
    amountInvested,
    purchaseClose: close,
    purchaseDate: purchasePoint.date.slice(0, 10),
    shares,
    currentPrice,
    currentValue,
    totalReturnPct,
    yearsHeld,
    cagrPct,
  }
}

/** Lump-sum compound growth: FV = PV × (1 + r)^n */
export function futureValueLumpSum(principal: number, annualRatePct: number, years: number): number {
  if (!(principal >= 0) || !(years >= 0)) return 0
  const r = annualRatePct / 100
  return principal * Math.pow(1 + r, years)
}

/** Ending value of fixed monthly contributions (payments at end of each month), annual rate. */
export function futureValueMonthlySip(
  monthly: number,
  annualRatePct: number,
  years: number,
): number {
  if (!(monthly >= 0) || !(years >= 0)) return 0
  const n = Math.round(years * 12)
  if (n <= 0) return 0
  const r = annualRatePct / 100
  const rm = r / 12
  if (Math.abs(rm) < 1e-12) return monthly * n
  return monthly * ((Math.pow(1 + rm, n) - 1) / rm)
}
