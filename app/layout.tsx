import type React from "react"
import type { Metadata } from "next"
import Script from "next/script"
import { Playfair_Display, Source_Sans_3 as Source_Sans_Pro } from "next/font/google"
import { CalculatorModal } from "@/components/calculator-modal"
import { MobileAppBar } from "@/components/mobile-app-bar"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

/** Google Analytics 4 — override with `NEXT_PUBLIC_GA_MEASUREMENT_ID` in env */
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-LPM333VNRE"

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair-display",
})

const sourceSansPro = Source_Sans_Pro({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source-sans-pro",
  weight: ["400", "600", "700"],
})

const siteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Uwekezaji Online",
  alternateName: [
    "Investors Dashboard",
    "Uwekezaji",
    "Soko la hisa Tanzania",
    "Mifuko ya uwekezaji — UTT, iTrust, Inuka, Faida",
  ],
  url: "https://www.uwekezaji.online",
  description:
    "Uwekezaji Online (Investors Dashboard): soko la hisa Tanzania (DSE), mifuko ya uwekezaji (UTT, iTrust, Inuka, Faida, Vertex, ZAN), faharasa/indeksi na bei za moja kwa moja.",
  inLanguage: "en-TZ",
  publisher: {
    "@type": "Organization",
    name: "Uwekezaji Online",
    url: "https://www.uwekezaji.online",
  },
}

export const metadata: Metadata = {
  metadataBase: new URL("https://www.uwekezaji.online"),
  title: {
    default: "Tanzania Stocks & Funds Dashboard · Uwekezaji Online",
    template: "%s · Uwekezaji Online",
  },
  description:
    "Tanzania stocks and funds in one place: live DSE market prices, indices, and charts plus mutual funds and ETFs (UTT, iTrust, Inuka, Faida, Vertex, ZAN) with NAV history and analytics.",
  generator: "makilagied",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon-uwekezaji.svg", type: "image/svg+xml" },
      { url: "/icon-uwekezaji.png", type: "image/png" },
    ],
    apple: "/icon-uwekezaji.png",
  },
  openGraph: {
    type: "website",
    locale: "en_TZ",
    alternateLocale: ["sw_TZ"],
    siteName: "Uwekezaji Online",
    title: "Tanzania Stocks & Funds Dashboard · Uwekezaji Online",
    description:
      "Live DSE stocks, indices, and charts plus mutual funds and ETFs with NAV history and analytics in one dashboard.",
    images: [{ url: "/logo-uwekezaji.png", alt: "Investors Dashboard — Uwekezaji Online" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tanzania Stocks & Funds Dashboard · Uwekezaji Online",
    description:
      "Track Tanzania stocks and funds together: DSE market data plus NAV and fund analytics.",
    images: ["/logo-uwekezaji.png"],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${playfairDisplay.variable} ${sourceSansPro.variable} antialiased`}>
      <body className="font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme" disableTransitionOnChange>
          <div className="pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0">{children}</div>
          <CalculatorModal />
          <MobileAppBar />
        </ThemeProvider>
      </body>
    </html>
  )
}
