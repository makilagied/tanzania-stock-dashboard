"use client"

import { ChevronDown, ChevronUp, Loader2, Settings2 } from "lucide-react"
import {
  clearJoleneDeviceMemory,
  clearJoleneMemorySessionCookie,
  getJoleneRememberChatsPreference,
  hasJolenePersistedBlobInIdb,
  loadJoleneDeviceMemory,
  normalizeJolenePayload,
  saveJoleneDeviceMemory,
  setJoleneRememberChatsPreference,
} from "@/lib/jolene-device-memory"
import { isAssistantNavPath, storeAssistantNavigation } from "@/lib/assistant-nav-storage"
import { stripSimpleMarkdownForDisplay } from "@/lib/strip-simple-markdown"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import type { ChartDashboardPatch } from "@/lib/ai-chart-agent-tools"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"

const JOLENE_AVATAR = "/jolene-assistant.png"
const JOLENE_NAME = "Jolene "

const MAX_API_MESSAGES = 40

/** Scroll still works; scrollbar hidden (matches compare / stocks panels). */
const CHAT_SCROLL_NO_BAR =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"

export type ChartAiAssistantVariant = "collapsible" | "panel"

/** Sent to the API; shape depends on active page (stocks / funds / compare). */
export type ChartAiPageContext = Record<string, unknown>

function hasDashboardPatchKeys(patch: ChartDashboardPatch) {
  return !!(
    patch.symbol ||
    patch.period ||
    patch.chartType ||
    patch.fundId ||
    patch.fundPeriod ||
    patch.leftKind ||
    patch.rightKind ||
    patch.leftStock ||
    patch.rightStock ||
    patch.leftFund ||
    patch.rightFund ||
    patch.comparePeriod
  )
}

type ChatTurn = { role: "user" | "assistant"; content: string }

function mergePatchMemory(prev: Record<string, unknown>, patch: ChartDashboardPatch): Record<string, unknown> {
  const next = { ...prev }
  for (const [k, v] of Object.entries(patch) as [string, unknown][]) {
    if (v !== undefined && v !== null) next[k] = v
  }
  return next
}

type Props = {
  pageContext: ChartAiPageContext
  onApplyDashboardPatch: (patch: ChartDashboardPatch) => void
  /** `panel` = full chat for modal (no collapse header). */
  variant?: ChartAiAssistantVariant
  /** When false, network sends are disabled (e.g. dialog closed). */
  enabled?: boolean
}

