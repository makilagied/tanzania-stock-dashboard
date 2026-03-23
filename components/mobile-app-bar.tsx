"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, PieChart } from "lucide-react"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/", label: "Stocks", Icon: BarChart3 },
  { href: "/funds", label: "Funds", Icon: PieChart },
] as const

export function MobileAppBar() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-border/80 bg-background/95 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-md print:hidden dark:shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.35)] lg:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-0.5">
        {ITEMS.map(({ href, label, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-semibold tracking-tight transition-colors active:bg-muted/60",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-muted-foreground")}
                strokeWidth={active ? 2.25 : 2}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </div>
      {/* Home indicator safe area (iOS) */}
      <div
        className="h-[env(safe-area-inset-bottom,0px)] min-h-0 bg-background/95"
        aria-hidden
      />
    </nav>
  )
}
