"use client"

import { useState } from "react"
import { CalculatorPanel } from "@/components/investment-calculator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calculator } from "lucide-react"

export function CalculatorModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-4 z-[70] flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-primary shadow-md transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:bottom-8 lg:right-8 print:hidden"
        aria-label="Open investment calculator"
        title="Investment calculator"
      >
        <Calculator className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border bg-muted/20 px-4 py-3 pr-12 sm:px-5">
            <DialogTitle>Investment calculator</DialogTitle>
            {/* <DialogDescription>
              NAV-based fund returns, DSE stock backtests, and compound projections — educational only.
            </DialogDescription> */}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <CalculatorPanel enabled={open} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
