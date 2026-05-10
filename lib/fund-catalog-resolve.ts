import { ALL_FUNDS, getFundMeta } from "@/lib/funds-catalog"

/** Canonical `fund.id` from catalog id, short label, or scheme name (spacing / case tolerant). */
export function resolveFundCatalogId(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (getFundMeta(t)) return t
  const lower = t.toLowerCase()
  const byId = ALL_FUNDS.find((f) => f.id.toLowerCase() === lower)
  if (byId) return byId.id
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")
  const n = norm(t)
  const byShort = ALL_FUNDS.find((f) => norm(f.shortLabel) === n)
  if (byShort) return byShort.id
  const byLabel = ALL_FUNDS.find((f) => norm(f.label) === n)
  if (byLabel) return byLabel.id
  const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  const tok = alnum(t)
  if (tok.length >= 3) {
    const hits = ALL_FUNDS.filter(
      (f) =>
        alnum(f.id).includes(tok) ||
        alnum(f.shortLabel).includes(tok) ||
        alnum(f.label).includes(tok),
    )
    if (hits.length === 1) return hits[0].id
  }
  return null
}
