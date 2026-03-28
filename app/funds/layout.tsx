import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Tanzania Stocks & Funds Dashboard · Uwekezaji Online",
  description:
    "Tanzania stocks and funds in one place: live DSE market prices, indices, and charts plus mutual funds and ETFs (UTT, iTrust, Inuka, Faida, Vertex, ZAN) with NAV history and analytics.",
  alternates: { canonical: "/funds" },
  keywords: [
    "uwekezaji",
    "mifuko ya uwekezaji",
    "mifuko ya uwekezaji Tanzania",
    "soko la hisa Tanzania",
    "UTT",
    "iTrust",
    "Inuka",
    "Faida",
    "Vertex",
    "ZAN",
    "mfuko wa indeksi",
    "index fund Tanzania",
    "ETF Tanzania",
    "NAV",
    "Tanzania mutual funds",
    "DSE ETFs",
    "NAV history",
    "Uwekezaji Online",
    "Tanzania unit trusts",
  ],
  openGraph: {
    title: "Tanzania Stocks & Funds Dashboard · Uwekezaji Online",
    description:
      "Live DSE stocks, indices, and charts plus mutual funds and ETFs with NAV history and analytics in one dashboard.",
    url: "/funds",
    locale: "en_TZ",
    alternateLocale: ["sw_TZ"],
  },
  twitter: {
    title: "Tanzania Stocks & Funds Dashboard · Uwekezaji Online",
    description:
      "Track Tanzania stocks and funds together: DSE market data plus NAV and fund analytics.",
  },
}

export default function FundsLayout({ children }: { children: ReactNode }) {
  return children
}
