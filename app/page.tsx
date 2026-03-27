import type { Metadata } from "next"
import { SeoIntroStocks } from "@/components/seo-intro"
import HomePage from "./stocks-dashboard-client"

export const metadata: Metadata = {
  title: "Tanzania Stocks & Funds Dashboard · Uwekezaji Online",
  description:
    "Tanzania stocks and funds in one place: live DSE market prices, indices, and charts plus mutual funds and ETFs (UTT, iTrust, Inuka, Faida, Vertex, ZAN) with NAV history and analytics.",
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
    title: "Tanzania Stocks & Funds Dashboard · Uwekezaji Online",
    description:
      "Live DSE stocks, indices, and charts plus mutual funds and ETFs with NAV history and analytics in one dashboard.",
    url: "/",
    locale: "en_TZ",
    alternateLocale: ["sw_TZ"],
  },
  twitter: {
    title: "Tanzania Stocks & Funds Dashboard · Uwekezaji Online",
    description:
      "Track Tanzania stocks and funds together: DSE market data plus NAV and fund analytics.",
  },
}

export default function Page() {
  return <HomePage seoIntro={<SeoIntroStocks />} />
}