export function ChartAiAssistant({
  pageContext,
  onApplyDashboardPatch,
  variant = "collapsible",
  enabled = true,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(variant === "panel")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [persistenceEnabled, setPersistenceEnabled] = useState(false)
  const [rememberChats, setRememberChats] = useState(true)
  const [serverConfigured, setServerConfigured] = useState(false)
  const [hasIndexedDbBlob, setHasIndexedDbBlob] = useState(false)
  const [storageReady, setStorageReady] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const settingsPanelRef = useRef<HTMLDivElement | null>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const chartMemoryRef = useRef({
    chartSnapshot: {} as Record<string, unknown>,
    lastDashboardPatch: {} as Record<string, unknown>,
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const remember = getJoleneRememberChatsPreference()
      if (cancelled) return
      setRememberChats(remember)
      const { memory, persistence, serverConfigured: cfg } = await loadJoleneDeviceMemory()
      if (cancelled) return
      setServerConfigured(cfg)
      if (!cfg && remember) {
        setJoleneRememberChatsPreference(false)
        setRememberChats(false)
        setPersistenceEnabled(false)
        setHasIndexedDbBlob(false)
      } else {
        setPersistenceEnabled(persistence)
        if (memory) {
          chartMemoryRef.current = {
            chartSnapshot: memory.chartSnapshot,
            lastDashboardPatch: memory.lastDashboardPatch,
          }
          setMessages(memory.messages)
          setHasIndexedDbBlob(true)
        } else if (remember && persistence) {
          setHasIndexedDbBlob(await hasJolenePersistedBlobInIdb())
        } else {
          setHasIndexedDbBlob(false)
        }
      }
      setStorageReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!storageReady || !persistenceEnabled) return
    const empty =
      messages.length === 0 &&
      Object.keys(chartMemoryRef.current.chartSnapshot).length === 0 &&
      Object.keys(chartMemoryRef.current.lastDashboardPatch).length === 0
    if (empty) return
    const t = window.setTimeout(() => {
      void saveJoleneDeviceMemory(
        normalizeJolenePayload({
          v: 1,
          updatedAt: Date.now(),
          messages,
          chartSnapshot: chartMemoryRef.current.chartSnapshot,
          lastDashboardPatch: chartMemoryRef.current.lastDashboardPatch,
        }),
      ).then((ok) => {
        if (ok) setHasIndexedDbBlob(true)
      })
    }, 400)
    return () => window.clearTimeout(t)
  }, [messages, storageReady, persistenceEnabled])

  useEffect(() => {
    if (!settingsOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const n = e.target as Node
      if (settingsPanelRef.current?.contains(n)) return
      if (settingsTriggerRef.current?.contains(n)) return
      setSettingsOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [settingsOpen])

  const onRememberChatsChange = async (checked: boolean) => {
    if (checked) {
      setJoleneRememberChatsPreference(true)
      const { memory, persistence, serverConfigured: cfg } = await loadJoleneDeviceMemory()
      setServerConfigured(cfg)
      if (!persistence) {
        setJoleneRememberChatsPreference(false)
        setRememberChats(false)
        setPersistenceEnabled(false)
        return
      }
      setRememberChats(true)
      setPersistenceEnabled(true)
      if (memory) {
        chartMemoryRef.current = {
          chartSnapshot: memory.chartSnapshot,
          lastDashboardPatch: memory.lastDashboardPatch,
        }
        setMessages(memory.messages)
        setHasIndexedDbBlob(true)
      } else {
        setHasIndexedDbBlob(await hasJolenePersistedBlobInIdb())
      }
      return
    }
    setPersistenceEnabled(false)
    setRememberChats(false)
    setJoleneRememberChatsPreference(false)
    setHasIndexedDbBlob(false)
    await clearJoleneDeviceMemory()
    await clearJoleneMemorySessionCookie()
  }

  const onClearConversation = () => {
    setMessages([])
    setInput("")
    setError(null)
  }

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, open, scrollToBottom])

  const send = async () => {
    const text = input.trim()
    if (!text || loading || !enabled) return
    setInput("")
    setError(null)
    const nextThread: ChatTurn[] = [...messages, { role: "user", content: text }]
    setMessages(nextThread)
    chartMemoryRef.current.chartSnapshot = { ...chartMemoryRef.current.chartSnapshot, ...pageContext }
    setLoading(true)
    try {
      const apiMessages = nextThread.slice(-MAX_API_MESSAGES)
      const res = await fetch("/api/ai/chart-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          pageContext,
          deviceMemory: {
            chartSnapshot: chartMemoryRef.current.chartSnapshot,
            lastDashboardPatch: chartMemoryRef.current.lastDashboardPatch,
          },
        }),
      })
      const data = (await res.json()) as {
        error?: string
        reply?: string
        dashboardPatch?: ChartDashboardPatch
        navigationPath?: string
      }
      if (!res.ok) {
        setError(data.error || `Request failed (${res.status})`)
        return
      }
      const reply = data.reply?.trim() || "—"
      const patch = data.dashboardPatch
      chartMemoryRef.current.chartSnapshot = { ...chartMemoryRef.current.chartSnapshot, ...pageContext }
      if (patch && hasDashboardPatchKeys(patch)) {
        chartMemoryRef.current.lastDashboardPatch = mergePatchMemory(chartMemoryRef.current.lastDashboardPatch, patch)
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }])
      const nav = data.navigationPath
      if (typeof nav === "string" && isAssistantNavPath(nav)) {
        storeAssistantNavigation(nav, patch ?? {})
        router.push(nav)
      } else if (patch && hasDashboardPatchKeys(patch)) {
        onApplyDashboardPatch(patch)
      }
    } catch {
      setError("Network error — try again.")
    } finally {
      setLoading(false)
    }
  }

  const onClearDeviceMemory = async () => {
    await clearJoleneDeviceMemory()
    chartMemoryRef.current = { chartSnapshot: {}, lastDashboardPatch: {} }
    setMessages([])
    setHasIndexedDbBlob(false)
    setInput("")
    setError(null)
    setSettingsOpen(false)
  }

  const chartOrPatchStored =
    Object.keys(chartMemoryRef.current.chartSnapshot).length > 0 ||
    Object.keys(chartMemoryRef.current.lastDashboardPatch).length > 0

  const showClearSavedMemory =
    rememberChats && persistenceEnabled && (messages.length > 0 || chartOrPatchStored || hasIndexedDbBlob)

  const listMaxClass =
    variant === "panel"
      ? "max-h-[min(48vh,400px)] sm:max-h-[min(52vh,440px)]"
      : "max-h-[220px]"

  const settingsPanelPositionClass =
    variant === "panel"
      ? "absolute right-0 top-full z-[90] mt-1 w-[min(calc(100vw-2rem),18rem)]"
      : "absolute right-2 top-full z-[90] mt-1 w-[min(calc(100vw-3rem),18rem)]"

  const chatSettingsPanel = settingsOpen ? (
    <div
      ref={settingsPanelRef}
      role="dialog"
      aria-label="Chat settings"
      className={`${settingsPanelPositionClass} space-y-3 rounded-lg border border-border bg-card p-3 shadow-lg`}
    >
      <div className="border-b border-border/60 pb-2">
        <p className="text-sm font-semibold text-foreground">Chat settings</p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          Remember charts, clear this conversation, or remove saved device data.
        </p>
      </div>
      {!serverConfigured && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs leading-snug text-amber-950 dark:text-amber-100">
          Saved memory is unavailable: set{" "}
          <code className="rounded bg-background/80 px-0.5 font-mono text-[11px]">JOLENE_MEMORY_MASTER_KEY</code> in
          your server <code className="font-mono text-[11px]">.env</code> (32-byte secret, e.g.{" "}
          <code className="font-mono text-[11px]">openssl rand -base64 32</code>).
        </p>
      )}
      <label className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-muted-foreground">
        <input
          type="checkbox"
          disabled={!serverConfigured}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary disabled:cursor-not-allowed disabled:opacity-50"
          checked={rememberChats}
          onChange={(e) => void onRememberChatsChange(e.target.checked)}
        />
        <span>
          <span className="font-medium text-foreground">Remember my charts</span> 
        </span>
      </label>
      <div className="flex flex-col gap-2 border-t border-border/40 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 justify-center text-xs"
          disabled={messages.length === 0}
          onClick={() => {
            onClearConversation()
            setSettingsOpen(false)
          }}
        >
          Clear this conversation
        </Button>
        {showClearSavedMemory && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 justify-center text-xs text-muted-foreground hover:text-destructive"
            onClick={() => void onClearDeviceMemory()}
          >
            Clear saved memory
          </Button>
        )}
      </div>
    </div>
  ) : null

  const chatBody = (
    <>
      <div
        ref={listRef}
        className={`mb-2 space-y-2 overflow-y-auto rounded-lg bg-background/80 p-2.5 text-base leading-relaxed shadow-inner ${CHAT_SCROLL_NO_BAR} ${listMaxClass}`}
      >
        {messages.length === 0 && (
          <p className="text-muted-foreground">
            <img
              src={JOLENE_AVATAR}
              alt=""
              width={32}
              height={32}
              className="mb-1 mr-1 inline-block rounded-full border border-border/60 object-cover object-top align-text-bottom shadow-sm"
            />
            Hi, I'm {JOLENE_NAME} — your chart assistant! Ask me anything about the market or how to change the chart.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={`rounded-md px-2.5 py-2 ${
              m.role === "user" ? "ml-4 bg-primary/10 text-foreground" : "mr-4 bg-muted/60 text-foreground"
            }`}
          >
            <span className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              {m.role === "user" ? (
                "You"
              ) : (
                <>
                  <img
                    src={JOLENE_AVATAR}
                    alt=""
                    width={14}
                    height={14}
                    className="rounded-full border border-border/50 object-cover object-top"
                  />
                  {JOLENE_NAME}
                </>
              )}
            </span>
            <div className="whitespace-pre-wrap">
              {m.role === "assistant" ? stripSimpleMarkdownForDisplay(m.content) : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 px-1 py-1 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {JOLENE_NAME} is thinking…
          </div>
        )}
      </div>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask ${JOLENE_NAME} about the market or how to change the chart…`}
          className="h-9 min-h-9 text-sm"
          disabled={loading || !enabled}
          maxLength={4000}
        />
        <Button
          type="submit"
          size="sm"
          className="h-9 shrink-0 px-3 text-sm"
          disabled={loading || !enabled || !input.trim()}
        >
          Send
        </Button>
      </form>
    </>
  )

  const settingsTrigger = (
    <Button
      ref={settingsTriggerRef}
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
      aria-label="Chat settings"
      aria-expanded={settingsOpen}
      aria-haspopup="dialog"
      onClick={(e) => {
        e.stopPropagation()
        setSettingsOpen((v) => !v)
      }}
    >
      <Settings2 className="h-4 w-4" />
    </Button>
  )

  if (variant === "panel") {
    return (
      <div className="space-y-1">
        <div className="relative flex justify-end">
          {settingsTrigger}
          {chatSettingsPanel}
        </div>
        {chatBody}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20">
      <div className="relative flex items-stretch border-b border-border/50">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
          aria-expanded={open}
        >
          <span className="flex min-w-0 items-center gap-2">
            <img
              src={JOLENE_AVATAR}
              alt=""
              width={18}
              height={18}
              className="shrink-0 rounded-full border border-border/60 object-cover object-top shadow-sm"
            />
            <span className="truncate">
              {JOLENE_NAME}
              <span className="font-normal text-muted-foreground"> — data & controls</span>
            </span>
          </span>
          {open ? <ChevronUp className="h-4 w-4 shrink-0 opacity-60" /> : <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />}
        </button>
        <div className="relative flex shrink-0 items-center border-l border-border/50 pr-1">
          {settingsTrigger}
          {chatSettingsPanel}
        </div>
      </div>
      {open && <div className="px-3 pb-3 pt-1">{chatBody}</div>}
    </div>
  )
}
