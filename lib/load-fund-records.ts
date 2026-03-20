/**
 * Server-only: loads fund NAV rows by provider. Used by API routes.
 */

import { loadFaidaFundRecords } from "@/lib/faida-fund-csv"
import { FAIDA_CSV_FILENAME, FAIDA_FUND_DIR } from "@/lib/faida-fund-meta"
import { loadInukaFundRecords } from "@/lib/inuka-fund-csv"
import type { FundMeta } from "@/lib/funds-catalog"
import { getFundById, type ITrustFundRecord } from "@/lib/itrust-funds"
import { fetchUttFundHistory } from "@/lib/utt-funds"
import { loadVertexFundRecords } from "@/lib/vertex-fund-csv"
import { VERTEX_FUND_DIR } from "@/lib/vertex-fund-meta"
import { loadZanFundRecords } from "@/lib/zan-fund-csv"
import { ZAN_FUND_DIR } from "@/lib/zan-fund-meta"

export async function loadFundRecords(meta: FundMeta): Promise<ITrustFundRecord[]> {
  if (meta.provider === "itrust") {
    return getFundById(meta.id)
  }
  if (meta.provider === "faida") {
    return loadFaidaFundRecords()
  }
  if (meta.provider === "inuka") {
    return loadInukaFundRecords(meta.csvFile, `${meta.label} (Orbit)`)
  }
  if (meta.provider === "vertex") {
    return loadVertexFundRecords(meta.csvFile, `${meta.label} (Vertex)`)
  }
  if (meta.provider === "zan") {
    return loadZanFundRecords(meta.csvFile, `${meta.label} (ZAN Securities)`)
  }
  return fetchUttFundHistory(meta.uttSearch)
}

/** For API responses / docs */
export const FAIDA_CSV_PUBLIC_PATH = `public/${FAIDA_FUND_DIR}/${FAIDA_CSV_FILENAME}`
export const VERTEX_CSV_PUBLIC_DIR = `public/${VERTEX_FUND_DIR}/`
export const ZAN_CSV_PUBLIC_DIR = `public/${ZAN_FUND_DIR}/`
