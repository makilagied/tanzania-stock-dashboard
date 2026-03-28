"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { HistoricalPoint } from "@/lib/market-data"
import type { ITrustFundRecord } from "@/lib/itrust-funds"
import { ALL_FUNDS, type FundMeta } from "@/lib/funds-catalog"
import {
  computeFundLumpSum,
  computeStockLumpSum,
  findHistoryCloseOnOrBefore,
  fundCurrency,
  futureValueLumpSum,
  futureValueMonthlySip,
} from "@/lib/investment-calculator"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Calculator, LineChart, PieChart, TrendingUp } from "lucide-react"

type StockRow = { symbol: string; name: string; price: number }

type Mode = "funds" | "stocks" | "project"

const inputSelectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function formatMoney(n: number, currency: "TZS" | "USD") {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 4 : 0,
  }).format(n)
}

export function formatAmountInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, "")
  if (digitsOnly === "") return ""
  const trimmed = digitsOnly.replace(/^0+/, "") || "0"
  const num = parseInt(trimmed, 10)
  if (!Number.isFinite(num)) return ""
  return num.toLocaleString("en-US")
}

function parseAmountToNumber(s: string): number {
  const n = Number(String(s).replace(/,/g, ""))
  return Number.isFinite(n) ? n : Number.NaN
}

export type CalculatorPanelProps = {
  /** When false, skips market/fund API calls until the calculator is opened */
  enabled: boolean
}

