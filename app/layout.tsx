import type React from "react"
import type { Metadata } from "next"
import { Playfair_Display, Source_Sans_3 as Source_Sans_Pro } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

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

export const metadata: Metadata = {
  metadataBase: new URL("https://www.uwekezaji.online"),
  title: {
    default: "Investors Dashboard · Uwekezaji Online",
    template: "%s · Uwekezaji Online",
  },
  description:
    "Uwekezaji Online — DSE stocks and mutual funds. Live market data from the Dar es Salaam Stock Exchange.",
  generator: "makilagied",
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
    siteName: "Uwekezaji Online",
    images: [{ url: "/logo-uwekezaji.png", alt: "Investors Dashboard — Uwekezaji Online" }],
  },
  twitter: {
    card: "summary_large_image",
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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme" disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
