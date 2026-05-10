/**
 * Jolene chart/chat memory: "Remember my charts" defaults on (opt-out in localStorage).
 * Ciphertext in IndexedDB; AES-256-GCM on the server (JOLENE_MEMORY_MASTER_KEY).
 * HttpOnly session cookie is set when persistence is active (after session bootstrap).
 */

import { idbClearJoleneBlob, idbGetJoleneBlob, idbSetJoleneBlob, isIndexedDbSupported } from "@/lib/jolene-idb"

export type JoleneChatTurn = { role: "user" | "assistant"; content: string }

export type JoleneDeviceMemoryPayload = {
  v: 1
  updatedAt: number
  messages: JoleneChatTurn[]
  chartSnapshot: Record<string, unknown>
  lastDashboardPatch: Record<string, unknown>
}

const LEGACY_LS_MEMORY = "uwekezaji.jolene.memory.v1"
const LEGACY_LS_KEY = "uwekezaji.jolene.aes-key.v1"
const LEGACY_LS_PREF = "uwekezaji.jolene.encrypt-pref.v1"
/** Previous opt-in flag: "1" meant enabled. Migrated away on first read. */
const LEGACY_REMEMBER_OPT_IN_KEY = "uwekezaji.jolene.remember_opt_in.v1"
/** When set to "1", user turned off "Remember my charts". Absent = default on. */
const REMEMBER_CHARTS_OPT_OUT_KEY = "uwekezaji.jolene.remember_charts_opt_out.v1"

const LEGACY_REMEMBER_MIGRATED = "jolene_legacy_remember_migrated"

const MAX_STORED_MESSAGES = 80

export function getJoleneRememberChatsPreference(): boolean {
  if (typeof localStorage === "undefined") return true
  try {
    if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(LEGACY_REMEMBER_MIGRATED)) {
      sessionStorage.setItem(LEGACY_REMEMBER_MIGRATED, "1")
      const legacy = localStorage.getItem(LEGACY_REMEMBER_OPT_IN_KEY)
      if (legacy === "1") localStorage.removeItem(LEGACY_REMEMBER_OPT_IN_KEY)
      else if (legacy !== null) localStorage.removeItem(LEGACY_REMEMBER_OPT_IN_KEY)
    }
    return localStorage.getItem(REMEMBER_CHARTS_OPT_OUT_KEY) !== "1"
  } catch {
    return true
  }
}

export function setJoleneRememberChatsPreference(enabled: boolean): void {
  if (typeof localStorage === "undefined") return
  try {
    if (enabled) {
      localStorage.removeItem(REMEMBER_CHARTS_OPT_OUT_KEY)
      localStorage.removeItem(LEGACY_REMEMBER_OPT_IN_KEY)
    } else {
      localStorage.setItem(REMEMBER_CHARTS_OPT_OUT_KEY, "1")
      localStorage.removeItem(LEGACY_REMEMBER_OPT_IN_KEY)
    }
  } catch {
    /* ignore */
  }
}

export async function getJoleneMemoryServerConfigured(): Promise<boolean> {
  try {
    const res = await fetch("/api/ai/jolene-memory/status")
    const j = (await res.json()) as { configured?: boolean }
    return j.configured === true
  } catch {
    return false
  }
}

export async function ensureJoleneMemorySession(): Promise<{ persistence: boolean; reason?: string }> {
  try {
    const res = await fetch("/api/ai/jolene-memory/session", { credentials: "include" })
    const j = (await res.json()) as { ok?: boolean; persistence?: boolean; reason?: string }
    if (!res.ok || j.ok !== true) {
      return { persistence: false, reason: "session_unavailable" }
    }
    return { persistence: j.persistence === true, reason: j.reason }
  } catch {
    return { persistence: false, reason: "network" }
  }
}

export async function clearJoleneMemorySessionCookie(): Promise<void> {
  try {
    await fetch("/api/ai/jolene-memory/session", { method: "DELETE", credentials: "include" })
  } catch {
    /* ignore */
  }
}

async function serverEncryptPayload(plaintext: string): Promise<string | null> {
  const res = await fetch("/api/ai/jolene-memory/encrypt", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: plaintext }),
  })
  if (!res.ok) return null
  const j = (await res.json()) as { blob?: string }
  return typeof j.blob === "string" ? j.blob : null
}

async function serverDecryptBlob(blob: string): Promise<string | null> {
  const res = await fetch("/api/ai/jolene-memory/decrypt", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blob }),
  })
  if (!res.ok) return null
  const j = (await res.json()) as { payload?: string }
  return typeof j.payload === "string" ? j.payload : null
}

