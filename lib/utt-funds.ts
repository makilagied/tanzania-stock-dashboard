/**
 * UTT AMIS — https://uttamis.co.tz
 * NAV history is served via DataTables POST /navs (requires session cookie + CSRF from homepage).
 */

import type { ITrustFundMeta, ITrustFundRecord } from "@/lib/itrust-funds"

const UTT_ORIGIN = "https://uttamis.co.tz"
const UTT_HOME = `${UTT_ORIGIN}/`
const UTT_NAVS = `${UTT_ORIGIN}/navs`

/** Page size per DataTables request (server allows large batches) */
const PAGE_SIZE = 5000

export type UTTFundMeta = ITrustFundMeta & {
  provider: "utt"
  /** Partial match on scheme name for DataTables column search (sname) */
  uttSearch: string
}

/** UTT AMIS unit trust schemes — ids are prefixed so they don’t clash with iTrust */
export const UTT_FUNDS: UTTFundMeta[] = [
  {
    provider: "utt",
    id: "utt-umoja",
    label: "Umoja Fund",
    shortLabel: "Umoja",
    category: "mutual-fund",
    currency: "TZS",
    uttSearch: "Umoja",
  },
  {
    provider: "utt",
    id: "utt-wekeza",
    label: "Wekeza Maisha Fund",
    shortLabel: "Wekeza Maisha",
    category: "mutual-fund",
    currency: "TZS",
    uttSearch: "Wekeza",
  },
  {
    provider: "utt",
    id: "utt-watoto",
    label: "Watoto Fund",
    shortLabel: "Watoto",
    category: "mutual-fund",
    currency: "TZS",
    uttSearch: "Watoto",
  },
  {
    provider: "utt",
    id: "utt-jikimu",
    label: "Jikimu Fund",
    shortLabel: "Jikimu",
    category: "mutual-fund",
    currency: "TZS",
    uttSearch: "Jikimu",
  },
  {
    provider: "utt",
    id: "utt-liquid",
    label: "Liquid Fund",
    shortLabel: "Liquid",
    category: "mutual-fund",
    currency: "TZS",
    uttSearch: "Liquid",
  },
  {
    provider: "utt",
    id: "utt-bond",
    label: "Bond Fund",
    shortLabel: "Bond",
    category: "mutual-fund",
    currency: "TZS",
    uttSearch: "Bond",
  },
]

type UttNavRow = {
  id: number
  scheme_id: number
  scheme_name?: string
  sname?: string
  net_asset_value: string | number
  outstanding_number_of_units: string | number
  nav_per_unit: string | number
  sale_price_per_unit: string | number
  repurchase_price_per_unit: string | number
  date_valued: string
}

type UttNavsResponse = {
  draw?: number
  recordsTotal?: number
  recordsFiltered?: number
  data?: UttNavRow[]
}

function parseCommaNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  const s = String(v).replace(/,/g, "").trim()
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/** Parse `19-03-2026` (DD-MM-YYYY) */
export function parseUttDate(raw: string): number {
  const t = Date.parse(raw)
  if (!Number.isNaN(t)) return t
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw.trim())
  if (!m) return 0
  const [, d, mo, y] = m
  return new Date(Number(y), Number(mo) - 1, Number(d)).getTime()
}

function normalizeUttRow(row: UttNavRow): ITrustFundRecord {
  const dateStr = String(row.date_valued ?? "")
  const fundName = String(row.scheme_name ?? row.sname ?? "")
  return {
    id: String(row.id ?? ""),
    date: dateStr,
    dateSort: parseUttDate(dateStr),
    netAssetValue: parseCommaNumber(row.net_asset_value),
    outStandingUnits: parseCommaNumber(row.outstanding_number_of_units),
    navPerUnit: parseCommaNumber(row.nav_per_unit),
    salePricePerUnit: parseCommaNumber(row.sale_price_per_unit),
    repurchasePricePerUnit: parseCommaNumber(row.repurchase_price_per_unit),
    fundName,
  }
}

function cookiesFromResponse(res: Response): string {
  const getSetCookie = res.headers.getSetCookie
  if (typeof getSetCookie === "function") {
    const list = getSetCookie.call(res.headers)
    if (list?.length) {
      return list.map((c) => c.split(";")[0]).join("; ")
    }
  }
  const single = res.headers.get("set-cookie")
  if (single) {
    return single
      .split(/,(?=[^;]+?=)/)
      .map((part) => part.split(";")[0].trim())
      .join("; ")
  }
  return ""
}

