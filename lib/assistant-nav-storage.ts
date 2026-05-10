import type { ChartDashboardPatch } from "@/lib/ai-chart-agent-tools"

export const ASSISTANT_NAV_STORAGE_KEY = "uwk_assistant_nav"

export type StoredAssistantNav = {
  path: string
  patch: ChartDashboardPatch
}

export function storeAssistantNavigation(path: string, patch: ChartDashboardPatch) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(ASSISTANT_NAV_STORAGE_KEY, JSON.stringify({ path, patch } as StoredAssistantNav))
  } catch {
    /* quota / private mode */
  }
}

/** Call once on mount for a dashboard route; returns patch if this navigation was intended for `path`. */
export function consumeAssistantNavigationForPath(path: string): ChartDashboardPatch | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(ASSISTANT_NAV_STORAGE_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as StoredAssistantNav
    sessionStorage.removeItem(ASSISTANT_NAV_STORAGE_KEY)
    if (data.path !== path) return null
    return data.patch ?? {}
  } catch {
    sessionStorage.removeItem(ASSISTANT_NAV_STORAGE_KEY)
    return null
  }
}

export const ASSISTANT_ALLOWED_NAV_PATHS = ["/", "/funds", "/compare"] as const
export type AssistantNavPath = (typeof ASSISTANT_ALLOWED_NAV_PATHS)[number]

export function isAssistantNavPath(s: string): s is AssistantNavPath {
  return (ASSISTANT_ALLOWED_NAV_PATHS as readonly string[]).includes(s)
}
