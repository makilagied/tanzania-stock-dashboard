"use client"

import { useEffect, useState } from "react"
import { CalculatorPanel } from "@/components/investment-calculator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calculator, Coffee } from "lucide-react"

const MOBILE_MAX_WIDTH = 1023

export function CalculatorModal() {
  const [open, setOpen] = useState(false)
  const [isFooterVisible, setIsFooterVisible] = useState(false)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  /** On small screens, cycle FAB to coffee promo when footer is not in view */
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
    const calculatorMs = 10_000
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
      }, calculatorMs)
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

  return (
    <>
      <button
        type="button"
        onClick={onFabClick}
        className={`fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-4 z-[70] flex items-center justify-center overflow-hidden rounded-full border border-border bg-card text-primary shadow-md transition-[width,height,padding,gap,transform] duration-500 ease-out hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] lg:bottom-8 lg:right-8 print:hidden ${
          showCoffeeFab ? "h-12 max-w-[min(calc(100vw-2rem),280px)] gap-2 px-4" : "h-14 w-14 max-w-14 gap-0 px-0"
        }`}
        aria-label={showCoffeeFab ? "Buy me a coffee" : "Open investment calculator"}
        title={showCoffeeFab ? "Buy me a coffee" : "Investment calculator"}
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
          <Calculator className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-visible border-none bg-transparent p-0 shadow-none sm:max-w-xl">
          <div className="relative">
            <div className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-transparent to-primary/20 opacity-80 blur-xl" />
            <div className="relative flex max-h-[min(90vh,720px)] flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/90 shadow-2xl backdrop-blur-xl">
              <DialogHeader className="shrink-0 border-b border-border/50 bg-muted/30 px-4 py-3 pr-12 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <DialogTitle className="text-sm font-semibold sm:text-base">Investment calculator</DialogTitle>
                </div>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
                <CalculatorPanel enabled={open} />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