function extractCsrf(html: string): string | null {
  const m = /<meta\s+name="csrf-token"\s+content="([^"]+)"/i.exec(html)
  return m?.[1] ?? null
}

/** Obtain session cookie + CSRF token from public homepage */
async function getUttSession(): Promise<{ cookie: string; csrf: string }> {
  const res = await fetch(UTT_HOME, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "TanzaniaStockDashboard/1.0 (+https://github.com)",
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    throw new Error(`UTT homepage failed: ${res.status}`)
  }
  const html = await res.text()
  const csrf = extractCsrf(html)
  if (!csrf) {
    throw new Error("UTT: could not read CSRF token from homepage")
  }
  const cookie = cookiesFromResponse(res)
  return { cookie, csrf }
}

function buildNavsFormBody(opts: {
  csrf: string
  draw: number
  start: number
  length: number
  snameSearch: string
}): string {
  const p = new URLSearchParams()
  p.append("csrf-token", opts.csrf)
  p.append("draw", String(opts.draw))
  p.append("start", String(opts.start))
  p.append("length", String(opts.length))
  p.append("search[value]", "")
  p.append("search[regex]", "false")

  const cols: Array<{
    data: string
    name: string
    searchable: boolean
    orderable: boolean
    searchValue: string
  }> = [
    { data: "DT_RowIndex", name: "", searchable: false, orderable: false, searchValue: "" },
    { data: "sname", name: "sname.name", searchable: true, orderable: true, searchValue: opts.snameSearch },
    { data: "net_asset_value", name: "net_asset_value", searchable: true, orderable: true, searchValue: "" },
    { data: "outstanding_number_of_units", name: "outstanding_number_of_units", searchable: true, orderable: true, searchValue: "" },
    { data: "nav_per_unit", name: "nav_per_unit", searchable: true, orderable: true, searchValue: "" },
    { data: "sale_price_per_unit", name: "sale_price_per_unit", searchable: true, orderable: true, searchValue: "" },
    { data: "repurchase_price_per_unit", name: "repurchase_price_per_unit", searchable: true, orderable: true, searchValue: "" },
    { data: "date_valued", name: "date_valued", searchable: true, orderable: true, searchValue: "" },
  ]

  cols.forEach((c, i) => {
    p.append(`columns[${i}][data]`, c.data)
    p.append(`columns[${i}][name]`, c.name)
    p.append(`columns[${i}][searchable]`, String(c.searchable))
    p.append(`columns[${i}][orderable]`, String(c.orderable))
    p.append(`columns[${i}][search][value]`, c.searchValue)
    p.append(`columns[${i}][search][regex]`, "false")
  })

  p.append("order[0][column]", "7")
  p.append("order[0][dir]", "desc")

  return p.toString()
}

/**
 * Full NAV history for one UTT scheme (filtered server-side by scheme name search).
 */
export async function fetchUttFundHistory(uttSearch: string): Promise<ITrustFundRecord[]> {
  const { cookie, csrf } = await getUttSession()

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
    "X-CSRF-TOKEN": csrf,
    Referer: UTT_HOME,
    Origin: UTT_ORIGIN,
  }
  if (cookie) {
    headers.Cookie = cookie
  }

  const out: ITrustFundRecord[] = []
  let start = 0
  let draw = 1
  let total = Infinity

  while (start < total) {
    const body = buildNavsFormBody({
      csrf,
      draw,
      start,
      length: PAGE_SIZE,
      snameSearch: uttSearch,
    })

    const res = await fetch(UTT_NAVS, {
      method: "POST",
      headers,
      body,
    })

    if (!res.ok) {
      throw new Error(`UTT /navs failed: ${res.status}`)
    }

    const json = (await res.json()) as UttNavsResponse | { message?: string }

    if (json && typeof json === "object" && "message" in json && json.message === "Unauthenticated") {
      throw new Error("UTT: session rejected (unauthenticated). Try again later.")
    }

    const payload = json as UttNavsResponse
    const rows = payload.data ?? []
    total = payload.recordsFiltered ?? payload.recordsTotal ?? rows.length
    if (rows.length === 0) break

    for (const row of rows) {
      out.push(normalizeUttRow(row))
    }

    start += rows.length
    draw += 1

    if (rows.length < PAGE_SIZE) break
  }

  out.sort((a, b) => b.dateSort - a.dateSort)
  return out
}

export const getUttFundMeta = (fundId: string) => UTT_FUNDS.find((f) => f.id === fundId) ?? null
