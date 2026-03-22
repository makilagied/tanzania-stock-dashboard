import type { Metadata } from "next"
import { SeoIntroStocks } from "@/components/seo-intro"
import HomePage from "./stocks-dashboard-client"

export const metadata: Metadata = {
  title: "DSE stocks & live market data",
  description:
    "Soko la hisa Tanzania (DSE): bei za moja kwa moja, faharasa ya soko, hisa zilizopanda na kushuka, na undani wa soko — Uwekezaji Online. English: live DSE prices, indices, top movers, charts, and market depth.",
  alternates: { canonical: "/" },
  keywords: [
    "uwekezaji",
    "Uwekezaji Online",
    "soko la hisa Tanzania",
    "hisa Tanzania",
    "soko la hisa",
    "mifuko ya uwekezaji",
    "DSE",
    "Dar es Salaam Stock Exchange",
    "faharasa ya soko",
    "indeksi DSE",
    "stock index Tanzania",
    "Tanzania stocks",
    "Investors Dashboard",
    "TZS",
    "DSE live prices",
    "UTT",
    "iTrust",
    "Inuka",
    "Faida",
  ],
  openGraph: {
    title: "DSE stocks & live market data · Uwekezaji Online",
    description:
      "Soko la hisa Tanzania (DSE): bei za moja kwa moja, faharasa, hisa zilizopanda na kushuka. Live prices, indices, movers, charts.",
    url: "/",
    locale: "en_TZ",
    alternateLocale: ["sw_TZ"],
  },
  twitter: {
    title: "DSE stocks & live market data · Uwekezaji Online",
    description:
      "Soko la hisa Tanzania — bei za moja kwa moja, faharasa na chati. Live DSE data.",
  },
}

export default function Page() {
  return <HomePage seoIntro={<SeoIntroStocks />} />
}
