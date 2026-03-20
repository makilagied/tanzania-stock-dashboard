"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Moon, PieChart, RefreshCw, Sun, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import {
  ANALYTICS_PERIOD_OPTIONS,
  computeFundPeriodAnalytics,
  type FundAnalyticsPeriod,
} from "@/lib/fund-analytics"
import { ITRUST_FUNDS, type ITrustFundMeta, type ITrustFundRecord } from "@/lib/itrust-funds"

type ApiFundResponse = {
  success: boolean
  fundId: string
  meta: ITrustFundMeta | null
  data: ITrustFundRecord[]
  error?: string
}

const DAY_OPTIONS = [7, 30, 90, 180, 365, 5000] as const

const formatMoney = (value: number, currency: "TZS" | "USD") =>
  new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "USD" ? 4 : 2,
  }).format(value)

const formatCompact = (value: number) => {
  if (Math.abs(value) < 100_000) return new Intl.NumberFormat("en-TZ").format(value)
  return new Intl.NumberFormat("en-TZ", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

const formatPct = (value: number | null, digits = 2) => {
  if (value == null || Number.isNaN(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(digits)}%`
}

const FundTooltip = ({
  active,
  payload,
  currency,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartRow }>
  currency: "TZS" | "USD"
}) => {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{row.date}</p>
      <p className="text-muted-foreground">NAV / unit: {formatMoney(row.navPerUnit, currency)}</p>
      <p className="text-muted-foreground">Sale: {formatMoney(row.salePricePerUnit, currency)}</p>
      <p className="text-muted-foreground">Repurchase: {formatMoney(row.repurchasePricePerUnit, currency)}</p>
      <p className="text-muted-foreground">Total NAV: {formatCompact(row.netAssetValue)}</p>
      <p className="text-muted-foreground">Units: {formatCompact(row.outStandingUnits)}</p>
    </div>
  )
}

type ChartRow = ITrustFundRecord & { label: string }

export default function FundsPage() {
  const defaultId = ITRUST_FUNDS[0]?.id ?? "iGrowth"
  const [selectedId, setSelectedId] = useState(defaultId)
  const [rows, setRows] = useState<ITrustFundRecord[]>([])
  const [meta, setMeta] = useState<ITrustFundMeta | null>(ITRUST_FUNDS.find((f) => f.id === defaultId) ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(7)
  const [analyticsPeriod, setAnalyticsPeriod] = useState<FundAnalyticsPeriod>("1m")
  const [isDarkMode, setIsDarkMode] = useState(false)

  const currency = meta?.currency ?? "TZS"

  const fetchFund = useCallback(async (fundId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/funds/${encodeURIComponent(fundId)}`)
      const json: ApiFundResponse = await res.json()
      if (!json.success || !json.data?.length) {
        setError(json.error || "No data returned for this fund.")
        setRows([])
        return
      }
      setRows(json.data)
      setMeta(json.meta ?? ITRUST_FUNDS.find((f) => f.id === fundId) ?? null)
    } catch {
      setError("Network error loading fund data.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFund(selectedId)
  }, [selectedId, fetchFund])

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    if (saved === "dark" || (!saved && prefersDark)) {
      setIsDarkMode(true)
      document.documentElement.classList.add("dark")
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("theme", isDarkMode ? "dark" : "light")
  }, [isDarkMode])

  const toggleDarkMode = () => {
    setIsDarkMode((d) => !d)
    document.documentElement.classList.toggle("dark")
  }

  const rowsAscending = useMemo(() => [...rows].sort((a, b) => a.dateSort - b.dateSort), [rows])

  const chartData: ChartRow[] = useMemo(() => {
    const capped =
      days >= 5000 ? rowsAscending : rowsAscending.slice(Math.max(0, rowsAscending.length - days))
    return capped.map((r) => ({
      ...r,
      label: r.date,
    }))
  }, [rowsAscending, days])

  const periodAnalytics = useMemo(
    () => computeFundPeriodAnalytics(rowsAscending, analyticsPeriod),
    [rowsAscending, analyticsPeriod],
  )

  const latest = rows[0] ?? null
  const previous = rows[1] ?? null
  const dayChangePct =
    latest && previous && previous.navPerUnit > 0
      ? ((latest.navPerUnit - previous.navPerUnit) / previous.navPerUnit) * 100
      : null

  const mutualFunds = ITRUST_FUNDS.filter((f) => f.category === "mutual-fund")
  const etfs = ITRUST_FUNDS.filter((f) => f.category === "etf")

  return (
    <div className="min-h-screen bg-background font-sans">
      <SiteHeader icon={PieChart} title="iTrust Funds & ETFs" subtitle="Mutual funds & exchange-traded funds">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={toggleDarkMode}>
          {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => fetchFund(selectedId)} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </SiteHeader>

      <main className="mx-auto max-w-[1600px] px-4 py-4 lg:px-6 lg:py-5">
        <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Mutual funds</p>
          <div className="flex flex-wrap gap-2">
            {mutualFunds.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedId(f.id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium shadow-sm transition-colors ${
                  selectedId === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mb-3 mt-4 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">ETFs</p>
          <div className="flex flex-wrap gap-2">
            {etfs.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedId(f.id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium shadow-sm transition-colors ${
                  selectedId === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{meta?.label ?? latest?.fundName ?? selectedId}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {meta?.category === "etf" ? "Exchange-traded fund" : "Mutual fund"} · NAV per unit
                </p>
                {latest && (
                  <p className="mt-2 text-sm font-medium tabular-nums">
                    {formatMoney(latest.navPerUnit, currency)}
                    {dayChangePct != null && (
                      <span
                        className={`ml-2 text-xs font-semibold ${dayChangePct >= 0 ? "text-chart-3" : "text-chart-5"}`}
                      >
                        ({dayChangePct >= 0 ? "+" : ""}
                        {dayChangePct.toFixed(2)}% vs prior day)
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {DAY_OPTIONS.map((d) => (
                  <Button
                    key={d}
                    variant={days === d ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => setDays(d)}
                  >
                    {d >= 5000 ? "All" : d === 7 ? "1w" : `${d}d`}
                  </Button>
                ))}
              </div>
            </div>
            <div className="h-[280px] w-full lg:h-[320px]">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading chart…</div>
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No history</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fundChartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} dy={6} minTickGap={16} />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => formatCompact(Number(v))}
                      dx={-4}
                      width={48}
                    />
                    <Tooltip content={<FundTooltip currency={currency} />} />
                    <Area
                      type="monotone"
                      dataKey="navPerUnit"
                      name="NAV / unit"
                      stroke={isDarkMode ? "#10b981" : "#059669"}
                      fill="url(#fundChartGrad)"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-muted-foreground">Latest snapshot</h3>
              {latest ? (
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-2 border-b border-border pb-2">
                    <dt className="text-muted-foreground">As of</dt>
                    <dd className="font-medium tabular-nums">{latest.date}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Sale price / unit</dt>
                    <dd className="font-medium tabular-nums">{formatMoney(latest.salePricePerUnit, currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Repurchase / unit</dt>
                    <dd className="font-medium tabular-nums">{formatMoney(latest.repurchasePricePerUnit, currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Total NAV</dt>
                    <dd className="font-medium tabular-nums">{formatCompact(latest.netAssetValue)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Outstanding units</dt>
                    <dd className="font-medium tabular-nums">{formatCompact(latest.outStandingUnits)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">—</p>
              )}
            </div>
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-[10px] leading-relaxed text-muted-foreground">
              Data source:{" "}
              <a
                href="https://api.itrust.co.tz/"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                iTrust Finance
              </a>{" "}
              public fund endpoints. Values are indicative; confirm with your fund manager before investing.
            </div>
          </aside>
        </div>

        <section className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div>
                <h2 className="text-sm font-semibold">Performance &amp; risk analytics</h2>
                <p className="text-[11px] text-muted-foreground">
                  NAV-based metrics to compare periods before investing or redeeming. Not financial advice — confirm with
                  your adviser or fund rules.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {ANALYTICS_PERIOD_OPTIONS.map(({ id, short }) => (
                <Button
                  key={id}
                  variant={analyticsPeriod === id ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => setAnalyticsPeriod(id)}
                >
                  {short}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading analytics…</p>
          ) : !periodAnalytics ? (
            <p className="text-sm text-muted-foreground">No data for analytics.</p>
          ) : periodAnalytics.observations < 2 ? (
            <p className="text-sm text-muted-foreground">
              Not enough history in this window for return metrics ({periodAnalytics.observations} observation
              {periodAnalytics.observations === 1 ? "" : "s"}). Try a longer chart history or another fund.
            </p>
          ) : (
            <>
              <p className="mb-3 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{periodAnalytics.rangeLabel}</span>
                {periodAnalytics.startDate && periodAnalytics.endDate && (
                  <>
                    {" "}
                    · {periodAnalytics.startDate} → {periodAnalytics.endDate} · {periodAnalytics.observations} NAV
                    points
                  </>
                )}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total return</p>
                  <p
                    className={`mt-1 text-lg font-semibold tabular-nums ${
                      (periodAnalytics.totalReturnPct ?? 0) >= 0 ? "text-chart-3" : "text-chart-5"
                    }`}
                  >
                    {formatPct(periodAnalytics.totalReturnPct)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Annualized return <span className="normal-case opacity-80">(approx.)</span>
                  </p>
                  <p
                    className={`mt-1 text-lg font-semibold tabular-nums ${
                      (periodAnalytics.annualizedReturnPct ?? 0) >= 0 ? "text-chart-3" : "text-chart-5"
                    }`}
                  >
                    {formatPct(periodAnalytics.annualizedReturnPct)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Volatility <span className="normal-case opacity-80">(ann.)</span>
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatPct(periodAnalytics.volatilityAnnualizedPct)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">From daily NAV changes</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Max drawdown</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-chart-5">
                    {periodAnalytics.maxDrawdownPct != null
                      ? `${Math.abs(periodAnalytics.maxDrawdownPct).toFixed(2)}%`
                      : "—"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Largest fall from a peak in window</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Best / worst day</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    <span className="text-chart-3">{formatPct(periodAnalytics.bestDayPct)}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-chart-5">{formatPct(periodAnalytics.worstDayPct)}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Period high / low NAV</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                    {periodAnalytics.periodHighNav != null ? formatMoney(periodAnalytics.periodHighNav, currency) : "—"}{" "}
                    <span className="text-muted-foreground">/</span>{" "}
                    {periodAnalytics.periodLowNav != null ? formatMoney(periodAnalytics.periodLowNav, currency) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Sale vs repurchase spread
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatPct(periodAnalytics.latestSpreadPct)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Latest day; cost signal for buy/sell</p>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