export function CalculatorPanel({ enabled }: CalculatorPanelProps) {
  const [mode, setMode] = useState<Mode>("funds")

  const [fundId, setFundId] = useState(ALL_FUNDS[0]?.id ?? "")
  const [fundRows, setFundRows] = useState<ITrustFundRecord[]>([])
  const [fundLoading, setFundLoading] = useState(false)
  const [fundErr, setFundErr] = useState<string | null>(null)
  const [fundDate, setFundDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [fundAmount, setFundAmount] = useState(() => formatAmountInput("1000000"))

  const selectedFundMeta = useMemo(() => ALL_FUNDS.find((f) => f.id === fundId) ?? null, [fundId])
  const fundCurrencyCode = selectedFundMeta ? fundCurrency(selectedFundMeta) : "TZS"

  const loadFund = useCallback(async (id: string) => {
    if (!id) return
    setFundLoading(true)
    setFundErr(null)
    try {
      const res = await fetch(`/api/funds/${encodeURIComponent(id)}`)
      const j = await res.json()
      const rows: ITrustFundRecord[] = Array.isArray(j?.data) ? j.data : []
      if (!rows.length) {
        setFundRows([])
        setFundErr(j?.error || "No NAV rows returned.")
        return
      }
      setFundRows(rows)
    } catch {
      setFundRows([])
      setFundErr("Failed to load fund data.")
    } finally {
      setFundLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void loadFund(fundId)
  }, [fundId, loadFund, enabled])

  const fundResult = useMemo(() => {
    const amt = parseAmountToNumber(fundAmount)
    if (!Number.isFinite(amt)) return null
    return computeFundLumpSum(fundRows, fundDate, amt)
  }, [fundRows, fundDate, fundAmount])

  const [stocks, setStocks] = useState<StockRow[]>([])
  const [stockSymbol, setStockSymbol] = useState("")
  const [stockDate, setStockDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 12)
    return d.toISOString().slice(0, 10)
  })
  const [stockAmount, setStockAmount] = useState(() => formatAmountInput("1000000"))
  const [history, setHistory] = useState<HistoricalPoint[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histErr, setHistErr] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    ;(async () => {
      try {
        const res = await fetch("/api/market/stocks")
        const j = await res.json()
        const rows: StockRow[] = Array.isArray(j?.data)
          ? j.data.map((r: { symbol: string; name: string; price: number }) => ({
              symbol: r.symbol,
              name: r.name,
              price: Number(r.price) || 0,
            }))
          : []
        setStocks(rows)
        if (rows.length > 0) {
          setStockSymbol((prev) => prev || rows[0]!.symbol)
        }
      } catch {
        /* ignore */
      }
    })()
  }, [enabled])

  const currentStock = stocks.find((s) => s.symbol === stockSymbol)

  useEffect(() => {
    if (!enabled || !stockSymbol) return
    let cancelled = false
    setHistLoading(true)
    setHistErr(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/market/history/${encodeURIComponent(stockSymbol)}?days=4000`)
        const j = await res.json()
        const data: HistoricalPoint[] = Array.isArray(j?.data) ? j.data : []
        if (cancelled) return
        const asc = [...data].sort((a, b) => a.date.localeCompare(b.date))
        setHistory(asc)
        if (!asc.length) setHistErr("No price history for this symbol.")
      } catch {
        if (!cancelled) {
          setHistory([])
          setHistErr("Could not load history.")
        }
      } finally {
        if (!cancelled) setHistLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stockSymbol, enabled])

  const stockResult = useMemo(() => {
    const amt = parseAmountToNumber(stockAmount)
    if (!Number.isFinite(amt) || !currentStock || history.length === 0) return null
    const pt = findHistoryCloseOnOrBefore(history, stockDate)
    if (!pt) return { kind: "error" as const, message: "No trading day on or before that date in our history." }
    return computeStockLumpSum(pt, currentStock.price, amt, stockSymbol)
  }, [stockAmount, currentStock, history, stockDate, stockSymbol])

  const [pv, setPv] = useState(() => formatAmountInput("500000"))
  const [rate, setRate] = useState("12")
  const [years, setYears] = useState("10")
  const [sip, setSip] = useState(() => formatAmountInput("0"))

  const projection = useMemo(() => {
    const P = parseAmountToNumber(pv)
    const r = Number(rate)
    const y = Number(years)
    const m = parseAmountToNumber(sip)
    if (!Number.isFinite(P) || !Number.isFinite(r) || !Number.isFinite(y)) return null
    const lump = futureValueLumpSum(Math.max(0, P), r, Math.max(0, y))
    const sipPart = Number.isFinite(m) && m > 0 ? futureValueMonthlySip(m, r, Math.max(0, y)) : 0
    return { lump, sipPart, total: lump + sipPart }
  }, [pv, rate, years, sip])

  const modes: { id: Mode; label: string; icon: typeof PieChart }[] = [
    { id: "funds", label: "Mutual funds", icon: PieChart },
    { id: "stocks", label: "Stocks", icon: LineChart },
    { id: "project", label: "Project returns", icon: TrendingUp },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Calculator className="h-4 w-4" aria-hidden />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Model lump-sum mutual fund investments using NAV history, stock investments using DSE closes, or compound growth
          scenarios. Not financial advice — for education only.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-muted/30 p-1">
        {modes.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors min-[400px]:text-xs",
              mode === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {mode === "funds" && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm" aria-labelledby="calc-funds">
          <h2 id="calc-funds" className="text-sm font-semibold">
            Mutual fund — lump sum (historical)
          </h2>
          <p className="text-xs text-muted-foreground">
            Uses sale price at purchase and latest repurchase price (or NAV) to estimate units and current value.
          </p>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Fund</span>
            <select
              className={inputSelectClass}
              value={fundId}
              onChange={(e) => setFundId(e.target.value)}
              disabled={fundLoading || !enabled}
            >
              {ALL_FUNDS.map((f: FundMeta) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Purchase date</span>
              <Input type="date" value={fundDate} onChange={(e) => setFundDate(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Amount ({fundCurrencyCode})</span>
              <Input
                inputMode="numeric"
                autoComplete="off"
                value={fundAmount}
                onChange={(e) => setFundAmount(formatAmountInput(e.target.value))}
                placeholder="1,000,000"
              />
            </label>
          </div>

          {fundErr && <p className="text-sm text-destructive">{fundErr}</p>}
          {fundLoading && <p className="text-xs text-muted-foreground">Loading NAV series…</p>}

          {fundResult?.kind === "error" && <p className="text-sm text-destructive">{fundResult.message}</p>}
          {fundResult?.kind === "ok" && (
            <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Invested </span>
                <span className="font-semibold tabular-nums">{formatMoney(fundResult.amountInvested, fundCurrencyCode)}</span>
                <span className="text-muted-foreground"> on {fundResult.purchaseDate.slice(0, 10)}</span>
              </p>
              <ul className="grid gap-2 text-xs sm:grid-cols-2">
                <li>
                  Units (at sale price {formatMoney(fundResult.purchaseSalePrice, fundCurrencyCode)}):{" "}
                  <span className="font-medium tabular-nums">{fundResult.units.toFixed(4)}</span>
                </li>
                <li>
                  Latest ({fundResult.latestDate.slice(0, 10)}): repurchase / NAV ≈{" "}
                  <span className="font-medium tabular-nums">{formatMoney(fundResult.latestRepurchasePrice, fundCurrencyCode)}</span>
                </li>
                <li className="sm:col-span-2">
                  Estimated value now:{" "}
                  <span className="text-base font-semibold tabular-nums text-primary">
                    {formatMoney(fundResult.currentValue, fundCurrencyCode)}
                  </span>
                </li>
                <li>
                  Total return:{" "}
                  <span className={fundResult.totalReturnPct >= 0 ? "text-chart-3" : "text-chart-5"}>
                    {fundResult.totalReturnPct >= 0 ? "+" : ""}
                    {fundResult.totalReturnPct.toFixed(2)}%
                  </span>
                </li>
                <li>
                  CAGR (approx.):{" "}
                  {fundResult.cagrPct != null ? (
                    <span className="font-medium tabular-nums">{fundResult.cagrPct.toFixed(2)}% p.a.</span>
                  ) : (
                    "—"
                  )}
                </li>
              </ul>
            </div>
          )}
        </section>
      )}

      {mode === "stocks" && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm" aria-labelledby="calc-stocks">
          <h2 id="calc-stocks" className="text-sm font-semibold">
            DSE stock — lump sum (historical closes)
          </h2>
          <p className="text-xs text-muted-foreground">
            Last available close on or before your purchase date vs latest live price.
          </p>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Listed stock</span>
            <select
              className={inputSelectClass}
              value={stockSymbol}
              onChange={(e) => setStockSymbol(e.target.value)}
              disabled={!stocks.length}
            >
              {stocks.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Purchase date</span>
              <Input type="date" value={stockDate} onChange={(e) => setStockDate(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Amount (TZS)</span>
              <Input
                inputMode="numeric"
                autoComplete="off"
                value={stockAmount}
                onChange={(e) => setStockAmount(formatAmountInput(e.target.value))}
                placeholder="1,000,000"
              />
            </label>
          </div>

          {histLoading && <p className="text-xs text-muted-foreground">Loading price history…</p>}
          {histErr && <p className="text-sm text-destructive">{histErr}</p>}

          {stockResult?.kind === "error" && <p className="text-sm text-destructive">{stockResult.message}</p>}
          {stockResult?.kind === "ok" && (
            <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Invested </span>
                <span className="font-semibold tabular-nums">{formatMoney(stockResult.amountInvested, "TZS")}</span>
                <span className="text-muted-foreground"> — close {formatMoney(stockResult.purchaseClose, "TZS")}</span>
                <span className="text-muted-foreground"> on {stockResult.purchaseDate}</span>
              </p>
              <ul className="grid gap-2 text-xs sm:grid-cols-2">
                <li>
                  Shares: <span className="font-medium tabular-nums">{stockResult.shares.toFixed(4)}</span>
                </li>
                <li>
                  Latest price (live feed):{" "}
                  <span className="font-medium tabular-nums">{formatMoney(stockResult.currentPrice, "TZS")}</span>
                </li>
                <li className="sm:col-span-2">
                  Value now:{" "}
                  <span className="text-base font-semibold tabular-nums text-primary">
                    {formatMoney(stockResult.currentValue, "TZS")}
                  </span>
                </li>
                <li>
                  Total return:{" "}
                  <span className={stockResult.totalReturnPct >= 0 ? "text-chart-3" : "text-chart-5"}>
                    {stockResult.totalReturnPct >= 0 ? "+" : ""}
                    {stockResult.totalReturnPct.toFixed(2)}%
                  </span>
                </li>
                <li>
                  CAGR (approx.):{" "}
                  {stockResult.cagrPct != null ? (
                    <span className="font-medium tabular-nums">{stockResult.cagrPct.toFixed(2)}% p.a.</span>
                  ) : (
                    "—"
                  )}
                </li>
              </ul>
            </div>
          )}
        </section>
      )}

      {mode === "project" && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm" aria-labelledby="calc-project">
          <h2 id="calc-project" className="text-sm font-semibold">
            Future value (compound growth)
          </h2>
          <p className="text-xs text-muted-foreground">
            Hypothetical projection: expected annual return and horizon. Optional monthly top-ups (end-of-month).
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Starting amount (TZS)</span>
              <Input
                inputMode="numeric"
                autoComplete="off"
                value={pv}
                onChange={(e) => setPv(formatAmountInput(e.target.value))}
                placeholder="500,000"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Expected annual return (%)</span>
              <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Years</span>
              <Input inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Monthly contribution (TZS, optional)</span>
              <Input
                inputMode="numeric"
                autoComplete="off"
                value={sip}
                onChange={(e) => setSip(formatAmountInput(e.target.value))}
                placeholder="0"
              />
            </label>
          </div>

          {projection && (
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3 text-sm">
              <p className="text-muted-foreground">Estimated future value</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-primary">
                {formatMoney(projection.total, "TZS")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Lump-sum FV: {formatMoney(projection.lump, "TZS")}
                {projection.sipPart > 0 && (
                  <>
                    {" "}
                    + SIP FV: {formatMoney(projection.sipPart, "TZS")}
                  </>
                )}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
