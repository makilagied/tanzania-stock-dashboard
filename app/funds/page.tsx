"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChevronDown, Moon, PieChart, RefreshCw, Sun, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import {
  ANALYTICS_PERIOD_OPTIONS,
  computeFundPeriodAnalytics,
  filterFundRowsByPeriod,
  type FundAnalyticsPeriod,
} from "@/lib/fund-analytics"
import type { ITrustFundRecord } from "@/lib/itrust-funds"
import { ALL_FUNDS, type FundMeta } from "@/lib/funds-catalog"
import { cn } from "@/lib/utils"

type ApiFundResponse = {
  success: boolean
  fundId: string
  meta: FundMeta | null
  data: ITrustFundRecord[]
  error?: string
}

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
  const defaultId = ALL_FUNDS[0]?.id ?? "iGrowth"
  const [selectedId, setSelectedId] = useState(defaultId)
  const [rows, setRows] = useState<ITrustFundRecord[]>([])
  const [meta, setMeta] = useState<FundMeta | null>(ALL_FUNDS.find((f) => f.id === defaultId) ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** One period for both NAV chart and performance analytics */
  const [fundPeriod, setFundPeriod] = useState<FundAnalyticsPeriod>("1m")
  const [isDarkMode, setIsDarkMode] = useState(false)
  /** Accordion: only one fund group expanded at a time */
  const [activeFundGroup, setActiveFundGroup] = useState<
    "itrustMutual" | "itrustEtf" | "utt" | "faida" | "inuka" | "vertex" | "zan" | null
  >("itrustMutual")

  /** Derived flags (keeps `openFundGroups` in scope for any stale chunk / HMR) */
  const openFundGroups = {
    itrustMutual: activeFundGroup === "itrustMutual",
    itrustEtf: activeFundGroup === "itrustEtf",
    utt: activeFundGroup === "utt",
    faida: activeFundGroup === "faida",
    inuka: activeFundGroup === "inuka",
    vertex: activeFundGroup === "vertex",
    zan: activeFundGroup === "zan",
  } as const

  const toggleFundGroup = (key: "itrustMutual" | "itrustEtf" | "utt" | "faida" | "inuka" | "vertex" | "zan") => {
    setActiveFundGroup((current) => (current === key ? null : key))
  }

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
      setMeta(json.meta ?? ALL_FUNDS.find((f) => f.id === fundId) ?? null)
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
    const capped = filterFundRowsByPeriod(rowsAscending, fundPeriod)
    return capped.map((r) => ({
      ...r,
      label: r.date,
    }))
  }, [rowsAscending, fundPeriod])

  const periodAnalytics = useMemo(
    () => computeFundPeriodAnalytics(rowsAscending, fundPeriod),
    [rowsAscending, fundPeriod],
  )

  const latest = rows[0] ?? null
  const previous = rows[1] ?? null
  const dayChangePct =
    latest && previous && previous.navPerUnit > 0
      ? ((latest.navPerUnit - previous.navPerUnit) / previous.navPerUnit) * 100
      : null

  const itrustMutual = ALL_FUNDS.filter((f) => f.provider === "itrust" && f.category === "mutual-fund")
  const itrustEtfs = ALL_FUNDS.filter((f) => f.provider === "itrust" && f.category === "etf")
  const uttFunds = ALL_FUNDS.filter((f) => f.provider === "utt")
  const faidaFunds = ALL_FUNDS.filter((f) => f.provider === "faida")
  const inukaFunds = ALL_FUNDS.filter((f) => f.provider === "inuka")
  const vertexFunds = ALL_FUNDS.filter((f) => f.provider === "vertex")
  const zanFunds = ALL_FUNDS.filter((f) => f.provider === "zan")
  const isUtt = meta?.provider === "utt"
  const isFaida = meta?.provider === "faida"
  const isInuka = meta?.provider === "inuka"
  const isVertex = meta?.provider === "vertex"
  const isZan = meta?.provider === "zan"

  return (
    <div className="min-h-screen bg-background font-sans">
      <SiteHeader
        icon={PieChart}
        title="Funds & ETFs"
        subtitle="iTrust, UTT, Faida, Inuka, Vertex, ZAN"
      >
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={toggleDarkMode}>
          {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => fetchFund(selectedId)} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </SiteHeader>

      <main className="mx-auto max-w-[1600px] px-4 py-4 lg:px-6 lg:py-5">
        <div className="mb-4 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {/* iTrust mutual — inline: toggle + pills on same flow */}
            <div className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <button
                type="button"
                onClick={() => toggleFundGroup("itrustMutual")}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-expanded={openFundGroups.itrustMutual}
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    !openFundGroups.itrustMutual && "-rotate-90",
                  )}
                  aria-hidden
                />
                <span className="text-[10px] font-semibold uppercase tracking-wide">iTrust — mutual funds</span>
                {!openFundGroups.itrustMutual && (
                  <span className="text-[10px] tabular-nums opacity-70">({itrustMutual.length})</span>
                )}
              </button>
              {openFundGroups.itrustMutual &&
                itrustMutual.map((f) => (
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

            <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />

            <div className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <button
                type="button"
                onClick={() => toggleFundGroup("itrustEtf")}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-expanded={openFundGroups.itrustEtf}
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    !openFundGroups.itrustEtf && "-rotate-90",
                  )}
                  aria-hidden
                />
                <span className="text-[10px] font-semibold uppercase tracking-wide">iTrust — ETFs</span>
                {!openFundGroups.itrustEtf && (
                  <span className="text-[10px] tabular-nums opacity-70">({itrustEtfs.length})</span>
                )}
              </button>
              {openFundGroups.itrustEtf &&
                itrustEtfs.map((f) => (
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

            <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />

            <div className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <button
                type="button"
                onClick={() => toggleFundGroup("utt")}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-expanded={openFundGroups.utt}
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    !openFundGroups.utt && "-rotate-90",
                  )}
                  aria-hidden
                />
                <span className="text-[10px] font-semibold uppercase tracking-wide">UTT AMIS</span>
                {!openFundGroups.utt && (
                  <span className="text-[10px] tabular-nums opacity-70">({uttFunds.length})</span>
                )}
              </button>
              {openFundGroups.utt &&
                uttFunds.map((f) => (
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

            <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />

            <div className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <button
                type="button"
                onClick={() => toggleFundGroup("faida")}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-expanded={openFundGroups.faida}
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    !openFundGroups.faida && "-rotate-90",
                  )}
                  aria-hidden
                />
                <span className="text-[10px] font-semibold uppercase tracking-wide">Watumishi Housing</span>
                {!openFundGroups.faida && (
                  <span className="text-[10px] tabular-nums opacity-70">({faidaFunds.length})</span>
                )}
              </button>
              {openFundGroups.faida &&
                faidaFunds.map((f) => (
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

            <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />

            <div className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <button
                type="button"
                onClick={() => toggleFundGroup("inuka")}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-expanded={openFundGroups.inuka}
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    !openFundGroups.inuka && "-rotate-90",
                  )}
                  aria-hidden
                />
                <span className="text-[10px] font-semibold uppercase tracking-wide">Inuka (Orbit)</span>
                {!openFundGroups.inuka && (
                  <span className="text-[10px] tabular-nums opacity-70">({inukaFunds.length})</span>
                )}
              </button>
              {openFundGroups.inuka &&
                inukaFunds.map((f) => (
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

            <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />

            <div className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <button
                type="button"
                onClick={() => toggleFundGroup("vertex")}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-expanded={openFundGroups.vertex}
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    !openFundGroups.vertex && "-rotate-90",
                  )}
                  aria-hidden
                />
                <span className="text-[10px] font-semibold uppercase tracking-wide">Vertex</span>
                {!openFundGroups.vertex && (
                  <span className="text-[10px] tabular-nums opacity-70">({vertexFunds.length})</span>
                )}
              </button>
              {openFundGroups.vertex &&
                vertexFunds.map((f) => (
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

            <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />

            <div className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <button
                type="button"
                onClick={() => toggleFundGroup("zan")}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-expanded={openFundGroups.zan}
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    !openFundGroups.zan && "-rotate-90",
                  )}
                  aria-hidden
                />
                <span className="text-[10px] font-semibold uppercase tracking-wide">ZAN Securities</span>
                {!openFundGroups.zan && (
                  <span className="text-[10px] tabular-nums opacity-70">({zanFunds.length})</span>
                )}
              </button>
              {openFundGroups.zan &&
                zanFunds.map((f) => (
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
                  {isUtt ? <span className="ml-1">(UTT AMIS)</span> : null}
                  {isFaida ? <span className="ml-1">(Watumishi Housing · CSV)</span> : null}
                  {isInuka ? <span className="ml-1">(Orbit · CSV)</span> : null}
                  {isVertex ? <span className="ml-1">(Vertex · CSV)</span> : null}
                  {isZan ? <span className="ml-1">(ZAN · CSV)</span> : null}
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
                {ANALYTICS_PERIOD_OPTIONS.map(({ id, short }) => (
                  <Button
                    key={id}
                    variant={fundPeriod === id ? "default" : "outline"}
                    size="sm"
                    className="h-7 min-w-[2.5rem] px-2 text-[10px]"
                    onClick={() => setFundPeriod(id)}
                  >
                    {short}
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
              {isUtt ? (
                <>
                  <a
                    href="https://uttamis.co.tz/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    UTT AMIS
                  </a>{" "}
                  (official NAV table). Values are indicative; confirm with UTT AMIS or your adviser before investing.
                </>
              ) : isFaida ? (
                <>
                  <span className="font-medium text-foreground">Faida Fund CSV</span> — read from{" "}
                  <code className="whitespace-pre rounded bg-muted px-1 py-0.5 text-[9px] text-foreground">
                    public/faida-fund/FAID FUND  NAV PERFORMANCE.csv
                  </code>{" "}
                  at deploy time. Replace that file to update NAVs. Confirm figures with Watumishi Housing before
                  investing.
                </>
              ) : isInuka ? (
                <>
                  <span className="font-medium text-foreground">Inuka (Orbit) CSV</span> — bundled under{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[9px] text-foreground">public/inuka-fund/</code>.
                  Replace the fund file to refresh NAVs. Confirm with Orbit / fund documentation before investing.
                </>
              ) : isVertex ? (
                <>
                  <span className="font-medium text-foreground">Vertex CSV</span> — bundled under{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[9px] text-foreground">public/vertex-fund/</code>.
                  Replace CSV files to refresh NAVs. Confirm figures with Vertex documentation before investing.
                </>
              ) : isZan ? (
                <>
                  <span className="font-medium text-foreground">ZAN Securities CSV</span> — bundled under{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[9px] text-foreground">public/zan-security/</code>.
                  Replace CSV files to refresh NAVs. Confirm figures with ZAN Securities documentation before investing.
                </>
              ) : (
                <>
                  <a
                    href="https://api.itrust.co.tz/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    iTrust Finance
                  </a>{" "}
                  public fund endpoints. Values are indicative; confirm with your fund manager before investing.
                </>
              )}
            </div>
          </aside>
        </div>

        <section className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-start gap-2">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold">Performance &amp; risk analytics</h2>
              <p className="text-[11px] text-muted-foreground">
                Same period as the chart above ({ANALYTICS_PERIOD_OPTIONS.find((o) => o.id === fundPeriod)?.short ?? fundPeriod})
                . NAV-based metrics to compare before investing or redeeming. Not financial advice — confirm with your
                adviser or fund rules.
              </p>
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