function clampMessages(messages: JoleneChatTurn[]): JoleneChatTurn[] {
  if (messages.length <= MAX_STORED_MESSAGES) return messages
  return messages.slice(-MAX_STORED_MESSAGES)
}

export function normalizeJolenePayload(partial: Partial<JoleneDeviceMemoryPayload>): JoleneDeviceMemoryPayload {
  return {
    v: 1,
    updatedAt: partial.updatedAt ?? Date.now(),
    messages: clampMessages(Array.isArray(partial.messages) ? partial.messages : []),
    chartSnapshot:
      partial.chartSnapshot && typeof partial.chartSnapshot === "object"
        ? { ...partial.chartSnapshot }
        : {},
    lastDashboardPatch:
      partial.lastDashboardPatch && typeof partial.lastDashboardPatch === "object"
        ? { ...partial.lastDashboardPatch }
        : {},
  }
}

function stripLegacyLocalStorage(): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.removeItem(LEGACY_LS_MEMORY)
    localStorage.removeItem(LEGACY_LS_KEY)
    localStorage.removeItem(LEGACY_LS_PREF)
  } catch {
    /* ignore */
  }
}

/** One-time move from legacy localStorage (plaintext only) into encrypted IndexedDB. */
async function migrateLegacyLocalStorageIfNeeded(): Promise<void> {
  if ((await idbGetJoleneBlob()) !== null) return
  if (typeof localStorage === "undefined") return
  let raw: string | null
  try {
    raw = localStorage.getItem(LEGACY_LS_MEMORY)
  } catch {
    return
  }
  if (!raw?.trim()) return

  try {
    const outer = JSON.parse(raw) as Record<string, unknown>
    if (outer.enc === true) {
      stripLegacyLocalStorage()
      return
    }
    let payload: JoleneDeviceMemoryPayload | null = null
    if (outer.enc === false && outer.plain && typeof outer.plain === "object") {
      payload = normalizeJolenePayload(outer.plain as Partial<JoleneDeviceMemoryPayload>)
    } else if (outer.v === 1 && Array.isArray(outer.messages)) {
      payload = normalizeJolenePayload(outer as Partial<JoleneDeviceMemoryPayload>)
    }
    if (!payload) {
      stripLegacyLocalStorage()
      return
    }
    const blob = await serverEncryptPayload(JSON.stringify(payload))
    if (blob) await idbSetJoleneBlob(blob)
    stripLegacyLocalStorage()
  } catch {
    stripLegacyLocalStorage()
  }
}

export type JoleneLoadResult = {
  memory: JoleneDeviceMemoryPayload | null
  persistence: boolean
  serverConfigured: boolean
}

/** True if IndexedDB holds an encrypted blob (even if decrypt fails later). */
export async function hasJolenePersistedBlobInIdb(): Promise<boolean> {
  if (!isIndexedDbSupported()) return false
  try {
    const b = await idbGetJoleneBlob()
    return typeof b === "string" && b.length > 0
  } catch {
    return false
  }
}

export async function loadJoleneDeviceMemory(): Promise<JoleneLoadResult> {
  const serverConfigured = await getJoleneMemoryServerConfigured()

  if (!getJoleneRememberChatsPreference() || !isIndexedDbSupported()) {
    return { memory: null, persistence: false, serverConfigured }
  }

  const session = await ensureJoleneMemorySession()
  if (!session.persistence) {
    return { memory: null, persistence: false, serverConfigured }
  }

  await migrateLegacyLocalStorageIfNeeded()

  const blob = await idbGetJoleneBlob()
  if (!blob) {
    return { memory: null, persistence: true, serverConfigured }
  }

  const json = await serverDecryptBlob(blob)
  if (!json) {
    return { memory: null, persistence: true, serverConfigured }
  }

  try {
    const data = JSON.parse(json) as Partial<JoleneDeviceMemoryPayload>
    return { memory: normalizeJolenePayload(data), persistence: true, serverConfigured }
  } catch {
    return { memory: null, persistence: true, serverConfigured }
  }
}

export async function saveJoleneDeviceMemory(payload: JoleneDeviceMemoryPayload): Promise<boolean> {
  if (!getJoleneRememberChatsPreference() || !isIndexedDbSupported()) return false

  const session = await ensureJoleneMemorySession()
  if (!session.persistence) return false

  const normalized = normalizeJolenePayload({ ...payload, updatedAt: Date.now() })
  const blob = await serverEncryptPayload(JSON.stringify(normalized))
  if (!blob) return false
  try {
    await idbSetJoleneBlob(blob)
    return true
  } catch {
    /* quota / private mode */
    return false
  }
}

export async function clearJoleneDeviceMemory(): Promise<void> {
  await idbClearJoleneBlob()
  stripLegacyLocalStorage()
}
