import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Investors Dashboard",
  description:
    "Investors Dashboard — Uwekezaji Online. Live DSE equities and local mutual fund analytics. ",
}

export default function FundsLayout({ children }: { children: ReactNode }) {
  return children
}
