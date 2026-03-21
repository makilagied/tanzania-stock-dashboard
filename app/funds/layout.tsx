import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Mutual Funds & ETFs | Investor's Dashboard",
  description: "NAV history for iTrust Finance mutual funds and ETFs (iCash, iGrowth, iSave, iIncome, Imaan, iDollar, iEACLC ETF).",
}

export default function FundsLayout({ children }: { children: ReactNode }) {
  return children
}
