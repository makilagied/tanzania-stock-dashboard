"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Stocks", short: "Stocks" },
  { href: "/funds", label: "Funds & ETFs", short: "Funds" },
  { href: "/compare", label: "Compare", short: "Compare" },
] as const

export type SiteHeaderProps = {
  title: string
  subtitle: string
  children?: ReactNode
}

export function SiteHeader({ title, subtitle, children }: SiteHeaderProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex min-h-12 max-w-[1600px] items-center gap-2 px-4 py-2 sm:min-h-[3.25rem] sm:gap-3 lg:px-6">
        <Link
          href="/"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:gap-3"
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-sm ring-1 ring-border/60 bg-background">
            <Image
              src="/icon-uwekezaji.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
          </span>
          <div className="min-w-0 max-w-[min(11rem,46vw)] sm:max-w-[min(18rem,42vw)] md:max-w-xs lg:max-w-md">
            <p className="truncate text-xs font-semibold leading-snug tracking-tight sm:text-[13px]">{title}</p>
            <p className="truncate text-[10px] leading-snug text-muted-foreground sm:text-[11px] hidden sm:block">
              {subtitle}
            </p>
          </div>
        </Link>

        <nav
          className="hidden shrink-0 items-center rounded-lg border border-border/80 bg-muted/40 p-0.5 shadow-sm lg:flex"
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

        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-1.5">{children}</div>
      </div>
    </header>
  )
}
