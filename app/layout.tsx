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
  title: "Investor's Dashboard",
  description: "Real-time stock market data from Dar es Salaam Stock Exchange",
    generator: 'makilagied'
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
