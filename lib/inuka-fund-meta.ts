/**
 * Inuka funds — Orbit (metadata only; safe for client bundles).
 */

import type { ITrustFundMeta } from "@/lib/itrust-funds"

export const INUKA_FUND_DIR = "inuka-fund"

export type InukaFundMeta = ITrustFundMeta & {
  provider: "inuka"
  /** Filename under `public/inuka-fund/` */
  csvFile: string
}

export const INUKA_FUNDS: InukaFundMeta[] = [
  {
    provider: "inuka",
    id: "inuka-dozen-index",
    label: "Inuka Dozen Index Fund",
    shortLabel: "Dozen Index",
    category: "mutual-fund",
    currency: "TZS",
    csvFile: "INUKA DOZEN INDEX FUND.csv",
  },
  {
    provider: "inuka",
    id: "inuka-money-market",
    label: "Inuka Money Market Fund",
    shortLabel: "Money Market",
    category: "mutual-fund",
    currency: "TZS",
    csvFile: "INUKA MONEY MARKET FUND.csv",
  },
]
