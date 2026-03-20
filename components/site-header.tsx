"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Market", short: "Market" },
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
      <div className="mx-auto flex h-13 max-w-[1600px] items-center gap-2 px-4 lg:gap-4 lg:px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
            <Icon className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-xs font-semibold leading-none">{title}</p>
            <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <nav className="flex min-w-0 shrink-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-1">
          {NAV.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 shrink-0 px-2 text-[10px] sm:text-[11px]",
                isActive(item.href) && "bg-muted font-medium text-foreground",
              )}
              asChild
            >
              <Link href={item.href}>
                <span className="sm:hidden">{item.short}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            </Button>
          ))}
        </nav>

        <div className="min-w-2 flex-1" />

        <div className="flex shrink-0 items-center gap-1">{children}</div>
      </div>
    </header>
  )
}
