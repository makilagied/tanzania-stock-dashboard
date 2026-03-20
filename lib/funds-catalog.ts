/**
 * Unified catalog: iTrust + UTT + Faida + Inuka + Vertex + ZAN CSVs
 */

import { FAIDA_FUND, type FaidaFundMeta } from "@/lib/faida-fund-meta"
import { INUKA_FUNDS, type InukaFundMeta } from "@/lib/inuka-fund-meta"
import { ITRUST_FUNDS, type ITrustFundMeta } from "@/lib/itrust-funds"
import { UTT_FUNDS, type UTTFundMeta } from "@/lib/utt-funds"
import { VERTEX_FUNDS, type VertexFundMeta } from "@/lib/vertex-fund-meta"
import { ZAN_FUNDS, type ZanFundMeta } from "@/lib/zan-fund-meta"

export type ITrustFundMetaWithProvider = ITrustFundMeta & { provider: "itrust" }

export type FundMeta =
  | ITrustFundMetaWithProvider
  | UTTFundMeta
  | FaidaFundMeta
  | InukaFundMeta
  | VertexFundMeta
  | ZanFundMeta

export const ALL_FUNDS: FundMeta[] = [
  ...ITRUST_FUNDS.map((f) => ({ ...f, provider: "itrust" as const })),
  ...UTT_FUNDS,
  FAIDA_FUND,
  ...INUKA_FUNDS,
  ...VERTEX_FUNDS,
  ...ZAN_FUNDS,
]

export function getFundMeta(fundId: string): FundMeta | null {
  return ALL_FUNDS.find((f) => f.id === fundId) ?? null
}

export type { FaidaFundMeta, InukaFundMeta, VertexFundMeta, ZanFundMeta }
