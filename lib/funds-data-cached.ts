import type { FundMeta } from "@/lib/funds-catalog"
import { loadFaidaFundRecords } from "@/lib/faida-fund-csv"
import { loadFundRecords } from "@/lib/load-fund-records"
import type { ITrustFundRecord } from "@/lib/itrust-funds"
import { type StaleFetchResult, withStaleFallback } from "@/lib/stale-cache"

const rowsHealthy = (rows: ITrustFundRecord[]) => Array.isArray(rows) && rows.length > 0

export function getCachedFundRecords(
  fundId: string,
  meta: FundMeta,
): Promise<StaleFetchResult<ITrustFundRecord[]>> {
  return withStaleFallback({
    key: `funds:records:${fundId}`,
    fetch: () => loadFundRecords(meta),
    isHealthy: rowsHealthy,
    emptyValue: [],
  })
}

export function getCachedFaidaNavRecords(): Promise<StaleFetchResult<ITrustFundRecord[]>> {
  return withStaleFallback({
    key: "funds:faida-nav-csv",
    fetch: () => loadFaidaFundRecords(),
    isHealthy: rowsHealthy,
    emptyValue: [],
  })
}
