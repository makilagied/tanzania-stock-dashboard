"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { ApexOptions } from "apexcharts"
import { ChevronDown, Maximize2, Minimize2, Moon, RefreshCw, Sun, TrendingUp } from "lucide-react"
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
import { parseFlexibleDateTs } from "@/lib/date-parse"
import { cn } from "@/lib/utils"

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false })

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

function inferFundProfile(meta: FundMeta | null): {
  specialization: string
  riskType: string
  investorFit: string
  benchmarkHint: string
  objective: string
  liquidity: string
  eligibility: string
  policy: string
  keyFeature: string
} {
  const uttProfiles: Record<
    string,
    {
      specialization: string
      riskType: string
      investorFit: string
      benchmarkHint: string
      objective: string
      liquidity: string
      eligibility: string
      policy: string
      keyFeature: string
    }
  > = {
    "utt-umoja": {
      specialization: "Balanced portfolio of equities and debt instruments",
      riskType: "Moderate",
      investorFit: "Medium- to long-term growth investors seeking lower volatility than pure equity",
      benchmarkHint: "Composite: DSE local index (TSI) + 7-year Treasury Bond WAY",
      objective: "Medium- to long-term capital growth via diversified equity and debt allocation.",
      liquidity: "Partial/full repurchase allowed; processed within 10 working days.",
      eligibility: "Individuals and non-individuals in the East African Community.",
      policy:
        "Up to 50% in listed equities; balance in government securities, corporate bonds, and time deposits.",
      keyFeature: "No entry load; 1% exit load on repurchase; no lock-in period.",
    },
    "utt-wekeza": {
      specialization: "Balanced investment plus insurance-linked benefits",
      riskType: "Moderate",
      investorFit: "Long-term savers (10-year horizon) seeking growth plus protection benefits",
      benchmarkHint: "Composite: DSE local index (TSI) + 7-year Treasury Bond WAY",
      objective:
        "Long-term capital appreciation from diversified equities/debt with insurance cover components.",
      liquidity: "Partial repurchase after 5 years; full repurchase at year 10 or above.",
      eligibility: "Resident and non-resident Tanzanian individuals aged 18 to 55.",
      policy:
        "Up to 40% in listed equities; balance in government instruments, listed corporate bonds, and deposits.",
      keyFeature: "Systematic Investment Plan with regular or single contribution options.",
    },
    "utt-watoto": {
      specialization: "Child-focused balanced long-term investment",
      riskType: "Moderate",
      investorFit: "Guardians building education/long-term wealth for children",
      benchmarkHint: "Composite: DSE local index (TSI) + 7-year Treasury Bond WAY",
      objective:
        "Long-term capital growth for children through diversified exposure to equities and fixed income.",
      liquidity: "Partial/full repurchase allowed after beneficiary reaches age 12.",
      eligibility: "Investments for Tanzanian child beneficiaries up to age 18.",
      policy:
        "Up to 50% in listed equities; balance in government instruments, listed corporate bonds, and deposits.",
      keyFeature: "Scholarship and Growth options; maturity at beneficiary age 24.",
    },
    "utt-jikimu": {
      specialization: "Balanced income and growth scheme",
      riskType: "Moderate",
      investorFit: "Investors seeking periodic cash flow with capital appreciation potential",
      benchmarkHint: "Composite: DSE local index (TSI) + 7-year Treasury Bond WAY",
      objective: "Provide regular cash flow while preserving opportunity for capital growth over time.",
      liquidity: "Partial/full repurchase allowed; processed within 10 working days.",
      eligibility: "All individual and non-individual Tanzanian investors.",
      policy:
        "Up to 35% in listed equities; balance in government instruments, listed corporate bonds, and deposits.",
      keyFeature: "Quarterly/annual income plans plus annual reinvestment plan.",
    },
    "utt-liquid": {
      specialization: "Money market and debt instruments (capital parking fund)",
      riskType: "Low",
      investorFit: "Short- to medium-term investors prioritizing liquidity and stability",
      benchmarkHint: "7-year Treasury Bond WAY",
      objective: "Offer competitive return with high liquidity for short, medium, and long-term parking.",
      liquidity: "Partial/full repurchase allowed; processed within 3 working days.",
      eligibility: "All individual and non-individual Tanzanian investors.",
      policy: "Portfolio allocation: 100% money market and debt instruments.",
      keyFeature: "No entry load and no exit load.",
    },
    "utt-bond": {
      specialization: "Primarily fixed-income with liquidity sleeve",
      riskType: "Low to moderate",
      investorFit: "Income-oriented investors seeking periodic distributions",
      benchmarkHint: "7-year Treasury Bond WAY",
      objective:
        "Generate periodic income (monthly/semi-annual options) with possibility of capital appreciation.",
      liquidity: "Partial/full repurchase allowed; processed within 10 working days.",
      eligibility: "Tanzanian and non-Tanzanian individual and non-individual investors.",
      policy: "At least 90% fixed-income securities; remaining up to 10% in liquid assets.",
      keyFeature: "Reinvestment, monthly income, and semi-annual income plan options.",
    },
  }

  const iTrustProfiles: Record<
    string,
    {
      specialization: string
      riskType: string
      investorFit: string
      benchmarkHint: string
      objective: string
      liquidity: string
      eligibility: string
      policy: string
      keyFeature: string
    }
  > = {
    iCash: {
      specialization: "Money market and short-duration fixed income",
      riskType: "Low",
      investorFit: "Risk-averse investors parking capital short term",
      benchmarkHint: "364-day Treasury Bill yield",
      objective: "Preserve capital with stable returns and high liquidity.",
      liquidity: "Full/partial withdrawals; redemptions within 3 working days.",
      eligibility: "General individual and institutional investors.",
      policy:
        "Invests in Treasury Bills, corporate bonds, call/fixed deposits, and Treasury Bonds with average maturity below 5 years.",
      keyFeature: "No withdrawal fee for full/partial redemption; min initial TZS 100,000.",
    },
    iGrowth: {
      specialization: "Balanced equity and fixed-income strategy",
      riskType: "Moderate",
      investorFit: "Medium-risk investors targeting long-term growth with less volatility",
      benchmarkHint: "Composite: DSE TSI return + 5-year Treasury Bond WAY",
      objective: "Grow wealth over the long term through balanced allocation.",
      liquidity: "Full/partial withdrawals; redemptions within 3 working days.",
      eligibility: "General individual and institutional investors.",
      policy: "Invests across fixed income securities and DSE listed equities.",
      keyFeature: "Diversified balanced portfolio; min initial TZS 100,000.",
    },
    iSave: {
      specialization: "Long-duration fixed income",
      riskType: "Low",
      investorFit: "Risk-averse long-term investors, including near-retirement savers",
      benchmarkHint: "10-year Treasury Bond weighted average yield",
      objective: "Deliver relatively high, stable long-term growth via fixed income.",
      liquidity: "Redemptions processed within 3 working days.",
      eligibility: "General individual and institutional investors.",
      policy: "Focus on long-term government bonds (20/25 years), call and fixed deposits.",
      keyFeature: "Compounding-focused bond access for both small and large investors.",
    },
    iIncome: {
      specialization: "Income-distribution fixed income strategy",
      riskType: "Low",
      investorFit: "Retirees and income-seeking investors wanting regular low-risk payouts",
      benchmarkHint: "5-year Treasury Bond weighted average yield",
      objective: "Provide regular income while maintaining capital appreciation potential.",
      liquidity: "Redemptions within 3 working days after withdrawal confirmation.",
      eligibility: "Income-focused investors meeting scheme minimums.",
      policy: "Invests in T-bills, call/fixed deposits, corporate bonds, and government bonds.",
      keyFeature: "Regular distributions with partial reinvestment for continued capital growth.",
    },
    Imaan: {
      specialization: "Shariah-compliant balanced portfolio",
      riskType: "Moderate",
      investorFit: "Investors seeking halal, diversified long-term capital growth",
      benchmarkHint: "Average fixed deposit rates from Islamic banks/windows",
      objective: "Appreciate capital over the long term through Shariah-compliant assets.",
      liquidity: "Full/partial liquidation available within 3 working days.",
      eligibility: "Investors seeking Shariah-compliant mandates.",
      policy: "Invests in Sukuk, Islamic deposits, and halal equities only.",
      keyFeature: "Avoids haram sectors/activities; balanced profit and stability profile.",
    },
    iDollar: {
      specialization: "USD-denominated fixed income",
      riskType: "Low",
      investorFit: "Investors preserving capital in USD with steady returns",
      benchmarkHint: "Average USD fixed-deposit rates and comparable low-risk USD investments",
      objective: "Preserve USD capital and generate stable dollar returns.",
      liquidity: "Flexible access; redemptions within 5 working days.",
      eligibility: "Investors preferring USD exposure and lower currency risk.",
      policy:
        "Invests in high-quality USD assets including government securities, corporate bonds, and offshore fixed deposits.",
      keyFeature: "Helps hedge local currency depreciation and inflation risk.",
    },
    "iEACLC-ETF": {
      specialization: "EAC large-cap equity ETF",
      riskType: "High",
      investorFit: "High-risk investors seeking medium-to-long-term East African equity growth",
      benchmarkHint:
        "Blended all-share indices: DSE, NSE, USE, and RSE",
      objective: "Grow wealth over time through listed large-cap equities across the EAC.",
      liquidity: "Units bought/sold on DSE secondary market after listing.",
      eligibility: "Investors seeking cross-market EAC equity diversification.",
      policy: "Tracks diversified large-cap listed equities across EAC markets.",
      keyFeature: "Exchange-traded regional diversification with professional daily monitoring.",
    },
  }

  const faidaProfile = {
    specialization: "Open-ended money market and debt securities scheme",
    riskType: "Low",
    investorFit: "Middle/low-income and general investors seeking savings growth with low volatility",
    benchmarkHint: "Money-market rates and low-risk debt yields",
    objective:
      "Create wealth and strengthen savings culture through competitive low-risk capital growth.",
    liquidity:
      "Repurchase on business days; processing in 1-3 days (post lock-in period, up to 3 months from initial closure).",
    eligibility:
      "Resident and non-resident Tanzanians; individuals (including minors) and institutions.",
    policy:
      "Invests in safer short-term instruments: T-bills, certificates of deposit, commercial paper, interbank call, and debt securities.",
    keyFeature:
      "No entry/exit load; min initial TZS 10,000 and additional TZS 5,000; no maximum investment.",
  } as const

  const vertexProfiles: Record<
    string,
    {
      specialization: string
      riskType: string
      investorFit: string
      benchmarkHint: string
      objective: string
      liquidity: string
      eligibility: string
      policy: string
      keyFeature: string
    }
  > = {
    "vertex-bond-fund": {
      specialization: "Fixed-income collective investment scheme",
      riskType: "Low",
      investorFit: "Individuals and institutions seeking secure, steady returns",
      benchmarkHint: "Tanzania fixed-income market / government and corporate debt yields",
      objective: "Grow wealth through accessible, lower-risk fixed-income investments.",
      liquidity: "Flexible access and redemption subject to fund terms.",
      eligibility: "Open to Tanzanian individuals and institutions.",
      policy: "Primarily allocates to fixed-income instruments in Tanzania's capital markets.",
      keyFeature:
        "CMSA-approved scheme managed by Vertex International Securities Ltd (DSE licensed dealing member).",
    },
  }

  const inukaProfiles: Record<
    string,
    {
      specialization: string
      riskType: string
      investorFit: string
      benchmarkHint: string
      objective: string
      liquidity: string
      eligibility: string
      policy: string
      keyFeature: string
    }
  > = {
    "inuka-money-market": {
      specialization: "Money market collective investment scheme",
      riskType: "Low",
      investorFit: "Investors seeking consistent returns with minimal risk",
      benchmarkHint: "Regional money-market rates (EAC/SADC)",
      objective: "Provide consistent returns with minimal risk.",
      liquidity: "High-liquidity profile typical of money market allocation (provider terms apply).",
      eligibility: "Individuals and institutions seeking lower-volatility investment.",
      policy: "Invests in money-market instruments across East African and SADC region.",
      keyFeature: "Regional money-market diversification with low-risk focus.",
    },
    "inuka-dozen-index": {
      specialization: "DSE equity index-style fund (12 listed stocks)",
      riskType: "Moderate",
      investorFit: "Investors seeking equity exposure through a concentrated listed basket",
      benchmarkHint: "Performance of selected 12 DSE-listed stocks / DSE equity market",
      objective: "Provide consistent returns through allocation to selected listed equities.",
      liquidity: "Liquidity depends on underlying listed equities and fund terms.",
      eligibility: "Individuals and institutions seeking local equity participation.",
      policy: "Invests in 12 stocks listed on Dar es Salaam Stock Exchange.",
      keyFeature: "Simple, focused exposure to a defined DSE stock basket.",
    },
  }

  if (!meta) {
    return {
      specialization: "Diversified pooled investments",
      riskType: "Moderate (assumed)",
      investorFit: "General long-term investors",
      benchmarkHint: "Compare against relevant fund peers",
      objective: "General pooled investment mandate.",
      liquidity: "Check provider terms.",
      eligibility: "Check provider terms.",
      policy: "Check provider mandate.",
      keyFeature: "Profile details not available.",
    }
  }

  if (meta.provider === "faida") return faidaProfile
  if (meta.provider === "inuka" && inukaProfiles[meta.id]) return inukaProfiles[meta.id]
  if (meta.provider === "vertex" && vertexProfiles[meta.id]) return vertexProfiles[meta.id]
  if (meta.provider === "itrust" && iTrustProfiles[meta.id]) return iTrustProfiles[meta.id]
  if (meta.provider === "utt" && uttProfiles[meta.id]) return uttProfiles[meta.id]

  const id = meta.id.toLowerCase()
  const label = meta.label.toLowerCase()
  const text = `${id} ${label}`

  if (meta.category === "etf" || text.includes("etf")) {
    return {
      specialization: "Exchange-traded basket tracking an index/market segment",
      riskType: "Moderate to high (market-linked)",
      investorFit: "Investors seeking market exposure and tradability",
      benchmarkHint: "Relevant equity index or ETF peer set",
      objective: "Track/index market performance with tradable fund units.",
      liquidity: "Exchange and provider terms apply.",
      eligibility: "Retail and institutional investors (provider rules apply).",
      policy: "Primarily allocated to index-linked listed securities.",
      keyFeature: "Exchange-traded units with intraday price visibility.",
    }
  }
  if (text.includes("money market") || text.includes("cash")) {
    return {
      specialization: "Short-term money market instruments",
      riskType: "Low",
      investorFit: "Capital preservation and short-term parking",
      benchmarkHint: "T-bill / money-market rates",
      objective: "Preserve capital while generating stable short-term returns.",
      liquidity: "Generally high; provider terms apply.",
      eligibility: "Individual and institutional investors.",
      policy: "Mainly short-tenor debt and money-market assets.",
      keyFeature: "Low volatility and higher liquidity focus.",
    }
  }
  if (text.includes("bond") || text.includes("income")) {
    return {
      specialization: "Fixed income and bond-oriented allocation",
      riskType: "Low to moderate",
      investorFit: "Income-focused investors with moderate volatility tolerance",
      benchmarkHint: "Government and corporate bond yields",
      objective: "Deliver periodic income with moderate capital growth.",
      liquidity: "Repurchase terms as per provider.",
      eligibility: "Individual and institutional investors.",
      policy: "Majority allocation in fixed-income securities.",
      keyFeature: "Income distribution-oriented strategy.",
    }
  }
  if (text.includes("index") || text.includes("dozen")) {
    return {
      specialization: "Equity index tracking",
      riskType: "Moderate to high",
      investorFit: "Long-term growth investors who accept market swings",
      benchmarkHint: "Local equity index or similar index fund",
      objective: "Capture broad equity/index performance over long term.",
      liquidity: "Repurchase/trading terms depend on structure.",
      eligibility: "Individual and institutional investors.",
      policy: "Predominantly index-representative equity allocation.",
      keyFeature: "Low-turnover diversified equity exposure.",
    }
  }

  return {
    specialization: "Diversified multi-asset / actively managed portfolio",
    riskType: "Moderate",
    investorFit: "Balanced investors targeting medium-to-long-term growth",
    benchmarkHint: "Peer mutual funds with similar mandate",
    objective: "Balance growth and stability through diversified allocation.",
    liquidity: "Repurchase terms as per provider.",
    eligibility: "Individuals and institutions subject to scheme rules.",
    policy: "Blended allocation across equity, debt, and liquid assets.",
    keyFeature: "Diversification across multiple asset classes.",
  }
}

