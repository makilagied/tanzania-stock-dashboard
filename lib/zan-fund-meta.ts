/**
 * ZAN Securities funds (metadata only; safe for client bundles).
 */

import type { ITrustFundMeta } from "@/lib/itrust-funds"

export const ZAN_FUND_DIR = "zan-security"

export type ZanFundMeta = ITrustFundMeta & {
  provider: "zan"
  csvFile: string
}

export const ZAN_FUNDS: ZanFundMeta[] = [
  {
    provider: "zan",
    id: "zan-timiza-fund",
    label: "TIMIZA Fund",
    shortLabel: "TIMIZA",
    category: "mutual-fund",
    currency: "TZS",
    csvFile: "TIMIZA Fund Performance.csv",
  },
]
