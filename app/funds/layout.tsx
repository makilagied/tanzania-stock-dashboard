import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Mutual funds & ETFs — NAV history",
  description:
    "Mifuko ya uwekezaji Tanzania: UTT, iTrust, Inuka, Faida, Vertex, ZAN — historia ya NAV, chati, na mapato ya kipindi. English: mutual funds, ETFs, and index funds — NAV history on Uwekezaji Online.",
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
    title: "Mutual funds & ETFs — Uwekezaji Online",
    description:
      "Mifuko ya uwekezaji: UTT, iTrust, Inuka, Faida na zaidi — NAV na chati. Tanzania mutual funds & ETFs.",
    url: "/funds",
    locale: "en_TZ",
    alternateLocale: ["sw_TZ"],
  },
  twitter: {
    title: "Mutual funds & ETFs — Uwekezaji Online",
    description:
      "UTT, iTrust, Inuka, Faida — mifuko ya uwekezaji na NAV. Tanzania fund analytics.",
  },
}

export default function FundsLayout({ children }: { children: ReactNode }) {
  return children
}
