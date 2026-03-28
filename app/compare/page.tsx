import type { Metadata } from "next"
import ComparePageClient from "./compare-page-client"

export const metadata: Metadata = {
  title: "Compare stocks & funds",
  description:
    "Compare two DSE stocks, two mutual funds/ETFs, or a stock versus a fund: period returns, volatility, drawdowns, and normalized performance on one chart.",
}

export default function ComparePage() {
  return <ComparePageClient />
}
