"use client"

import Image from "next/image"
import { useContext, useEffect, useMemo, useState } from "react"
import { ChartAiAssistant, type ChartAiPageContext } from "@/components/chart-ai-assistant"
import { ChartAssistantContext } from "@/components/chart-assistant-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Coffee } from "lucide-react"

const JOLENE_AVATAR = "/jolene-assistant.png"

const MOBILE_MAX_WIDTH = 1023

const DEFAULT_PAGE_CONTEXT: ChartAiPageContext = {
  route: "none",
  selectedSymbol: "CRDB",
  stockPeriod: "1m",
  chartType: "candlestick",
  staleFeedAt: null,
}

export function ChartAssistantModal() {
  const ctx = useContext(ChartAssistantContext)
  if (!ctx) {
    throw new Error("ChartAssistantModal must be rendered inside ChartAssistantProvider")
  }
  const { binding } = ctx

  const [open, setOpen] = useState(false)
  const [isFooterVisible, setIsFooterVisible] = useState(false)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [mobileCoffeePromo, setMobileCoffeePromo] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`)
    const sync = () => setIsMobileLayout(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    const footer = document.getElementById("site-footer")
    if (!footer) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setIsFooterVisible(Boolean(entry?.isIntersecting))
      },
      { threshold: 0.2 },
    )
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isMobileLayout || isFooterVisible) {
      setMobileCoffeePromo(false)
      return
    }
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>
    const assistantMs = 10_000
    const coffeeMs = 5_000

    const cycle = () => {
      setMobileCoffeePromo(false)
      timeoutId = setTimeout(() => {
        if (cancelled) return
        setMobileCoffeePromo(true)
        timeoutId = setTimeout(() => {
          if (cancelled) return
          cycle()
        }, coffeeMs)
      }, assistantMs)
    }

    cycle()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [isMobileLayout, isFooterVisible])

  const showCoffeeFab = isFooterVisible || mobileCoffeePromo

  const onFabClick = () => {
    if (showCoffeeFab) {
      window.open("https://snippe.me/pay/makilagied", "_blank", "noopener,noreferrer")
      return
    }
    setOpen(true)
  }

  const openJolene = () => setOpen(true)

  const pageContext = binding?.pageContext ?? DEFAULT_PAGE_CONTEXT
  const onApplyDashboardPatch = binding?.onApplyDashboardPatch ?? (() => {})

  const chartLinked = Boolean(binding)

  const subtitle = useMemo(() => {
    if (!chartLinked) {
      return "Open Stocks, Funds, or Compare — Jolene syncs with whichever page you are on."
    }
    const route = typeof pageContext.route === "string" ? pageContext.route : "stocks"
    if (route === "funds") {
      const id = typeof pageContext.selectedId === "string" ? pageContext.selectedId : "—"
      const fp = typeof pageContext.fundPeriod === "string" ? pageContext.fundPeriod : "—"
      return `Funds · ${id} · ${String(fp).toUpperCase()}`
    }
    if (route === "compare") {
      const lk = pageContext.leftKind ?? "?"
      const rk = pageContext.rightKind ?? "?"
      const lp =
        lk === "stock"
          ? (pageContext.leftStock as string) ?? "—"
          : (pageContext.leftFund as string) ?? "—"
      const rp =
        rk === "stock"
          ? (pageContext.rightStock as string) ?? "—"
          : (pageContext.rightFund as string) ?? "—"
      const p = typeof pageContext.period === "string" ? pageContext.period : "—"
      return `Compare · ${String(lk)}:${lp} vs ${String(rk)}:${rp} · ${String(p).toUpperCase()}`
    }
    const sym = typeof pageContext.selectedSymbol === "string" ? pageContext.selectedSymbol : "—"
    const sp = typeof pageContext.stockPeriod === "string" ? pageContext.stockPeriod : "—"
    const ct = typeof pageContext.chartType === "string" ? pageContext.chartType : "—"
    return `Stocks · ${sym} · ${String(sp).toUpperCase()} · ${ct}`
  }, [chartLinked, pageContext])

  return (
    <>
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-4 z-[70] flex flex-col items-end gap-2 lg:bottom-8 lg:right-8 print:hidden">
        {!showCoffeeFab && (
          <button
            type="button"
            onClick={openJolene}
            className="fab-assistant-hint max-w-[min(calc(100vw-5.5rem),200px)] cursor-pointer rounded-2xl border border-emerald-500/25 bg-card/95 px-3 py-1.5 text-center text-[11px] font-semibold leading-tight text-foreground shadow-md backdrop-blur-sm transition-[border-color,background-color,transform] hover:border-emerald-500/45 hover:bg-muted/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:max-w-none sm:text-xs"
            aria-label="Open Jolene — charts and data"
          >
            Ask Jolene — charts & data
          </button>
        )}
        <button
          type="button"
          onClick={onFabClick}
          className={`flex cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border bg-card text-primary shadow-md transition-[width,height,padding,gap,transform,box-shadow] duration-500 ease-out hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] ${
            showCoffeeFab
              ? "h-12 max-w-[min(calc(100vw-2rem),280px)] gap-2 px-4"
              : "fab-assistant-glow h-14 w-14 max-w-14 gap-0 p-0"
          }`}
          aria-label={showCoffeeFab ? "Buy me a coffee" : "Open Jolene"}
          title={showCoffeeFab ? "Buy me a coffee" : "Jolene — assistant"}
          aria-live="polite"
        >
          {showCoffeeFab ? (
            <>
              <Coffee className="h-5 w-5 shrink-0 animate-in fade-in zoom-in-95 duration-300" strokeWidth={2} aria-hidden />
              <span className="whitespace-nowrap text-xs font-semibold animate-in fade-in slide-in-from-right-2 duration-300">
                Buy me a coffee
              </span>
            </>
          ) : (
            <span className="fab-assistant-avatar relative block h-14 w-14 shrink-0 overflow-hidden rounded-full">
              <Image
                src={JOLENE_AVATAR}
                alt=""
                fill
                sizes="56px"
                className="object-cover object-top"
                priority
              />
            </span>
          )}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          overlayClassName="fixed inset-0 z-[80] bg-black/25 backdrop-blur-none"
          className="overflow-visible border-none bg-transparent p-0 shadow-none sm:max-w-xl"
        >
          <div className="relative">
            <div className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500/15 via-transparent to-primary/15 opacity-90" />
            <div className="relative flex max-h-[min(90vh,720px)] flex-col overflow-hidden rounded-3xl border border-border/50 bg-card shadow-2xl">
              <DialogHeader className="shrink-0 border-b border-border/50 bg-muted/30 px-4 py-3 pr-12 sm:px-5">
                <div className="flex items-start gap-3">
                  <div className="relative mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted shadow-sm">
                    <Image
                      src={JOLENE_AVATAR}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover object-top"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-sm font-semibold sm:text-base">Jolene</DialogTitle>
                    <p className="truncate text-[10px] font-normal text-muted-foreground">{subtitle}</p>
                  </div>
                </div>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
                <ChartAiAssistant
                  pageContext={pageContext}
                  onApplyDashboardPatch={onApplyDashboardPatch}
                  variant="panel"
                  enabled={open}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
