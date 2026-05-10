"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type { ChartDashboardPatch } from "@/lib/ai-chart-agent-tools"
import type { ChartAiPageContext } from "@/components/chart-ai-assistant"

export type ChartAssistantPageBinding = {
  pageContext: ChartAiPageContext
  onApplyDashboardPatch: (patch: ChartDashboardPatch) => void
}

type Ctx = {
  binding: ChartAssistantPageBinding | null
  register: (b: ChartAssistantPageBinding) => void
  unregister: () => void
}

export const ChartAssistantContext = createContext<Ctx | null>(null)

export function ChartAssistantProvider({ children }: { children: ReactNode }) {
  const [binding, setBinding] = useState<ChartAssistantPageBinding | null>(null)
  const register = useCallback((b: ChartAssistantPageBinding) => {
    setBinding(b)
  }, [])
  const unregister = useCallback(() => {
    setBinding(null)
  }, [])
  const value = useMemo(() => ({ binding, register, unregister }), [binding, register, unregister])
  return <ChartAssistantContext.Provider value={value}>{children}</ChartAssistantContext.Provider>
}

export function useChartAssistantPage() {
  const ctx = useContext(ChartAssistantContext)
  if (!ctx) {
    throw new Error("useChartAssistantPage must be used within ChartAssistantProvider")
  }
  return ctx
}
