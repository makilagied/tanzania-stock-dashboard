"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Stocks", short: "Stocks" },
  { href: "/funds", label: "Funds & ETFs", short: "Funds" },
] as const

export type SiteHeaderProps = {
  icon: LucideIcon
  title: string
  subtitle: string
  children?: ReactNode
}

export function SiteHeader({ icon: Icon, title, subtitle, children }: SiteHeaderProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex min-h-12 max-w-[1600px] items-center gap-2 px-4 py-2 sm:min-h-[3.25rem] sm:gap-3 lg:px-6">
        {/* Brand: icon + titles (titles visible on all widths; subtitle from sm+) */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <Icon className="h-4 w-4 text-primary-foreground" aria-hidden />
          </div>
          <div className="min-w-0 max-w-[min(11rem,46vw)] sm:max-w-[min(18rem,42vw)] md:max-w-xs lg:max-w-md">
            <p className="truncate text-xs font-semibold leading-snug tracking-tight sm:text-[13px]">{title}</p>
            <p className="truncate text-[10px] leading-snug text-muted-foreground sm:text-[11px] hidden sm:block">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Primary nav — segmented, vertically centered with brand */}
        <nav
          className="flex shrink-0 items-center rounded-lg border border-border/80 bg-muted/40 p-0.5 shadow-sm"
          aria-label="Main"
        >
          {NAV.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative inline-flex h-8 shrink-0 items-center justify-center rounded-md px-2.5 text-[11px] font-medium transition-colors sm:h-8 sm:px-3 sm:text-xs",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                <span className="sm:hidden">{item.short}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-1.5">{children}</div>
      </div>
    </header>
  )
}
