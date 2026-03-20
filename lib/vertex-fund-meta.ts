/**
 * Vertex funds (metadata only; safe for client bundles).
 */

import type { ITrustFundMeta } from "@/lib/itrust-funds"

export const VERTEX_FUND_DIR = "vertex-fund"

export type VertexFundMeta = ITrustFundMeta & {
  provider: "vertex"
  /** Filename under `public/vertex-fund/` */
  csvFile: string
}

export const VERTEX_FUNDS: VertexFundMeta[] = [
  {
    provider: "vertex",
    id: "vertex-bond-fund",
    label: "Vertex Bond Fund",
    shortLabel: "Vertex Bond",
    category: "mutual-fund",
    currency: "TZS",
    csvFile: "Vertex Bond Fund.csv",
  },
  {
    provider: "vertex",
    id: "vertex-etf",
    label: "Vertex ETF",
    shortLabel: "Vertex ETF",
    category: "etf",
    currency: "TZS",
    csvFile: "Vertex-ETF.csv",
  },
]
