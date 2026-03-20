/**
 * Faida Fund — Watumishi Housing (metadata only; safe to import from client bundles).
 */

import type { ITrustFundMeta } from "@/lib/itrust-funds"

/** Filename in `public/faida-fund/` (two spaces between FUND and NAV) */
export const FAIDA_CSV_FILENAME = "FAID FUND  NAV PERFORMANCE.csv"

export const FAIDA_FUND_DIR = "faida-fund"

export type FaidaFundMeta = ITrustFundMeta & {
  provider: "faida"
}

export const FAIDA_FUND: FaidaFundMeta = {
  provider: "faida",
  id: "faida-fund",
  label: "Faida Fund",
  shortLabel: "Faida",
  category: "mutual-fund",
  currency: "TZS",
}