type ChartRow = ITrustFundRecord & { label: string; labelTs: number }

const formatDateTick = (ts: number) => {
  if (!Number.isFinite(ts)) return ""
  const d = new Date(ts)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

export default function FundsPageClient({ seoIntro }: { seoIntro?: ReactNode }) {
  const defaultId = ALL_FUNDS[0]?.id ?? "iGrowth"
  const [selectedId, setSelectedId] = useState(defaultId)
  const [rows, setRows] = useState<ITrustFundRecord[]>([])
  const [meta, setMeta] = useState<FundMeta | null>(ALL_FUNDS.find((f) => f.id === defaultId) ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** One period for both NAV chart and performance analytics */
  const [fundPeriod, setFundPeriod] = useState<FundAnalyticsPeriod>("1m")
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [chartFullscreen, setChartFullscreen] = useState(false)
  const [openSidebarPanel, setOpenSidebarPanel] = useState<"snapshot" | "profile" | null>(null)
  /** Accordion: only one fund group expanded at a time */
  const [activeFundGroup, setActiveFundGroup] = useState<
    "itrustMutual" | "itrustEtf" | "utt" | "faida" | "inuka" | "vertex" | "zan" | null
  >("itrustMutual")
  const chartContainerRef = useRef<HTMLElement | null>(null)

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

  const toggleChartFullscreen = async () => {
    const host = chartContainerRef.current
    if (!host) return
    if (document.fullscreenElement === host) {
      await document.exitFullscreen()
      return
    }
    await host.requestFullscreen()
  }

  const rowsAscending = useMemo(() => {
    const parseDateSort = (dateRaw: string) => {
      // Keep sorting resilient even when upstream/cached `dateSort` was built with mixed locale parsing.
      if (!meta) return parseFlexibleDateTs(dateRaw, { preference: "day-first" })
      if (meta.provider === "inuka") {
        return parseFlexibleDateTs(dateRaw, { dashPreference: "day-first", slashPreference: "month-first" })
      }
      if (meta.provider === "itrust" || meta.provider === "vertex") {
        return parseFlexibleDateTs(dateRaw, { preference: "month-first" })
      }
      return parseFlexibleDateTs(dateRaw, { preference: "day-first" })
    }

    return [...rows]
      .map((r) => ({
        ...r,
        dateSort: parseDateSort(r.date) || r.dateSort,
      }))
      .sort((a, b) => a.dateSort - b.dateSort)
  }, [rows, meta])

  const chartData: ChartRow[] = useMemo(() => {
    const capped = filterFundRowsByPeriod(rowsAscending, fundPeriod)
    return capped.map((r) => ({
      ...r,
      label: r.date,
      labelTs: r.dateSort,
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

  const apexFundSeries = useMemo(
    () => [
      {
        name: meta?.label ?? latest?.fundName ?? selectedId,
        data: chartData.map((row) => ({
          x: row.labelTs,
          y: row.navPerUnit,
        })),
      },
    ],
    [chartData, latest?.fundName, meta?.label, selectedId],
  )

  const apexFundOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: `fund-nav-${selectedId}`,
        type: "area",
        stacked: false,
        background: "transparent",
        zoom: {
          type: "x",
          enabled: true,
          autoScaleYaxis: true,
        },
        toolbar: {
          autoSelected: "zoom",
          tools: { download: false },
        },
        animations: { enabled: false },
      },
      dataLabels: { enabled: false },
      markers: { size: 0 },
      stroke: { curve: "smooth", width: 2.5, colors: [isDarkMode ? "#10b981" : "#059669"] },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          inverseColors: false,
          opacityFrom: 0.5,
          opacityTo: 0,
          stops: [0, 90, 100],
        },
      },
      grid: { borderColor: "rgba(148, 163, 184, 0.22)", strokeDashArray: 3 },
      xaxis: {
        type: "datetime",
        labels: {
          datetimeUTC: false,
          formatter: (_value, timestamp) => formatDateTick(Number(timestamp)),
        },
      },
      yaxis: {
        title: { text: "Price" },
        labels: {
          formatter: (val) => formatCompact(Number(val)),
        },
      },
      tooltip: {
        custom: ({ dataPointIndex }) => {
          const row = chartData[dataPointIndex]
          if (!row) return ""
          return `
            <div style="padding:8px 10px;font-size:12px;line-height:1.45;">
              <div style="font-weight:600;margin-bottom:4px;">${row.date}</div>
              <div>NAV / unit: ${formatMoney(row.navPerUnit, currency)}</div>
              <div>Sale: ${formatMoney(row.salePricePerUnit, currency)}</div>
              <div>Repurchase: ${formatMoney(row.repurchasePricePerUnit, currency)}</div>
              <div>Total NAV: ${formatCompact(row.netAssetValue)}</div>
              <div>Units: ${formatCompact(row.outStandingUnits)}</div>
            </div>
          `
        },
      },
      theme: { mode: isDarkMode ? "dark" : "light" },
    }),
    [chartData, currency, isDarkMode, selectedId],
  )

  useEffect(() => {
    const onFullscreenChange = () => {
      const current = document.fullscreenElement
      setChartFullscreen(Boolean(current && chartContainerRef.current && current === chartContainerRef.current))
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

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

  const dataOwner = useMemo(() => {
    if (isUtt) return { name: "UTT AMIS", href: "https://uttamis.co.tz/" }
    if (isFaida) return { name: "Watumishi Housing", href: "https://www.whi.go.tz/" }
    if (isInuka) return { name: "Orbit Securities", href: "https://www.orbit.co.tz/" }
    if (isVertex) return { name: "Vertex", href: "https://vertex.co.tz/" }
    if (isZan) return { name: "ZAN Securities", href: "https://zansec.co.tz/" }
    return { name: "iTrust Finance", href: "https://itrust.co.tz/" }
  }, [isUtt, isFaida, isInuka, isVertex, isZan])

  const fundProfile = useMemo(() => inferFundProfile(meta), [meta])
  const inceptionDate = rowsAscending[0]?.date ?? null
  const latestDate = rowsAscending[rowsAscending.length - 1]?.date ?? null

  return (
    <div className="min-h-screen bg-background font-sans">
      <SiteHeader title="Investors Dashboard" subtitle="Uwekezaji Online">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={toggleDarkMode}>
          {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => fetchFund(selectedId)} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </SiteHeader>

      {seoIntro}

      <main className="mx-auto max-w-[1600px] px-4 py-4 lg:px-6 lg:py-5">
        <div className="mb-4 rounded-xl bg-card px-3 py-2.5 shadow-md sm:px-4 sm:py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
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
          <div className="mb-4 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive shadow-md ring-1 ring-destructive/20">
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <section
            ref={chartContainerRef}
            className={`flex flex-col rounded-xl bg-card p-4 shadow-md lg:col-span-2 ${
              chartFullscreen ? "fixed inset-0 z-[120] h-screen w-screen rounded-none border-0 p-3 sm:p-4" : ""
            }`}
          >
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{meta?.label ?? latest?.fundName ?? selectedId}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {meta?.category === "etf" ? "Exchange-traded fund" : "Mutual fund"} · NAV per unit
                  {isUtt ? <span className="ml-1">(UTT AMIS)</span> : null}
                  {isFaida ? <span className="ml-1">(Watumishi Housing)</span> : null}
                  {isInuka ? <span className="ml-1">(Orbit)</span> : null}
                  {isVertex ? <span className="ml-1">(Vertex)</span> : null}
                  {isZan ? <span className="ml-1">(ZAN Securities)</span> : null}
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
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={toggleChartFullscreen}
                  title={chartFullscreen ? "Exit fullscreen" : "Fullscreen chart"}
                >
                  {chartFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  {chartFullscreen ? "Exit" : "Full"}
                </Button>
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
            <div className={`w-full ${chartFullscreen ? "min-h-0 flex-1" : "h-[280px] lg:h-[320px]"}`}>
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading chart…</div>
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No history</div>
              ) : (
                <ReactApexChart options={apexFundOptions} series={apexFundSeries} type="area" height="100%" />
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-3">
            <div className="rounded-xl bg-card p-4 shadow-md">
              <button
                type="button"
                onClick={() => setOpenSidebarPanel((v) => (v === "snapshot" ? null : "snapshot"))}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={openSidebarPanel === "snapshot"}
              >
                <h3 className="text-xs font-semibold text-muted-foreground">Latest snapshot</h3>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    openSidebarPanel !== "snapshot" && "-rotate-90",
                  )}
                  aria-hidden
                />
              </button>
              {openSidebarPanel === "snapshot" &&
                (latest ? (
                  <dl className="mt-3 divide-y divide-border/70 text-xs">
                    <div className="flex justify-between gap-3 py-2.5 first:pt-0">
                      <dt className="text-muted-foreground">As of</dt>
                      <dd className="text-right font-medium tabular-nums">{latest.date}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2.5">
                      <dt className="text-muted-foreground">Sale price / unit</dt>
                      <dd className="text-right font-medium tabular-nums">{formatMoney(latest.salePricePerUnit, currency)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2.5">
                      <dt className="text-muted-foreground">Repurchase / unit</dt>
                      <dd className="text-right font-medium tabular-nums">{formatMoney(latest.repurchasePricePerUnit, currency)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2.5">
                      <dt className="text-muted-foreground">Total NAV</dt>
                      <dd className="text-right font-medium tabular-nums">{formatCompact(latest.netAssetValue)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2.5">
                      <dt className="text-muted-foreground">Outstanding units</dt>
                      <dd className="text-right font-medium tabular-nums">{formatCompact(latest.outStandingUnits)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">—</p>
                ))}
            </div>
            <div className="rounded-xl bg-card p-4 shadow-md">
              <button
                type="button"
                onClick={() => setOpenSidebarPanel((v) => (v === "profile" ? null : "profile"))}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={openSidebarPanel === "profile"}
              >
                <h3 className="text-xs font-semibold text-muted-foreground">Fund profile</h3>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    openSidebarPanel !== "profile" && "-rotate-90",
                  )}
                  aria-hidden
                />
              </button>
              {openSidebarPanel === "profile" && (
                <dl className="mt-3 divide-y divide-border/70 text-xs">
                  <div className="flex justify-between gap-3 py-2.5 first:pt-0">
                    <dt className="text-muted-foreground">Fund Manager</dt>
                    <dd className="text-right font-medium">{dataOwner.name}</dd>
                  </div>
                  <div className="flex justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground">Strategy</dt>
                    <dd className="text-right font-medium">
                      {fundProfile.specialization}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground">Risk</dt>
                    <dd className="text-right font-medium">{fundProfile.riskType}</dd>
                  </div>
                  <div className="flex justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground">Best for</dt>
                    <dd className="text-right font-medium">{fundProfile.investorFit}</dd>
                  </div>
                  <div className="flex justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground">Benchmark</dt>
                    <dd className="text-right font-medium">{fundProfile.benchmarkHint}</dd>
                  </div>
                  {/* <div className="flex justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground">Liquidity</dt>
                    <dd className="text-right font-medium">
                      {fundProfile.liquidity}
                    </dd>
                  </div> */}
                  <div className="flex justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground">Currency</dt>
                    <dd className="text-right font-medium">{currency}</dd>
                  </div>
                </dl>
              )}
            </div>
            <div className="rounded-xl bg-muted/30 p-3 text-[10px] leading-relaxed text-muted-foreground shadow-sm">
              Data is attributed to{" "}
              {dataOwner.href ? (
                <a
                  href={dataOwner.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {dataOwner.name}
                </a>
              ) : (
                <span className="font-medium text-foreground">{dataOwner.name}</span>
              )}
              . Values are indicative; confirm with the fund provider or your adviser before investing.
            </div>
          </aside>
        </div>

        <section className="mt-4 rounded-xl bg-card p-4 shadow-md">
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
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total return</p>
                  <p
                    className={`mt-1 text-lg font-semibold tabular-nums ${
                      (periodAnalytics.totalReturnPct ?? 0) >= 0 ? "text-chart-3" : "text-chart-5"
                    }`}
                  >
                    {formatPct(periodAnalytics.totalReturnPct)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">= ((end / start) - 1) * 100</p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Time-scaled annualized return <span className="normal-case opacity-80">(approx.)</span>
                  </p>
                  <p
                    className={`mt-1 text-lg font-semibold tabular-nums ${
                      (periodAnalytics.annualizedReturnPct ?? 0) >= 0 ? "text-chart-3" : "text-chart-5"
                    }`}
                  >
                    {formatPct(periodAnalytics.annualizedReturnPct)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    = (((end / start) - 1) * 100) / years
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Volatility <span className="normal-case opacity-80">(ann.)</span>
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatPct(periodAnalytics.volatilityAnnualizedPct)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    = std(daily returns) * sqrt(252) * 100
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Max drawdown</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-chart-5">
                    {periodAnalytics.maxDrawdownPct != null
                      ? `${Math.abs(periodAnalytics.maxDrawdownPct).toFixed(2)}%`
                      : "—"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    = min((value - running peak) / running peak) * 100
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Best / worst day</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    <span className="text-chart-3">{formatPct(periodAnalytics.bestDayPct)}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-chart-5">{formatPct(periodAnalytics.worstDayPct)}</span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    = max(daily return * 100) / min(daily return * 100)
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Period high / low NAV</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                    {periodAnalytics.periodHighNav != null ? formatMoney(periodAnalytics.periodHighNav, currency) : "—"}{" "}
                    <span className="text-muted-foreground">/</span>{" "}
                    {periodAnalytics.periodLowNav != null ? formatMoney(periodAnalytics.periodLowNav, currency) : "—"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">= max(nav), min(nav)</p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2 shadow-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Sale vs repurchase spread
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatPct(periodAnalytics.latestSpreadPct)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    = ((sale - repurchase) / nav) * 100
                  </p>
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
