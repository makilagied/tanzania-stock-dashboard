import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Funds & ETFs",
  description:
    "NAV history for iTrust Finance mutual funds and ETFs (iCash, iGrowth, iSave, iIncome, Imaan, iDollar, iEACLC ETF) and more — Uwekezaji Online.",
}

export default function FundsLayout({ children }: { children: ReactNode }) {
  return children
}
